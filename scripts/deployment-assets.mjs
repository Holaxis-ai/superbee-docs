/*
 * Assemble the directory Cloudflare uploads: one exact Portal artifact plus host configuration.
 *
 * `dist` is an immutable, inventory-exact artifact. Portal's loader rejects a directory holding any
 * file its manifest does not name, so the next `portal:build` would refuse to replace an output
 * carrying one extra byte of ours. Cloudflare, meanwhile, reads `_redirects` and `_headers` only
 * from the root of the uploaded assets directory, and never serves them as assets. Those two facts
 * cannot both hold in one directory, so the deployed directory is assembled here instead: every
 * declared artifact file, copied under its manifest digest, plus the generated host configuration.
 *
 * Deployment configuration is generated from a rule table rather than hand-maintained in the
 * deployed tree, so the rules stay reviewable as data and the deployed file cannot drift from them.
 */

import { createHash, randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEPLOYMENT_ASSEMBLY_RESULT_V1 =
  "https://getsuperbee.com/schemas/superbee-docs/deployment-assembly-result/v1";

const MANIFEST_PATH = "data/portal-manifest.json";
const MANIFEST_MEDIA_TYPE = "application/json; charset=utf-8";
const HOSTING_REQUIREMENTS_PATH = "data/hosting-requirements.json";

/** Cloudflare's own configuration limits, restated so a generated file cannot silently exceed them. */
const MAX_STATIC_REDIRECT_RULES = 2000;
const MAX_HEADER_RULES = 100;
const MAX_LINE_LENGTH = 2000;
const PERMITTED_REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

/**
 * What this Worker-less host actually sends as `Content-Type`, measured per extension.
 *
 * Wrangler resolves the type from the file extension when it uploads an asset and appends
 * `charset=utf-8` to any `text/*` type. Nothing consults the artifact's declared inventory, which
 * is why a declared type drifts from the served one. `null` records an extension the host serves
 * with no `Content-Type` at all. Every row below was measured against the real asset router
 * serving this repository's own deployment directory, because guessing is how `.mmd` was nearly
 * missed: a Mermaid source matches a karaoke format in the host's media type database.
 *
 * An extension absent from this table is unmeasured, so its path earns a rule carrying the declared
 * type. That is always correct and never silent: if a future artifact adds enough unmeasured paths
 * to exhaust Cloudflare's rule budget, the build fails and asks for the measurement.
 */
const HOST_MEDIA_TYPE_BY_EXTENSION = new Map(Object.entries({
  "": null,
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  md: "text/markdown; charset=utf-8",
  mmd: "application/vnd.chipnuts.karaoke-mmd",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
  woff2: "font/woff2",
  xml: "application/xml",
}));

const UNLABELLED_MEDIA_TYPE = "application/octet-stream";

const normalizedMediaType = (value) => (value ?? "").trim().toLowerCase().replace(/\s*;\s*/gu, "; ");

function extensionOf(relative) {
  const name = relative.slice(relative.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * Entry paths a reader guesses, redirected to the one canonical documentation root.
 *
 * Published pages live at `/docs/<id>/` and the documentation home is the site root, so bare
 * `/docs` and `/docs/` address nothing. Each rule names one exact path on purpose: a `/docs/*`
 * rule would match every missing page under the prefix and turn a genuine 404 into a silent
 * redirect, which is the opposite of telling a reader that the page they asked for is gone.
 */
export const DEPLOYMENT_REDIRECTS = Object.freeze([
  Object.freeze({ from: "/docs", to: "/", status: 301 }),
  Object.freeze({ from: "/docs/", to: "/", status: 301 }),
]);

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function assertExactRoute(value, field) {
  if (typeof value !== "string" || !value.startsWith("/") || /\s/u.test(value)) {
    throw new Error(`${field} must be one absolute whitespace-free path; got ${JSON.stringify(value)}`);
  }
  // A wildcard or a `:name` placeholder would widen a rule past the exact route it declares.
  if (value.includes("*") || /:[A-Za-z]/u.test(value)) {
    throw new Error(`${field} '${value}' must not use a wildcard or a placeholder`);
  }
}

function assertHeaderRoute(value, field) {
  if (value === "/*") return;
  if (typeof value !== "string" || !value.startsWith("/") || /\s/u.test(value)) {
    throw new Error(`${field} must be one absolute whitespace-free path or suffix wildcard; got ${JSON.stringify(value)}`);
  }
  if (value.includes(":")) throw new Error(`${field} '${value}' must not use a placeholder`);
  const stars = [...value].filter((character) => character === "*").length;
  if (stars > 1 || (stars === 1 && !value.endsWith("*"))) {
    throw new Error(`${field} '${value}' may use only one terminal wildcard`);
  }
}

function patternsOverlap(left, right) {
  const leftPrefix = left.endsWith("*") ? left.slice(0, -1) : null;
  const rightPrefix = right.endsWith("*") ? right.slice(0, -1) : null;
  if (leftPrefix !== null && rightPrefix !== null) {
    return leftPrefix.startsWith(rightPrefix) || rightPrefix.startsWith(leftPrefix);
  }
  if (leftPrefix !== null) return right.startsWith(leftPrefix);
  if (rightPrefix !== null) return left.startsWith(rightPrefix);
  return left === right;
}

/** Render the exact `_redirects` bytes Cloudflare parses, refusing any rule it would discard. */
export function renderRedirects(rules = DEPLOYMENT_REDIRECTS) {
  if (rules.length > MAX_STATIC_REDIRECT_RULES) {
    throw new Error(`at most ${MAX_STATIC_REDIRECT_RULES} static redirect rules are supported`);
  }
  const seen = new Set();
  const lines = [
    "# Generated by scripts/deployment-assets.mjs from DEPLOYMENT_REDIRECTS.",
    "# Edit that rule table, never a deployed copy of this file.",
  ];
  for (const rule of rules) {
    assertExactRoute(rule.from, "redirect source");
    assertExactRoute(rule.to, "redirect target");
    if (!PERMITTED_REDIRECT_STATUS.has(rule.status)) {
      throw new Error(`redirect status ${rule.status} is not one Cloudflare accepts`);
    }
    if (seen.has(rule.from)) throw new Error(`duplicate redirect source '${rule.from}'`);
    seen.add(rule.from);
    /*
     * Cloudflare discards a rule whose source ends in `/` and whose target ends in `/index` or
     * `/index.html`, because `html_handling` would rewrite the target straight back into the rule.
     * Refuse here so a discarded rule can never reach production as a silent 404.
     */
    if (rule.from.endsWith("/") && /\/index(?:\.html)?$/u.test(rule.to)) {
      throw new Error(`redirect '${rule.from}' -> '${rule.to}' would loop through html handling`);
    }
    const line = `${rule.from} ${rule.to} ${rule.status}`;
    if (line.length > MAX_LINE_LENGTH) throw new Error(`redirect line exceeds ${MAX_LINE_LENGTH} characters`);
    lines.push(line);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * The published paths whose served media type would disagree with the artifact's declaration.
 *
 * The correction is always the declared type verbatim, so this reads the artifact's own inventory
 * and never invents a type. Only a disagreement earns a rule: Cloudflare allows a hundred header
 * rules, and restating a type the host already sends would spend that budget on nothing.
 *
 * The content-addressed objects the host serves with no `Content-Type` are the one measured case
 * treated as agreement: the artifact declares `application/octet-stream` for them, an absent type
 * carries the same promise of unlabelled bytes, and there is one such path per stored object, so
 * pinning each would spend the whole rule budget restating what the host already does.
 */
export function declaredMediaTypeOverrides(manifest) {
  const rules = [];
  for (const file of manifest.files) {
    if (typeof file.mediaType !== "string" || file.mediaType.trim() === "") {
      throw new Error(`published file '${file.path}' declares no media type`);
    }
    const extension = extensionOf(file.path);
    const declared = normalizedMediaType(file.mediaType);
    const measured = HOST_MEDIA_TYPE_BY_EXTENSION.has(extension);
    const served = HOST_MEDIA_TYPE_BY_EXTENSION.get(extension);
    const agrees = measured
      && (served === null ? declared === UNLABELLED_MEDIA_TYPE : normalizedMediaType(served) === declared);
    if (!agrees) rules.push({ path: `/${file.path}`, mediaType: file.mediaType });
  }
  return rules.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

/** Resolve one declared response-header selector into the paths Cloudflare must match. */
function responseHeaderPaths(selector, requirements) {
  if (selector === "*") return ["/*"];
  if (selector.startsWith("/")) return [selector];
  const matches = requirements.routes.filter((route) => route.disposition === selector);
  if (matches.length === 0) throw new Error(`response header selector '${selector}' names no declared route disposition`);

  /*
   * Documentation pages are an intentionally uniform route family. One proven `/docs/*` rule
   * replaces two exact rules per page, keeping this Worker-less deployment comfortably below
   * Cloudflare's hundred-rule limit as the documentation grows. Refuse the compression if a later
   * presentation assigns any route below that prefix to another disposition.
   */
  const documentation = matches.filter((route) => route.pattern.startsWith("/docs/"));
  const paths = matches.filter((route) => !route.pattern.startsWith("/docs/")).map((route) => route.pattern);
  if (documentation.length > 0) {
    const conflict = requirements.routes.find((route) => (
      route.pattern.startsWith("/docs/") && route.disposition !== selector
    ));
    if (conflict) {
      throw new Error(`cannot apply '${selector}' response headers through /docs/*; '${conflict.pattern}' is ${conflict.disposition}`);
    }
    paths.push("/docs/*");
  }
  return [...new Set(paths)].sort();
}

function declaredResponseHeaderRules(requirements) {
  if (!requirements || !Array.isArray(requirements.routes) || !Array.isArray(requirements.responseHeaders)) {
    throw new Error("hosting requirements must declare routes and responseHeaders arrays");
  }
  const byPath = new Map();
  for (const declaration of requirements.responseHeaders) {
    if (typeof declaration.name !== "string" || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u.test(declaration.name)) {
      throw new Error(`invalid declared response header name ${JSON.stringify(declaration.name)}`);
    }
    if (typeof declaration.value !== "string" || declaration.value.length === 0 || /[\r\n]/u.test(declaration.value)) {
      throw new Error(`declared response header '${declaration.name}' has an invalid value`);
    }
    if (typeof declaration.route !== "string" || declaration.route.length === 0) {
      throw new Error(`declared response header '${declaration.name}' has no route selector`);
    }
    for (const route of responseHeaderPaths(declaration.route, requirements)) {
      assertHeaderRoute(route, "response header route");
      const headers = byPath.get(route) ?? new Map();
      const key = declaration.name.toLowerCase();
      if (headers.has(key)) throw new Error(`duplicate declared response header '${declaration.name}' for '${route}'`);
      headers.set(key, { name: declaration.name, value: declaration.value });
      byPath.set(route, headers);
    }
  }
  return byPath;
}

/** Render the exact `_headers` bytes that enforce declared response policy and media types. */
export function renderHeaders(manifest, requirements) {
  const byPath = declaredResponseHeaderRules(requirements);
  /* The identity manifest is the only deployed artifact file that cannot list itself. */
  const mediaTypes = manifest.files.some((file) => file.path === MANIFEST_PATH)
    ? manifest
    : { ...manifest, files: [...manifest.files, { path: MANIFEST_PATH, mediaType: MANIFEST_MEDIA_TYPE }] };
  for (const rule of declaredMediaTypeOverrides(mediaTypes)) {
    const headers = byPath.get(rule.path) ?? new Map();
    if (headers.has("content-type")) throw new Error(`duplicate Content-Type rule for '${rule.path}'`);
    headers.set("content-type", { name: "Content-Type", value: rule.mediaType });
    byPath.set(rule.path, headers);
  }
  const rules = [...byPath.entries()]
    .map(([route, headers]) => ({
      route,
      headers: [...headers.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    }))
    .sort((left, right) => (
      left.route === "/*" ? -1 : right.route === "/*" ? 1 : left.route < right.route ? -1 : left.route > right.route ? 1 : 0
    ));
  if (rules.length > MAX_HEADER_RULES) {
    throw new Error(`at most ${MAX_HEADER_RULES} header rules are supported; ${rules.length} are required`);
  }
  const lines = [
    "# Generated by scripts/deployment-assets.mjs from the artifact's hosting requirements and media types.",
    "# Edit those declarations or the host media type table, never a deployed copy.",
  ];
  for (const rule of rules) {
    if (rule.route.length > MAX_LINE_LENGTH) throw new Error(`header route '${rule.route}' exceeds ${MAX_LINE_LENGTH} characters`);
    lines.push(rule.route);
    for (const header of rule.headers) {
      const overlapping = rules.find((other) => (
        other !== rule
        && patternsOverlap(rule.route, other.route)
        && other.headers.some((candidate) => candidate.name.toLowerCase() === header.name.toLowerCase())
      ));
      if (overlapping) {
        throw new Error(`overlapping rules '${rule.route}' and '${overlapping.route}' both emit '${header.name}'`);
      }
      const value = `  ${header.name}: ${header.value}`;
      if (value.length > MAX_LINE_LENGTH) {
        throw new Error(`header '${header.name}' for '${rule.route}' exceeds ${MAX_LINE_LENGTH} characters`);
      }
      lines.push(value);
    }
  }
  return `${lines.join("\n")}\n`;
}

/** The host configuration files Cloudflare consumes from the uploaded assets directory root. */
export function deploymentConfigurationFiles(manifest, requirements) {
  return new Map([
    ["_headers", renderHeaders(manifest, requirements)],
    ["_redirects", renderRedirects()],
  ]);
}

async function inventory(root, prefix = "") {
  const rows = [];
  const directory = prefix ? path.join(root, ...prefix.split("/")) : root;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const info = await lstat(path.join(directory, entry.name));
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) {
      throw new Error(`the portal artifact may contain only regular files and directories; found ${relative}`);
    }
    if (info.isDirectory()) rows.push(...await inventory(root, relative));
    else rows.push(relative);
  }
  return rows.sort();
}

/**
 * A previous assembly always carries the artifact manifest at its exact path. Anything else in the
 * deployment directory is a tree this script did not create, and is not ours to replace.
 */
async function replaceableOutput(directory) {
  let entries;
  try {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error(`refusing to replace '${directory}': it is not a regular directory`);
    }
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (entries.length === 0) return true;
  try {
    await lstat(path.join(directory, ...MANIFEST_PATH.split("/")));
  } catch {
    throw new Error(`refusing to replace '${directory}': it is not a previous deployment assembly`);
  }
  return true;
}

/**
 * Copy the exact declared artifact inventory into the deployment directory and add the host
 * configuration. Every file is verified against the manifest digest it was published under, so an
 * assembled deployment can only carry bytes this repository built.
 */
export async function assembleDeployment({ artifact = "dist", output = "deploy" } = {}) {
  const artifactRoot = path.resolve(artifact);
  const outputRoot = path.resolve(output);
  if (artifactRoot === outputRoot
    || outputRoot.startsWith(`${artifactRoot}${path.sep}`)
    || artifactRoot.startsWith(`${outputRoot}${path.sep}`)) {
    throw new Error("the portal artifact and the deployment directory must not overlap");
  }
  const manifestBytes = await readFile(path.join(artifactRoot, ...MANIFEST_PATH.split("/")));
  const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error("the portal manifest must declare its file inventory");
  }
  const declared = [...manifest.files].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const expected = [...declared.map((file) => file.path), MANIFEST_PATH].sort();
  const observed = await inventory(artifactRoot);
  if (JSON.stringify(observed) !== JSON.stringify(expected)) {
    throw new Error(`'${artifactRoot}' does not exactly match its declared portal inventory; rebuild it`);
  }
  const requirementsBytes = await readFile(path.join(artifactRoot, ...HOSTING_REQUIREMENTS_PATH.split("/")));
  if (sha256(requirementsBytes) !== manifest.hostingRequirementsDigest) {
    throw new Error("hosting requirements do not match the digest declared by the portal manifest");
  }
  const requirements = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(requirementsBytes));
  const configuration = deploymentConfigurationFiles(manifest, requirements);
  for (const name of configuration.keys()) {
    if (expected.includes(name)) throw new Error(`deployment configuration '${name}' collides with a published asset`);
  }

  const parent = path.dirname(outputRoot);
  const nonce = randomBytes(8).toString("hex");
  const stage = path.join(parent, `.superbee-deployment-stage-${nonce}`);
  const backup = path.join(parent, `.superbee-deployment-backup-${nonce}`);
  await mkdir(parent, { recursive: true });
  await mkdir(stage, { mode: 0o700 });
  let bytes = 0;
  let moved = false;
  let installed = false;
  try {
    for (const file of [...declared, { path: MANIFEST_PATH }]) {
      const source = await readFile(path.join(artifactRoot, ...file.path.split("/")));
      if (file.digest !== undefined && sha256(source) !== file.digest) {
        throw new Error(`published file '${file.path}' does not match its manifest digest`);
      }
      const destination = path.join(stage, ...file.path.split("/"));
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await writeFile(destination, source, { mode: 0o600, flag: "wx" });
      bytes += source.byteLength;
    }
    for (const [name, content] of configuration) {
      const encoded = Buffer.from(content, "utf8");
      await writeFile(path.join(stage, name), encoded, { mode: 0o600, flag: "wx" });
      bytes += encoded.byteLength;
    }
    const replacing = await replaceableOutput(outputRoot);
    if (replacing) {
      await rename(outputRoot, backup);
      moved = true;
    }
    await rename(stage, outputRoot);
    installed = true;
    if (moved) {
      await rm(backup, { recursive: true, force: true });
      moved = false;
    }
  } catch (error) {
    if (moved && !installed) await rename(backup, outputRoot).catch(() => undefined);
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  return {
    schema: DEPLOYMENT_ASSEMBLY_RESULT_V1,
    ok: true,
    artifact: artifactRoot,
    output: outputRoot,
    artifactDigest: manifest.artifactDigest,
    files: declared.length + 1,
    configuration: [...configuration.keys()].sort(),
    bytes,
  };
}

async function main(argv) {
  const options = { artifact: "dist", output: "deploy" };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--artifact" && value) options.artifact = value;
    else if (flag === "--output" && value) options.output = value;
    else throw new Error("usage: node scripts/deployment-assets.mjs [--artifact <directory>] [--output <directory>]");
  }
  console.log(JSON.stringify(await assembleDeployment(options)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
