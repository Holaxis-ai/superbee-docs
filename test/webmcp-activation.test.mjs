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
  const specifiers = [...source.matchAll(/from\s*["'](\/[^"']+)["']/gu)].map((match) => match[1]);
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

test("no presentation URL is emitted, because this site cannot answer that honestly", () => {
  // The read model carries the complete public bundle, which is strictly larger than the set
  // rendered as pages, and it marks no difference between them. The obvious resolver would emit a
  // confident URL that 404s. This measures that gap rather than describing it, so if the site ever
  // does publish a page for every document, this test fails and the decision gets revisited on
  // evidence instead of staying a permanent comment.
  const readModel = JSON.parse(decoder.decode(composed.artifact.files.get("data/bundle.json")));
  const pageFor = (id) => `docs/${id.split("/").map(encodeURIComponent).join("/")}/index.html`;
  const unpaged = readModel.documents.filter((document) => !composed.artifact.files.get(pageFor(document.id)));
  assert.ok(unpaged.length > 0,
    "every read-model document now has a page, so a presentation URL resolver may be worth adding");
  assert.ok(readModel.documents.length > documentationPages(composed.artifact).length,
    "the read model must still be larger than the page set");

  // And the bootstrap must not quietly acquire one.
  const bootstrap = decoder.decode(composed.artifact.files.get(BOOTSTRAP));
  assert.doesNotMatch(bootstrap, /presentationUrlFor\s*[:,)]/u, "the bootstrap must supply no presentation URL resolver");
  assert.doesNotMatch(bootstrap, /presentationUrlPolicyId/u, "a policy id without a resolver would be meaningless");
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
