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

const SHELL_CSP = "default-src 'self'; frame-ancestors 'none'";
const VIEW_CSP = "sandbox allow-scripts; default-src 'none'";
const HOSTING_REQUIREMENTS = {
  schema: "https://getsuperbee.com/schemas/hosting-requirements/v1",
  audience: "public",
  routes: [
    { pattern: "/", artifactPath: "index.html", disposition: "shell", methods: ["GET", "HEAD"] },
    { pattern: "/404", artifactPath: "404.html", disposition: "shell", methods: ["GET", "HEAD"] },
    {
      pattern: "/docs/learn/start-here/",
      artifactPath: "docs/learn/start-here/index.html",
      disposition: "shell",
      methods: ["GET", "HEAD"],
    },
    { pattern: "/assets/*", disposition: "asset", methods: ["GET", "HEAD"] },
    { pattern: "/data/*", disposition: "data", methods: ["GET", "HEAD"] },
    { pattern: "/bundle/views/example.html", disposition: "view", methods: ["GET", "HEAD"] },
    { pattern: "/bundle/*", disposition: "raw", methods: ["GET", "HEAD"] },
  ],
  responseHeaders: [
    { route: "*", name: "X-Content-Type-Options", value: "nosniff" },
    { route: "*", name: "Referrer-Policy", value: "no-referrer" },
    { route: "shell", name: "Content-Security-Policy", value: SHELL_CSP },
    { route: "view", name: "Content-Security-Policy", value: VIEW_CSP },
  ],
  cachePolicies: [],
  fallbackPolicy: "declared-shell-routes-only",
  notFound: { path: "/404.html", mediaType: "text/html; charset=utf-8", status: 404 },
  requiredCapabilities: ["response-headers.v1"],
};

async function artifact(files = FIXTURE, hostingRequirements = HOSTING_REQUIREMENTS) {
  const directory = await mkdtemp(path.join(tmpdir(), "superbee-docs-deployment-"));
  const rows = [];
  for (const [relative, { body, mediaType }] of Object.entries(files)) {
    const target = path.join(directory, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
    rows.push({ path: relative, mediaType, digest: sha256(Buffer.from(body)), size: Buffer.byteLength(body) });
  }
  await mkdir(path.join(directory, "data"), { recursive: true });
  const requirementsBody = `${JSON.stringify(hostingRequirements)}\n`;
  await writeFile(path.join(directory, "data", "hosting-requirements.json"), requirementsBody);
  rows.push({
    path: "data/hosting-requirements.json",
    mediaType: "application/json; charset=utf-8",
    digest: sha256(Buffer.from(requirementsBody)),
    size: Buffer.byteLength(requirementsBody),
  });
  await writeFile(path.join(directory, "data", "portal-manifest.json"), JSON.stringify({
    artifactDigest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    hostingRequirementsDigest: sha256(Buffer.from(requirementsBody)),
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
  assert.equal(deploymentConfigurationFiles({ files: [] }, HOSTING_REQUIREMENTS).get("_redirects"), rendered);
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

function effectiveHeaders(rendered, requestPath) {
  const effective = new Map();
  for (const rule of parseGeneratedHeaders(rendered)) {
    const star = rule.path.indexOf("*");
    const matches = star === -1
      ? requestPath === rule.path
      : requestPath.length >= rule.path.length - 1
        && requestPath.startsWith(rule.path.slice(0, star))
        && requestPath.endsWith(rule.path.slice(star + 1));
    if (!matches) continue;
    for (const line of rule.headers) {
      const colon = line.indexOf(":");
      const name = line.slice(0, colon).toLowerCase();
      assert.equal(effective.has(name), false, `${requestPath} receives ${name} twice`);
      effective.set(name, line.slice(colon + 1).trim());
    }
  }
  return effective;
}

test("only media type drift earns a rule, with uniform extensions and clean routes compressed", () => {
  /*
   * Cloudflare omits the declared charset from HTML and Markdown. The uniform HTML inventory earns
   * one extension splat plus its clean route aliases, while the lone Markdown path stays exact. A
   * content-addressed object with no type agrees with declared `application/octet-stream`.
   */
  assert.deepEqual(declaredMediaTypeOverrides(inventory(), HOSTING_REQUIREMENTS), [
    { path: "/", mediaType: "text/html; charset=utf-8" },
    { path: "/*.html", mediaType: "text/html; charset=utf-8" },
    { path: "/404", mediaType: "text/html; charset=utf-8" },
    { path: "/assets/unmeasured.zzz", mediaType: "application/json; charset=utf-8" },
    { path: "/bundle/learn/start-here.md", mediaType: "text/markdown; charset=utf-8" },
    { path: "/bundle/visuals/diagrams/example.svg", mediaType: "application/octet-stream" },
    { path: "/docs/*/", mediaType: "text/html; charset=utf-8" },
    { path: "/llms.txt", mediaType: "text/markdown; charset=utf-8" },
  ]);
});

test("a missing declared charset earns an exact override even when the MIME essence agrees", () => {
  assert.deepEqual(declaredMediaTypeOverrides({ files: [
    { path: "data/example.json", mediaType: "application/json; charset=utf-8" },
    { path: "sitemap.xml", mediaType: "application/xml; charset=utf-8" },
    { path: "robots.txt", mediaType: "text/plain; charset=utf-8" },
    { path: "index.html", mediaType: "text/html; charset=utf-8" },
  ] }), [
    { path: "/data/example.json", mediaType: "application/json; charset=utf-8" },
    { path: "/index.html", mediaType: "text/html; charset=utf-8" },
    { path: "/robots.txt", mediaType: "text/plain; charset=utf-8" },
    { path: "/sitemap.xml", mediaType: "application/xml; charset=utf-8" },
  ]);
});

test("rendered rules enforce declared global and disposition headers without duplicate values", () => {
  const manifest = inventory();
  const declared = new Map([
    ...manifest.files.map((file) => [`/${file.path}`, file.mediaType]),
    ["/data/portal-manifest.json", "application/json; charset=utf-8"],
  ]);
  const rendered = renderHeaders(manifest, HOSTING_REQUIREMENTS);
  const rules = parseGeneratedHeaders(rendered);
  assert.deepEqual(rules.find((rule) => rule.path === "/*").headers, [
    "Referrer-Policy: no-referrer",
    "X-Content-Type-Options: nosniff",
  ]);
  assert.deepEqual(rules.find((rule) => rule.path === "/docs/*").headers, [
    `Content-Security-Policy: ${SHELL_CSP}`,
  ]);
  assert.deepEqual(rules.find((rule) => rule.path === "/docs/*/").headers, [
    "Content-Type: text/html; charset=utf-8",
  ]);
  assert.deepEqual(rules.find((rule) => rule.path === "/bundle/views/example.html").headers, [
    `Content-Security-Policy: ${VIEW_CSP}`,
  ]);
  for (const path of [
    "/",
    "/404",
    "/docs/learn/start-here/",
    "/docs/not-published/",
    "/bundle/learn/start-here.md",
    "/assets/unmeasured.zzz",
    "/bundle/visuals/diagrams/example.svg",
    "/llms.txt",
  ]) {
    const artifactPath = path === "/"
      ? "/index.html"
      : path === "/404" || path === "/docs/not-published/"
        ? "/404.html"
        : path === "/docs/learn/start-here/"
          ? "/docs/learn/start-here/index.html"
          : path;
    assert.equal(effectiveHeaders(rendered, path).get("content-type"), declared.get(artifactPath), path);
  }
  assert.equal(new Set(rules.map((rule) => rule.path)).size, rules.length);
  for (const [requestPath, csp] of [
    ["/", SHELL_CSP],
    ["/docs/learn/start-here/", SHELL_CSP],
    ["/bundle/views/example.html", VIEW_CSP],
  ]) {
    const headers = effectiveHeaders(rendered, requestPath);
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    assert.equal(headers.get("referrer-policy"), "no-referrer");
    assert.equal(headers.get("content-security-policy"), csp);
  }
  assert.equal(deploymentConfigurationFiles(manifest, HOSTING_REQUIREMENTS).get("_headers"), rendered);
});

test("invalid, injected, duplicate, or over-budget header declarations fail the build", () => {
  assert.throws(() => renderHeaders({ files: [{ path: "llms.txt" }] }, HOSTING_REQUIREMENTS), /declares no media type/u);
  const requirements = (responseHeaders) => ({ ...HOSTING_REQUIREMENTS, responseHeaders });
  assert.throws(() => renderHeaders(inventory(), requirements([
    { route: "*", name: "Unsafe\nName", value: "value" },
  ])), /invalid declared response header name/u);
  assert.throws(() => renderHeaders(inventory(), requirements([
    { route: "*", name: "X-Test", value: "safe\r\nX-Evil: yes" },
  ])), /invalid value/u);
  assert.throws(() => renderHeaders(inventory(), requirements([
    { route: "*", name: "Content-Security-Policy", value: SHELL_CSP },
    { route: "shell", name: "Content-Security-Policy", value: SHELL_CSP },
  ])), /overlapping rules/u);
  const crowded = {
    files: Array.from({ length: 101 }, (_, index) => ({
      path: `bundle/raw/${index}`,
      mediaType: "text/html; charset=utf-8",
    })),
  };
  assert.throws(() => renderHeaders(crowded, { routes: [], responseHeaders: [] }), /at most 100 header rules/u);
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
      ...[...Object.keys(FIXTURE), "data/hosting-requirements.json", "data/portal-manifest.json", "_headers", "_redirects"].sort(),
    ]);
    for (const [relative, { body }] of Object.entries(FIXTURE)) {
      assert.equal(await readFile(path.join(output, ...relative.split("/")), "utf8"), body, relative);
    }
    assert.equal(await readFile(path.join(output, "_redirects"), "utf8"), renderRedirects());
    // A second assembly replaces its own previous output rather than refusing or accumulating.
    const again = await assembleDeployment({ artifact: dist, output });
    assert.deepEqual(again, receipt);
    assert.deepEqual(await tree(output), [
      ...[...Object.keys(FIXTURE), "data/hosting-requirements.json", "data/portal-manifest.json", "_headers", "_redirects"].sort(),
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
    const requirementsPath = path.join(dist, "data", "hosting-requirements.json");
    const requirementsBytes = await readFile(requirementsPath);
    await writeFile(requirementsPath, `${requirementsBytes.toString("utf8").trim()} \n`);
    await assert.rejects(assembleDeployment({ artifact: dist, output }), /hosting requirements do not match/u);

    await writeFile(requirementsPath, requirementsBytes);
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

test("the built deployment carries redirects, declared types, and declared response policy", async () => {
  // Requires a prior `npm run portal:build`, like every other check over the built outputs.
  const [redirects, headers, deployedIndex, publishedIndex, manifest, requirements] = await Promise.all([
    readFile("deploy/_redirects", "utf8"),
    readFile("deploy/_headers", "utf8"),
    readFile("deploy/index.html"),
    readFile("dist/index.html"),
    readFile("dist/data/portal-manifest.json", "utf8").then(JSON.parse),
    readFile("dist/data/hosting-requirements.json", "utf8").then(JSON.parse),
  ]);
  assert.equal(redirects, renderRedirects());
  assert.equal(headers, renderHeaders(manifest, requirements));
  assert.equal(Buffer.compare(deployedIndex, publishedIndex), 0);
  const published = new Map([
    ...manifest.files.map((file) => [file.path, file.mediaType]),
    ["data/portal-manifest.json", "application/json; charset=utf-8"],
  ]);
  for (const rule of DEPLOYMENT_REDIRECTS) {
    // A redirect over a path the artifact publishes would shadow a real page.
    assert.equal(published.has(rule.from.replace(/^\//, "")), false, rule.from);
  }
  const rules = parseGeneratedHeaders(headers);
  const covered = new Set(rules
    .filter((rule) => rule.headers.some((header) => header.startsWith("Content-Type:")))
    .map((rule) => rule.path));
  for (const pattern of ["/*.css", "/*.html", "/*.js", "/*.json", "/*.md", "/*.mmd", "/docs/*/"]) {
    assert.ok(covered.has(pattern), pattern);
  }
  for (const [route, relative] of [
    ["/", "index.html"],
    ["/404", "404.html"],
    ["/docs/learn/start-here/", "docs/learn/start-here/index.html"],
    ["/docs/superbee-portal-verify/unknown-route/", "404.html"],
    ["/404.md", "404.md"],
    ["/assets/portal-client-v1.js", "assets/portal-client-v1.js"],
    ["/llms.txt", "llms.txt"],
    ["/robots.txt", "robots.txt"],
    ["/sitemap.xml", "sitemap.xml"],
    ["/data/portal-manifest.json", "data/portal-manifest.json"],
  ]) {
    assert.equal(effectiveHeaders(headers, route).get("content-type"), published.get(relative), route);
  }
  for (const [relative, mediaType] of published) {
    if (["css", "html", "js", "json", "md", "mmd"].includes(relative.split(".").at(-1))) {
      assert.equal(effectiveHeaders(headers, `/${relative}`).get("content-type"), mediaType, relative);
    }
  }
  for (const declaration of requirements.responseHeaders.filter((header) => header.route === "*")) {
    for (const route of ["/", "/llms.txt", "/data/portal-manifest.json", "/bundle/views/architecture-at-a-glance.html"]) {
      assert.equal(effectiveHeaders(headers, route).get(declaration.name.toLowerCase()), declaration.value, route);
    }
  }
  const shellPolicy = requirements.responseHeaders.find((header) => header.route === "shell");
  const viewPolicy = requirements.responseHeaders.find((header) => header.route === "view");
  assert.equal(effectiveHeaders(headers, "/docs/learn/start-here/").get("content-security-policy"), shellPolicy.value);
  assert.equal(effectiveHeaders(headers, "/bundle/views/architecture-at-a-glance.html").get("content-security-policy"), viewPolicy.value);
});
