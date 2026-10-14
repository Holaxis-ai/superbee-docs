import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import test from "node:test";

import puppeteer from "puppeteer";

import { siteToolDescriptors } from "@superbee/agent-operations/read-tools";
import { readPortalWebMcpBrowserAssetsV2 } from "@superbee/portal-webmcp/asset/v2";

import { AGENT_RATE_LIMIT_BINDING, AGENT_SECRET_BINDING } from "../scripts/agent-access-config.mjs";
import {
  composeDocumentationOutputs,
  WEBMCP_ENDPOINT,
  WEBMCP_PAGE_OWNER,
} from "../scripts/documentation-outputs.mjs";

const decoder = new TextDecoder();
const BOOTSTRAP = "assets/superbee-webmcp.js";
const FORWARDER = "assets/portal-webmcp-v2.js";
const LIST = "assets/portal-webmcp-v2-tools.js";
const FIVE = ["inspect_bundle", "query_documents", "read_bundle_graph", "read_document", "search_documents"];

let composed;
let temporary;

test("compose the documentation outputs once for this file", async () => {
  temporary = await mkdtemp(path.join(tmpdir(), "superbee-docs-webmcp-"));
  composed = await composeDocumentationOutputs({ mkdocsOutput: temporary });
  assert.ok(composed.artifact, "the artifact must be composed");
});

test("the forwarder, the tool list and the bootstrap are published with the bytes they are built from", async () => {
  const files = composed.artifact.files;
  for (const published of [BOOTSTRAP, FORWARDER, LIST]) {
    assert.ok(files.get(published), `${published} must be published`);
    assert.ok(files.get(published).byteLength > 0, `${published} must not be empty`);
  }
  // Derived from the package's own accessor, so a package that changes its asset moves this test
  // with it instead of leaving a stale literal behind.
  const [forwarder, list] = await readPortalWebMcpBrowserAssetsV2({
    version: 2, owner: WEBMCP_PAGE_OWNER, endpoint: WEBMCP_ENDPOINT, tools: siteToolDescriptors(),
  });
  assert.equal(forwarder.path, FORWARDER);
  assert.equal(list.path, LIST);
  assert.ok(Buffer.from(files.get(FORWARDER)).equals(Buffer.from(forwarder.bytes)), "the published forwarder is the package's forwarder");
  assert.ok(Buffer.from(files.get(LIST)).equals(Buffer.from(list.bytes)), "the published list is the one built from the kernel's descriptors");
});

test("no version 0 or 1 activation or asset is published: one WebMCP version per page", () => {
  const files = [...composed.artifact.files.keys()];
  for (const retired of ["assets/portal-webmcp-v0.js", "assets/portal-client-v2.js", "assets/superbee-webmcp-routes.js"]) {
    assert.ok(!files.includes(retired), `${retired} must not be published`);
  }
  const bootstrap = decoder.decode(composed.artifact.files.get(BOOTSTRAP));
  assert.doesNotMatch(bootstrap, /activatePortalWebMcpV[01]|registerPortalWebMcpV0|createPortalWebMcpTools/u);
});

test("the tool list is the five kernel tools, read-only, pointed at this site's own endpoint", async () => {
  const source = decoder.decode(composed.artifact.files.get(LIST));
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const { default: config } = await import(dataUrl);
  assert.equal(config.version, 2);
  assert.equal(config.owner, WEBMCP_PAGE_OWNER);
  assert.equal(config.endpoint, "/mcp");
  assert.deepEqual(config.tools.map((tool) => tool.name).sort(), FIVE);
  for (const tool of config.tools) assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
  assert.equal(config.tools.find((tool) => tool.name === "search_documents").annotations.privateInputHint, true,
    "a search query stays in a POST body");
});

test("every URL the bootstrap imports is a file this site actually publishes", () => {
  // The bootstrap names its imports as absolute site URLs, and the contribution names the files it
  // publishes, in two different source files. Nothing but this test makes those agree, and a
  // mismatch would not fail any build: it would 404 in the visitor's browser and the tools would
  // silently never register.
  const source = decoder.decode(composed.artifact.files.get(BOOTSTRAP));
  // Both static (`from "/..."`) and dynamic (`import("/...")`) forms, because deferring an import is a
  // natural future change and a dynamic specifier left unguarded would reopen exactly the gap this
  // test closes.
  const specifiers = [...source.matchAll(/(?:from|\bimport)\s*\(?\s*["'](\/[^"']+)["']/gu)].map((match) => match[1]);
  for (const required of [`/${FORWARDER}`, `/${LIST}`]) {
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
    // The forwarder and the list are imported BY the bootstrap. Linking them from the page as well
    // would execute library code that registers nothing.
    assert.ok(!page.includes(FORWARDER), `${file} must not link the forwarder directly`);
    assert.ok(!page.includes(LIST), `${file} must not link the list directly`);
  }
});

test("the published bootstrap registers the five tools with no request, and each call is one POST that the real Worker answers", { timeout: 90_000 }, async () => {
  // Executed, not grepped: the wiring is a runtime fact. The server below is the page's origin; it
  // serves the artifact and records every full URL so "no request at registration" is measured.
  // /mcp is answered by the REAL Worker (scripts/cloudflare-worker.mjs), not a canned response, so
  // the forwarder's actual request shape is what the handler sees. Only the two Cloudflare bindings
  // are stand-ins: static assets read the composed artifact, and the limiter admits everything.
  const files = composed.artifact.files;
  const requests = [];
  const worker = (await import("../scripts/cloudflare-worker.mjs")).default;
  const env = {
    ASSETS: {
      async fetch(request) {
        const pathname = decodeURIComponent(new URL(request.url).pathname).replace(/^\//, "");
        const bytes = files.get(pathname) ?? files.get(`${pathname.replace(/\/$/, "")}/index.html`);
        return bytes ? new Response(Buffer.from(bytes)) : new Response("missing", { status: 404 });
      },
    },
    [AGENT_RATE_LIMIT_BINDING]: { async limit() { return { success: true }; } },
    [AGENT_SECRET_BINDING]: "dummy-local-secret-for-tests-only",
  };
  let forwarded = 0;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    const requested = url.pathname.replace(/^\//, "");
    if (requested === "mcp") {
      forwarded += 1;
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const answered = await worker.fetch(new Request(`http://${request.headers.host}/mcp`, {
        method: request.method, headers: request.headers, body: Buffer.concat(chunks),
      }), env);
      response.statusCode = answered.status;
      answered.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(Buffer.from(await answered.arrayBuffer()));
      return;
    }
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
    // defineProperty, not assignment: current Chromium has a native document.modelContext.
    await page.evaluateOnNewDocument(() => {
      globalThis.__registered = [];
      globalThis.__warnings = [];
      const warn = console.warn.bind(console);
      console.warn = (...parts) => { globalThis.__warnings.push(parts.map(String).join(" ")); warn(...parts); };
      globalThis.__tools = new Map();
      Object.defineProperty(document, "modelContext", {
        configurable: true,
        value: {
          async registerTool(tool) {
            globalThis.__registered.push(tool.name);
            globalThis.__tools.set(tool.name, tool);
            return undefined;
          },
        },
      });
    });
    await page.goto(`http://127.0.0.1:${address.port}/docs/learn/start-here/`, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => globalThis.__registered.length > 0 || globalThis.__warnings.length > 0,
      { timeout: 30_000 });

    assert.deepEqual(await page.evaluate(() => globalThis.__warnings), [], "activation must not warn on a correctly wired page");
    const registered = await page.evaluate(() => globalThis.__registered);
    assert.deepEqual([...registered].sort(), FIVE);
    assert.deepEqual(requests.filter((entry) => /\/mcp|\/api\/v1/u.test(entry)), [],
      "registration makes no request to the endpoint");
    assert.ok(!requests.some((entry) => /\/data\/(?:bundle|snapshot)\.json/u.test(entry)),
      "a version 2 page loads no read model");

    const search = await page.evaluate(async () => globalThis.__tools.get("search_documents").execute({ query: "install" }));
    assert.deepEqual(requests.filter((entry) => /\/mcp|\/api\/v1/u.test(entry)), ["POST /mcp"],
      "one call is one POST to /mcp, with no query string, so the input never rides in a URL");
    assert.equal(forwarded, 1);
    assert.equal(search.ok, true, `the real Worker's structured answer comes back: ${JSON.stringify(search).slice(0, 300)}`);
    assert.equal(search.operationId, "documents.search.v1");
    assert.ok(Array.isArray(search.data.hits) && search.data.hits.length > 0, "search finds documents");

    const inspected = await page.evaluate(async () => globalThis.__tools.get("inspect_bundle").execute({}));
    assert.equal(inspected.ok, true);
    assert.equal(inspected.data.bundle.bundleId, "superbee-docs");
  } finally {
    if (browser) await browser.close();
    await new Promise((closed) => server.close(closed));
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
