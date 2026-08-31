import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readPortalWebMcpBrowserAssetV0 } from "@superbee/portal-webmcp/asset/v0";
import { readPortalClientBrowserAssetV2 } from "superbee-portal/client/v2/asset";

import { composeDocumentationOutputs } from "../scripts/documentation-outputs.mjs";
// The real resolver, imported rather than reimplemented. It lives in its own module precisely so
// this import is possible: the bootstrap resolves its dependencies by absolute site URL, which no
// test runner can follow.
import { presentationUrlResolverFor } from "../assets/superbee-webmcp-routes.js";

const decoder = new TextDecoder();
const BOOTSTRAP = "assets/superbee-webmcp.js";
const CLIENT = "assets/portal-client-v2.js";
const TOOLS = "assets/portal-webmcp-v0.js";
const ROUTES = "assets/superbee-webmcp-routes.js";

let composed;
let temporary;

test("compose the documentation outputs once for this file", async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "superbee-docs-webmcp-"));
  composed = await composeDocumentationOutputs({ mkdocsOutput: temporary });
  assert.ok(composed.artifact, "the artifact must be composed");
});

test("all four agent-tool files are published with the bytes they are built from", async () => {
  const files = composed.artifact.files;
  for (const published of [BOOTSTRAP, CLIENT, TOOLS, ROUTES]) {
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
  // The routes module is published, but the tests import it from the SOURCE tree. Without this
  // the two could diverge: a corrupted published copy fails at import in the browser, killing
  // activation, while every test still passes against the source it never shipped.
  const routesSource = await readFile(new URL("../assets/superbee-webmcp-routes.js", import.meta.url));
  assert.ok(Buffer.from(files.get(ROUTES)).equals(routesSource),
    "the published routes module must be the bytes the tests execute");
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

test("the resolver emits a URL for exactly the documents that have a page", () => {
  // Runs the REAL resolver, not a copy of its rule. An earlier version of this test computed the
  // paged set from the manifest itself and asserted properties of that, which meant a resolver
  // that emitted for every document - the defect this feature already shipped once - and a
  // resolver that emitted for none both passed. Driving the actual function is the only way the
  // suite can tell those three apart.
  const manifest = JSON.parse(decoder.decode(composed.artifact.files.get("data/portal-manifest.json")));
  const readModel = JSON.parse(decoder.decode(composed.artifact.files.get("data/bundle.json")));
  const resolve = presentationUrlResolverFor({ manifest });

  let emitted = 0;
  for (const document of readModel.documents) {
    const url = resolve({ kind: "document", id: document.id });
    const page = `docs/${document.id}/index.html`;
    const hasPage = Boolean(composed.artifact.files.get(page));
    // The biconditional is the whole contract: a URL exactly when there is a page behind it.
    if (hasPage) {
      assert.equal(url, `/docs/${document.id.split("/").map(encodeURIComponent).join("/")}/`,
        `${document.id} has a page and must get its URL`);
      emitted += 1;
    } else {
      assert.equal(url, undefined, `${document.id} has no page, so it must get no URL`);
    }
  }
  assert.ok(emitted > 0, "some documents must get a URL");
  assert.ok(emitted < readModel.documents.length, "some documents must get none, or the resolver is not discriminating");
});

test("the pinned Portal builds a manifest that lists nothing it did not publish", () => {
  // Within one build this is close to tautological: Portal derives the inventory from the same
  // file map it returns. It is kept for the seam it does guard - the PINNED dependency. If a
  // future Portal ever listed a path it did not write, the resolver would emit a URL for it and
  // this fires first, with the offending path named: a phantom entry in that inventory trips it.
  //
  // It catches OVER-listing only. Under-listing - a manifest omitting a page that exists - is
  // caught by the biconditional above, which reads artifact.files while the resolver reads the
  // parsed manifest. Two different objects, which is also what makes that test non-circular.
  // Either alone leaves one direction open.
  const manifest = JSON.parse(decoder.decode(composed.artifact.files.get("data/portal-manifest.json")));
  const actual = new Set([...composed.artifact.files.keys()]);
  const listedButAbsent = manifest.files.map((file) => file.path).filter((file) => !actual.has(file));
  assert.deepEqual(listedButAbsent, [], "the manifest lists files the artifact does not contain");
});

test("the bootstrap actually wires the tested resolver into the tool set", () => {
  // Executing the resolver proves the RULE. It proves nothing about whether the shipped page uses
  // it. Both halves of this wiring can be broken without touching the routes module: swapping in a
  // naive resolver ships the 404 defect, and dropping the policy id makes createPortalWebMcpToolsV0
  // throw INVALID_INPUT, which activate()'s catch downgrades to a console.warn - so the tools never
  // register on any page and nothing else notices.
  //
  // A grep is the wrong tool for a behavioural rule, which is why the resolver itself is executed.
  // It is the proportionate tool for a one-line syntactic identity like this, where the executable
  // alternative is a stubbed module graph that would cost more than it guards.
  const bootstrap = decoder.decode(composed.artifact.files.get(BOOTSTRAP));
  assert.match(bootstrap, /\{\s*presentationUrlResolverFor\s*\}\s*=\s*await\s+import\(\s*["']\/assets\/superbee-webmcp-routes\.js["']\s*\)/u,
    "the bootstrap must import the resolver that the tests execute");
  assert.match(bootstrap, /presentationUrlFor:\s*presentationUrlResolverFor\(\s*publication\s*\)/u,
    "the bootstrap must pass that resolver, not one written inline");
  assert.match(bootstrap, /presentationUrlPolicyId:\s*\w/u,
    "a resolver without a policy id makes tool construction throw, and the tools never register");
});

test("the resolver declines a View, which this site publishes no page for", () => {
  const manifest = JSON.parse(decoder.decode(composed.artifact.files.get("data/portal-manifest.json")));
  const resolve = presentationUrlResolverFor({ manifest });
  const views = JSON.parse(decoder.decode(composed.artifact.files.get("data/bundle.json"))).views ?? [];
  assert.ok(views.length > 0, "the site must publish admitted Views to check");
  for (const view of views) {
    assert.equal(resolve({ kind: "view", id: view.id }), undefined, `View ${view.id} must get no URL`);
  }
  // Real View ids live under a prefix with no documentation page, so the loop above is satisfied by
  // the manifest lookup missing rather than by the kind guard. This exercises the guard itself: an
  // id that WOULD resolve as a document must still be declined as a View.
  const stub = { manifest: { files: [{ path: "docs/x/index.html" }] } };
  assert.equal(presentationUrlResolverFor(stub)({ kind: "view", id: "x" }), undefined,
    "a View must be declined even when its id would resolve as a document");
  assert.equal(presentationUrlResolverFor(stub)({ kind: "document", id: "x" }), "/docs/x/",
    "and the same id as a document must still resolve, or the check above proves nothing");
});

test("every URL the resolver emits is a route the deployment actually declares", () => {
  // The invariant that matters spans further than the artifact: a URL is only good if the host
  // serves it. The artifact's own hosting requirements are what the deployment is built from, so
  // this checks the emitted URLs against that declaration rather than against the file map they
  // were derived from, which would be circular.
  const manifest = JSON.parse(decoder.decode(composed.artifact.files.get("data/portal-manifest.json")));
  const readModel = JSON.parse(decoder.decode(composed.artifact.files.get("data/bundle.json")));
  const declared = new Map(composed.artifact.hostingRequirements.routes.map((route) => [route.pattern, route]));
  const resolve = presentationUrlResolverFor({ manifest });

  const emitted = readModel.documents
    .map((document) => ({ id: document.id, url: resolve({ kind: "document", id: document.id }) }))
    .filter((row) => row.url);
  assert.ok(emitted.length > 0, "the resolver must emit something to check");
  for (const { id, url } of emitted) {
    const route = declared.get(url);
    assert.ok(route, `the resolver emits ${url}, which the deployment does not declare`);
    // Declared is not enough: it must serve the page for THIS document, not a redirect or a
    // different file that merely answers at the same URL.
    assert.equal(route.disposition, "shell", `${url} is declared but not served as a page`);
    assert.equal(route.artifactPath, `docs/${id}/index.html`, `${url} does not serve ${id}`);
  }
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
