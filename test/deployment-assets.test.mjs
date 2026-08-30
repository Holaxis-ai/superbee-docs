import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assembleDeployment,
  declaredMediaTypeOverrides,
  DEPLOYMENT_ASSEMBLY_RESULT_V1,
  DEPLOYMENT_REDIRECTS,
  deploymentConfigurationFiles,
  renderHeaders,
  renderRedirects,
} from "../scripts/deployment-assets.mjs";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/*
 * One file per interesting media type case: a type the host derives correctly, a type it derives
 * differently from the declaration, an extension nothing has measured, and an object the host
 * serves with no type at all.
 */
const FIXTURE = {
  "index.html": { body: "<!doctype html><title>home</title>\n", mediaType: "text/html; charset=utf-8" },
  "404.html": { body: "<!doctype html><title>gone</title>\n", mediaType: "text/html; charset=utf-8" },
  "llms.txt": { body: "# Superbee\n", mediaType: "text/markdown; charset=utf-8" },
  "docs/learn/start-here/index.html": { body: "<!doctype html><title>start</title>\n", mediaType: "text/html; charset=utf-8" },
  "bundle/learn/start-here.md": { body: "# Start here\n", mediaType: "text/markdown; charset=utf-8" },
  "bundle/visuals/diagrams/example.svg": { body: "<svg></svg>\n", mediaType: "application/octet-stream" },
  "assets/unmeasured.zzz": { body: "?\n", mediaType: "application/json; charset=utf-8" },
  "data/objects/0f0f": { body: "opaque\n", mediaType: "application/octet-stream" },
};

async function artifact(files = FIXTURE) {
  const directory = await mkdtemp(path.join(tmpdir(), "superbee-docs-deployment-"));
  const rows = [];
  for (const [relative, { body, mediaType }] of Object.entries(files)) {
    const target = path.join(directory, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    rows.push({ path: relative, mediaType, digest: sha256(Buffer.from(body)), size: Buffer.byteLength(body) });
  }
  await mkdir(path.join(directory, "data"), { recursive: true });
  await writeFile(path.join(directory, "data", "portal-manifest.json"), JSON.stringify({
    artifactDigest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    files: rows,
  }));
  return directory;
}

async function tree(root, prefix = "") {
  const rows = [];
  const directory = prefix ? path.join(root, ...prefix.split("/")) : root;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) rows.push(...await tree(root, relative));
    else rows.push(relative);
  }
  return rows.sort();
}

test("each entry redirect names one exact route, so no unrelated path is masked", () => {
  assert.deepEqual([...DEPLOYMENT_REDIRECTS], [
    { from: "/docs", to: "/", status: 301 },
    { from: "/docs/", to: "/", status: 301 },
  ]);
  for (const rule of DEPLOYMENT_REDIRECTS) {
    // A wildcard or placeholder here would answer every missing page under the prefix.
    assert.doesNotMatch(rule.from, /[*]|:[A-Za-z]/u, rule.from);
    assert.match(rule.from, /^\/[^\s]*$/u, rule.from);
  }
});

test("the rendered redirects file carries exactly the declared rules in Cloudflare's grammar", () => {
  const rendered = renderRedirects();
  const lines = rendered.split("\n");
  assert.equal(lines.at(-1), "", "the file ends with a newline");
  const rules = lines.filter((line) => line.length > 0 && !line.startsWith("#"));
  assert.deepEqual(rules, ["/docs / 301", "/docs/ / 301"]);
  for (const line of rules) {
    const tokens = line.split(/\s+/u);
    assert.equal(tokens.length, 3, line);
    assert.match(tokens[0], /^\//u);
    assert.match(tokens[1], /^\//u);
    assert.ok([301, 302, 303, 307, 308].includes(Number(tokens[2])), line);
    assert.ok(line.length <= 2000, line);
  }
  assert.equal(deploymentConfigurationFiles({ files: [] }).get("_redirects"), rendered);
});

test("a rule Cloudflare would discard or widen is refused before it can be deployed", () => {
  assert.throws(() => renderRedirects([{ from: "/docs/*", to: "/", status: 301 }]), /wildcard or a placeholder/u);
  assert.throws(() => renderRedirects([{ from: "/docs/:page", to: "/", status: 301 }]), /wildcard or a placeholder/u);
  assert.throws(() => renderRedirects([{ from: "docs", to: "/", status: 301 }]), /absolute whitespace-free path/u);
  assert.throws(() => renderRedirects([{ from: "/docs", to: "/", status: 404 }]), /not one Cloudflare accepts/u);
  assert.throws(() => renderRedirects([
    { from: "/docs", to: "/", status: 301 },
    { from: "/docs", to: "/other", status: 301 },
  ]), /duplicate redirect source/u);
  // Cloudflare silently discards this rule, so a deployed copy would 404 while looking configured.
  assert.throws(() => renderRedirects([{ from: "/docs/", to: "/index.html", status: 301 }]), /loop through html handling/u);
});

const inventory = (files = FIXTURE) => ({
  files: Object.entries(files).map(([relative, { mediaType }]) => ({ path: relative, mediaType })),
});

/** Read back the generated file the way Cloudflare does: a path line, then its header lines. */
function parseGeneratedHeaders(rendered) {
  const rules = [];
  for (const line of rendered.split("\n")) {
    if (line.trim() === "" || line.startsWith("#")) continue;
    if (line.startsWith("/")) rules.push({ path: line, headers: [] });
    else rules.at(-1).headers.push(line.trim());
  }
  return rules;
}

test("only a path whose served type would disagree with its declaration earns a rule", () => {
  /*
   * The host derives `text/html` and `text/markdown` from those extensions already, and serves a
   * content-addressed object with no type at all, which is the same promise as the declared
   * `application/octet-stream`. What remains is a `.txt` the host calls plain text, an `.svg` it
   * would render instead of handing over as raw bytes, and an extension nobody has measured.
   */
  assert.deepEqual(declaredMediaTypeOverrides(inventory()), [
    { path: "/assets/unmeasured.zzz", mediaType: "application/json; charset=utf-8" },
    { path: "/bundle/visuals/diagrams/example.svg", mediaType: "application/octet-stream" },
    { path: "/llms.txt", mediaType: "text/markdown; charset=utf-8" },
  ]);
});

test("every rendered header rule restates a declared type verbatim and cannot overlap another", () => {
  const manifest = inventory();
  const declared = new Map(manifest.files.map((file) => [`/${file.path}`, file.mediaType]));
  const rules = parseGeneratedHeaders(renderHeaders(manifest));
  assert.deepEqual(rules.map((rule) => rule.path), [
    "/assets/unmeasured.zzz",
    "/bundle/visuals/diagrams/example.svg",
    "/llms.txt",
  ]);
  for (const rule of rules) {
    assert.deepEqual(rule.headers, [`Content-Type: ${declared.get(rule.path)}`], rule.path);
    // Two rules matching one request append their values instead of replacing them.
    assert.doesNotMatch(rule.path, /[*]|:[A-Za-z]/u, rule.path);
  }
  assert.equal(new Set(rules.map((rule) => rule.path)).size, rules.length);
  assert.equal(deploymentConfigurationFiles(manifest).get("_headers"), renderHeaders(manifest));
});

test("an undeclared type, or more drift than Cloudflare can carry, fails the build", () => {
  assert.throws(() => renderHeaders({ files: [{ path: "llms.txt" }] }), /declares no media type/u);
  const crowded = {
    files: Array.from({ length: 101 }, (_, index) => ({
      path: `bundle/raw/${index}.unmeasured`,
      mediaType: "text/html; charset=utf-8",
    })),
  };
  assert.throws(() => renderHeaders(crowded), /at most 100 header rules/u);
});

test("assembly carries the exact declared inventory plus the host configuration, and repeats", async () => {
  const dist = await artifact();
  const output = path.join(await mkdtemp(path.join(tmpdir(), "superbee-docs-output-")), "deploy");
  try {
    const receipt = await assembleDeployment({ artifact: dist, output });
    assert.equal(receipt.schema, DEPLOYMENT_ASSEMBLY_RESULT_V1);
    assert.equal(receipt.ok, true);
    assert.deepEqual(receipt.configuration, ["_headers", "_redirects"]);
    assert.deepEqual(await tree(output), [
      ...[...Object.keys(FIXTURE), "data/portal-manifest.json", "_headers", "_redirects"].sort(),
    ]);
    for (const [relative, { body }] of Object.entries(FIXTURE)) {
      assert.equal(await readFile(path.join(output, ...relative.split("/")), "utf8"), body, relative);
    }
    assert.equal(await readFile(path.join(output, "_redirects"), "utf8"), renderRedirects());
    // A second assembly replaces its own previous output rather than refusing or accumulating.
    const again = await assembleDeployment({ artifact: dist, output });
    assert.deepEqual(again, receipt);
    assert.deepEqual(await tree(output), [
      ...[...Object.keys(FIXTURE), "data/portal-manifest.json", "_headers", "_redirects"].sort(),
    ]);
    assert.equal(await readFile(path.join(output, "_redirects"), "utf8"), renderRedirects());
  } finally {
    await rm(dist, { recursive: true, force: true });
    await rm(path.dirname(output), { recursive: true, force: true });
  }
});

test("assembly refuses an artifact or an output directory it does not own", async () => {
  const dist = await artifact();
  const parent = await mkdtemp(path.join(tmpdir(), "superbee-docs-output-"));
  const output = path.join(parent, "deploy");
  try {
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "someone-elses-file"), "keep me\n");
    await assert.rejects(assembleDeployment({ artifact: dist, output }), /not a previous deployment assembly/u);
    assert.deepEqual(await tree(output), ["someone-elses-file"]);

    await rm(output, { recursive: true, force: true });
    await writeFile(path.join(dist, "stray.txt"), "not in the manifest\n");
    await assert.rejects(assembleDeployment({ artifact: dist, output }), /does not exactly match its declared portal inventory/u);

    await rm(path.join(dist, "stray.txt"));
    await writeFile(path.join(dist, "index.html"), "<!doctype html><title>edited page</title>\n");
    await assert.rejects(assembleDeployment({ artifact: dist, output }), /does not match its manifest digest/u);

    await assert.rejects(assembleDeployment({ artifact: dist, output: path.join(dist, "nested") }), /must not overlap/u);
  } finally {
    await rm(dist, { recursive: true, force: true });
    await rm(parent, { recursive: true, force: true });
  }
});

test("the built deployment carries the redirects and the declared types of the real artifact", async () => {
  // Requires a prior `npm run portal:build`, like every other check over the built outputs.
  const [redirects, headers, deployedIndex, publishedIndex, manifest] = await Promise.all([
    readFile("deploy/_redirects", "utf8"),
    readFile("deploy/_headers", "utf8"),
    readFile("deploy/index.html"),
    readFile("dist/index.html"),
    readFile("dist/data/portal-manifest.json", "utf8").then(JSON.parse),
  ]);
  assert.equal(redirects, renderRedirects());
  assert.equal(headers, renderHeaders(manifest));
  assert.equal(Buffer.compare(deployedIndex, publishedIndex), 0);
  const published = new Map(manifest.files.map((file) => [file.path, file.mediaType]));
  for (const rule of DEPLOYMENT_REDIRECTS) {
    // A redirect over a path the artifact publishes would shadow a real page.
    assert.equal(published.has(rule.from.replace(/^\//, "")), false, rule.from);
  }
  const rules = parseGeneratedHeaders(headers);
  for (const rule of rules) {
    const relative = rule.path.replace(/^\//, "");
    assert.ok(published.has(relative), `${rule.path} is not a published path`);
    assert.deepEqual(rule.headers, [`Content-Type: ${published.get(relative)}`], rule.path);
  }
  const covered = new Set(rules.map((rule) => rule.path));
  // The standing drift this work closes, and the paths the host already labels correctly.
  assert.ok(covered.has("/llms.txt"));
  for (const settled of ["/robots.txt", "/sitemap.xml", "/index.html", "/404.html", "/404.md"]) {
    assert.equal(covered.has(settled), false, settled);
  }
});
