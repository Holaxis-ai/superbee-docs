import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import test from "node:test";

import puppeteer from "puppeteer";

import { readPortalWebMcpBrowserAssetV0 } from "@superbee/portal-webmcp/asset/v0";
import { readPortalClientBrowserAssetV2 } from "@superbee/portal/client/v2/asset";

import { composeDocumentationOutputs } from "../scripts/documentation-outputs.mjs";
// The real resolver, imported rather than reimplemented. It lives in its own module precisely so
// this import is possible without a browser. The wiring itself is checked by executing the
// published bootstrap, which is the only thing that can see a runtime activation failure.
import { presentationUrlResolverFor } from "../assets/superbee-webmcp-routes.js";

const decoder = new TextDecoder();
const BOOTSTRAP = "assets/superbee-webmcp.js";
const CLIENT = "assets/portal-client-v2.js";
const TOOLS = "assets/portal-webmcp-v0.js";
const ROUTES = "assets/superbee-webmcp-routes.js";
// One document the site renders as a page and one it does not, so a wired resolver can be told
// apart from an inline one that answers the same way for both.
const PAGED_DOCUMENT = "learn/start-here";
const UNPAGED_DOCUMENT = "maintenance/documentation-triggers/architecture-at-a-glance";

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
  for (const required of [`/${CLIENT}`, `/${TOOLS}`, `/${ROUTES}`]) {
    assert.ok(specifiers.includes(required), `the bootstrap must import ${required}`);
  }
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

test("the published bootstrap really registers the tools in a browser", { timeout: 90_000 }, async () => {
  // Executed, not grepped. An earlier version asserted the wiring with regexes over the bootstrap
  // source, on the stated grounds that absolute site imports are something no test runner can
  // resolve. That was false, and a reviewer disproved it by running the published bytes. Greps let
  // two wiring defects through: `presentationUrlPolicyId: null` satisfied a `\w` pattern while
  // making tool construction throw, and deleting the publication client left the specifier count
  // high enough to pass while activation died on a ReferenceError. Both are runtime failures that
  // only a runtime check can see.
  const files = composed.artifact.files;
  const server = createServer((request, response) => {
    const requested = new URL(request.url ?? "/", "http://localhost").pathname.replace(/^\//, "");
    const bytes = files.get(requested) ?? files.get(`${requested.replace(/\/$/, "")}/index.html`);
    if (!bytes) { response.statusCode = 404; response.end("missing"); return; }
    response.setHeader("Content-Type", requested.endsWith(".js")
      ? "text/javascript; charset=utf-8"
      : requested.endsWith(".json") ? "application/json; charset=utf-8" : "text/html; charset=utf-8");
    response.end(Buffer.from(bytes));
  });
  await new Promise((listening) => server.listen(0, "127.0.0.1", listening));
  const address = server.address();
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "shell",
      args: process.env.CI === "true" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
    });
    const page = await browser.newPage();
    // A stand-in host, installed before any page script runs, that records what gets registered.
    await page.evaluateOnNewDocument(() => {
      globalThis.__registered = [];
      globalThis.__warnings = [];
      const warn = console.warn.bind(console);
      console.warn = (...parts) => { globalThis.__warnings.push(parts.map(String).join(" ")); warn(...parts); };
      globalThis.__tools = new Map();
      document.modelContext = {
        async registerTool(tool) {
          globalThis.__registered.push(tool.name);
          globalThis.__tools.set(tool.name, tool);
          return undefined;
        },
      };
    });
    await page.goto(`http://127.0.0.1:${address.port}/docs/learn/start-here/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => globalThis.__registered.length > 0 || globalThis.__warnings.length > 0,
      { timeout: 30_000 });

    const warnings = await page.evaluate(() => globalThis.__warnings);
    assert.deepEqual(warnings, [], "activation must not warn on a correctly wired page");
    const registered = await page.evaluate(() => globalThis.__registered);
    assert.deepEqual(new Set(registered), new Set([
      "superbee_describe_bundle",
      "superbee_search_documents",
      "superbee_get_document",
      "superbee_list_documents",
      "superbee_list_document_facets",
      "superbee_get_relationships",
      "superbee_list_views",
    ]));
    for (const name of registered) {
      assert.match(name, /^superbee_/u, "every registered tool must use the reserved prefix");
    }

    // Registration alone does not prove the right resolver was wired in: an inline resolver that
    // emits a URL for every document registers exactly as cleanly and ships broken links. So call
    // a tool and read what it actually emits, for one document that has a page and one that does
    // not. This is the assertion that makes the browser test a wiring check rather than a smoke
    // test, and it replaces a grep that caught the same defect more cheaply but less honestly.
    const emitted = await page.evaluate(async ([paged, unpaged]) => {
      const tool = globalThis.__tools.get("superbee_get_document");
      const read = async (id) => {
        const result = await tool.execute({ id });
        const text = result?.content?.[0]?.text ?? JSON.stringify(result);
        return JSON.parse(text);
      };
      return { paged: await read(paged), unpaged: await read(unpaged) };
    }, [PAGED_DOCUMENT, UNPAGED_DOCUMENT]);

    assert.equal(emitted.paged.data?.presentationUrl, `/docs/${PAGED_DOCUMENT}/`,
      "a document with a page must carry its page URL");
    assert.equal(emitted.unpaged.data?.presentationUrl, undefined,
      "a document with no page must carry no URL, or the wrong resolver is wired in");
  } finally {
    if (browser) await browser.close();
    await new Promise((closed) => server.close(closed));
  }
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
