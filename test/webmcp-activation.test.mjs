import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readPortalWebMcpBrowserAssetV0 } from "@superbee/portal-webmcp/asset/v0";
import { readPortalClientBrowserAssetV2 } from "superbee-portal/client/v2/asset";

import { composeDocumentationOutputs } from "../scripts/documentation-outputs.mjs";

const decoder = new TextDecoder();
const BOOTSTRAP = "assets/superbee-webmcp.js";
const CLIENT = "assets/portal-client-v2.js";
const TOOLS = "assets/portal-webmcp-v0.js";

let composed;
let temporary;

test("compose the documentation outputs once for this file", async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "superbee-docs-webmcp-"));
  composed = await composeDocumentationOutputs({ mkdocsOutput: temporary });
  assert.ok(composed.artifact, "the artifact must be composed");
});

test("all three agent-tool files are published with the bytes their packages ship", async () => {
  const files = composed.artifact.files;
  for (const published of [BOOTSTRAP, CLIENT, TOOLS]) {
    assert.ok(files.get(published), `${published} must be published`);
    assert.ok(files.get(published).byteLength > 0, `${published} must not be empty`);
  }
  // Derived from each package's own accessor, so a package that changes its asset moves this test
  // with it instead of leaving a stale literal behind.
  const [client, tools] = await Promise.all([readPortalClientBrowserAssetV2(), readPortalWebMcpBrowserAssetV0()]);
  assert.ok(Buffer.from(files.get(CLIENT)).equals(Buffer.from(client.bytes)), "the published client is the package's client");
  assert.ok(Buffer.from(files.get(TOOLS)).equals(Buffer.from(tools.bytes)), "the published tools are the package's tools");
  assert.equal(CLIENT, client.path, "the client is published at the path its package declares");
  assert.equal(TOOLS, tools.path, "the tools are published at the path their package declares");
});

test("every URL the bootstrap imports is a file this site actually publishes", () => {
  // The bootstrap names its imports as absolute site URLs, and the contribution names the files it
  // publishes, in two different source files. Nothing but this test makes those agree, and a
  // mismatch would not fail any build: it would 404 in the visitor's browser and the tools would
  // silently never register.
  const source = decoder.decode(composed.artifact.files.get(BOOTSTRAP));
  // Both static (`from "/…"`) and dynamic (`import("/…")`) forms, because deferring an import is a
  // natural future change and a dynamic specifier left unguarded would reopen exactly the gap this
  // test closes.
  const specifiers = [...source.matchAll(/(?:from|\bimport)\s*\(?\s*["'](\/[^"']+)["']/gu)].map((match) => match[1]);
  assert.ok(specifiers.length >= 2, "the bootstrap must import the two Portal assets");
  for (const specifier of specifiers) {
    const published = specifier.replace(/^\//, "");
    assert.ok(composed.artifact.files.get(published), `the bootstrap imports ${specifier}, which is not published`);
  }
});

/** Pages this site's documentation presentation renders: the home page and every documented page. */
function documentationPages(artifact) {
  return [...artifact.files]
    .filter(([file]) => file === "index.html" || file.startsWith("docs/"))
    .map(([file, bytes]) => [file, decoder.decode(bytes)]);
}

test("only the bootstrap is linked, and only from documentation pages", () => {
  const documentation = documentationPages(composed.artifact);
  assert.ok(documentation.length > 50, "the site must publish its documentation pages");
  for (const [file, page] of documentation) {
    assert.equal((page.match(/superbee-webmcp\.js/gu) ?? []).length, 1, `${file} links the bootstrap exactly once`);
    assert.ok(page.includes(`<script type="module" src="/${BOOTSTRAP}"></script>`), `${file} links it as a module`);
    // The two library assets are imported BY the bootstrap. Linking them from the page as well
    // would execute library code that registers nothing.
    assert.ok(!page.includes(CLIENT), `${file} must not link the client directly`);
    assert.ok(!page.includes(TOOLS), `${file} must not link the tools directly`);
  }
});

test("the manifest inventory the resolver trusts is exactly what the site publishes", () => {
  // The bootstrap decides which documents get a presentation URL by asking the artifact manifest
  // which files exist. That is only safe while the manifest is a truthful inventory, so this
  // checks the property the resolver rests on rather than restating the resolver's own rule.
  const manifest = JSON.parse(decoder.decode(composed.artifact.files.get("data/portal-manifest.json")));
  const listed = new Set(manifest.files.map((file) => file.path));
  const actual = new Set([...composed.artifact.files.keys()]);
  const listedButAbsent = [...listed].filter((file) => !actual.has(file));
  assert.deepEqual(listedButAbsent, [], "the manifest lists files the site does not publish");

  // And the resolver must genuinely discriminate: some documents have a page and some do not, so
  // a rule that answered the same way for every document would be wrong either way.
  const readModel = JSON.parse(decoder.decode(composed.artifact.files.get("data/bundle.json")));
  const route = (id) => `docs/${id.split("/").map(encodeURIComponent).join("/")}/index.html`;
  const paged = readModel.documents.filter((document) => listed.has(route(document.id)));
  assert.ok(paged.length > 0, "some documents must have a page");
  assert.ok(paged.length < readModel.documents.length, "some documents must have none");
  // Every URL the resolver would emit resolves to a file that exists.
  for (const document of paged) {
    assert.ok(composed.artifact.files.get(route(document.id)), `${document.id} would get a URL with no page behind it`);
  }
});

test("the resolver is driven by the manifest, not by a list that could drift", () => {
  const bootstrap = decoder.decode(composed.artifact.files.get(BOOTSTRAP));
  assert.match(bootstrap, /manifest\.files/u,
    "the resolver must consult the artifact manifest rather than a hardcoded route list");
  assert.match(bootstrap, /presentationUrlPolicyId/u, "a resolver requires a stable policy id");
});

test("the recovery shell stays usable with no JavaScript at all", () => {
  const recovery = decoder.decode(composed.artifact.files.get("404.html"));
  assert.equal((recovery.match(/<script\b/gu) ?? []).length, 0, "the recovery shell must carry no script");
  assert.ok(recovery.includes('href="/llms.txt"'), "it still points an agent at the entry point");
});

test("Portal-owned View pages are untouched by this activation", () => {
  // View entry pages are rendered by Portal, not by the documentation presentation, so the
  // bootstrap cannot reach them and the tools are absent there. Pinned rather than merely excluded
  // from the check above, so that if View pages ever did start carrying it, that is a decision
  // somebody made instead of a change nobody noticed.
  const views = [...composed.artifact.files]
    .filter(([file]) => file.startsWith("bundle/") && file.endsWith(".html"));
  assert.ok(views.length > 0, "the site must publish its admitted View pages");
  for (const [file, bytes] of views) {
    assert.ok(!decoder.decode(bytes).includes("superbee-webmcp.js"), `${file} must not link the bootstrap`);
  }
});

test("release the composed outputs", async () => {
  if (temporary) await rm(temporary, { recursive: true, force: true });
});
