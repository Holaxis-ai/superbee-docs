import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// A fresh handler per test: the endpoint keeps its binding and verified artifact for the life of
// an isolate, as in production, so a test that swaps the environment needs its own instance.
let instance = 0;
const workers = new WeakMap();
const send = async (env, request) => {
  if (!workers.has(env)) workers.set(env, (await import(`../scripts/cloudflare-worker.mjs?instance=${instance += 1}`)).default);
  return workers.get(env).fetch(request, env);
};

// The Worker runs here exactly as Wrangler runs it, in front of the built Portal artifact (`dist`)
// that the deployment assembles into `deploy`. Only the two Cloudflare bindings are stand-ins: the
// static-assets binding reads `dist`, and the rate limiter admits a fixed number of calls. The
// secret is a dummy; the live one is the owner's `wrangler secret put AGENT_IP_HASH_SECRET`.
const TYPES = new Map([[".json", "application/json"], [".html", "text/html"], [".js", "text/javascript"],
  [".css", "text/css"], [".txt", "text/plain"], [".xml", "application/xml"], [".md", "text/markdown"],
  [".svg", "image/svg+xml"], [".png", "image/png"]]);

function environment(allowed = Infinity) {
  let used = 0;
  return {
    ASSETS: {
      async fetch(request) {
        const { pathname } = new URL(request.url);
        const relative = decodeURIComponent(pathname).replace(/^\/+/u, "") || "index.html";
        const candidates = [relative, path.join(relative, "index.html"), `${relative}.html`];
        for (const candidate of candidates) {
          if (candidate.includes("..")) break;
          try {
            const bytes = await readFile(path.join("dist", candidate));
            return new Response(bytes, { headers: { "Content-Type": TYPES.get(path.extname(candidate)) ?? "application/octet-stream" } });
          } catch { /* try the next candidate */ }
        }
        return new Response("Not found", { status: 404 });
      },
    },
    AGENT_LIMITER: { async limit() { used += 1; return { success: used <= allowed }; } },
    AGENT_IP_HASH_SECRET: "dummy-local-secret-for-tests-only",
  };
}

const HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" };
const rpc = (env, body, headers = HEADERS) => send(env, new Request("https://docs.test/mcp", {
  method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
}));
const call = async (env, name, args) => {
  const response = await rpc(env, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  assert.equal(response.status, 200);
  const { result } = await response.json();
  return { isError: result.isError === true, data: JSON.parse(result.content[0].text) };
};

test("initialize names the Docs server", async () => {
  const response = await rpc(environment(), { jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
  assert.equal(response.status, 200);
  const { result } = await response.json();
  assert.equal(result.serverInfo.name, "superbee-docs");
  assert.equal(result.serverInfo.websiteUrl, "https://docs.getsuperbee.com");
});

test("tools/list serves exactly the five read-only site tools", async () => {
  const response = await rpc(environment(), { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const { result } = await response.json();
  assert.deepEqual(result.tools.map((tool) => tool.name).sort(),
    ["inspect_bundle", "query_documents", "read_bundle_graph", "read_document", "search_documents"]);
  for (const tool of result.tools) assert.equal(tool.annotations.readOnlyHint, true, tool.name);
});

test("one search, one read and one graph read answer from the published artifact", async () => {
  const env = environment();
  const inspected = await call(env, "inspect_bundle", {});
  assert.equal(inspected.isError, false);
  assert.equal(inspected.data.data.bundle.bundleId, "superbee-docs");

  const searched = await call(env, "search_documents", { query: "install superbee", limit: 3 });
  assert.equal(searched.isError, false);
  assert.ok(searched.data.data.hits.length > 0, "search finds documents");

  const read = await call(env, "read_document", { documentId: "learn/start-here" });
  assert.equal(read.isError, false);
  assert.equal(read.data.data.document.id, "learn/start-here");
  assert.match(read.data.data.document.body, /Superbee/u);

  const graph = await call(env, "read_bundle_graph", {});
  assert.equal(graph.isError, false);
  assert.equal(graph.data.data.bundleId, "superbee-docs");
});

test("the GET API and OpenAPI answer, and search is POST only", async () => {
  const env = environment();
  const query = await send(env, new Request("https://docs.test/api/v1/query_documents?prefix=learn/&limit=2"));
  assert.equal(query.status, 200);
  assert.equal((await query.json()).ok, true);
  const openapi = await send(env, new Request("https://docs.test/api/v1/openapi.json"));
  assert.equal(openapi.status, 200);
  assert.equal((await openapi.json()).openapi, "3.1.0");
  const search = await send(env, new Request("https://docs.test/api/v1/search_documents", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "portal", limit: 1 }),
  }));
  assert.equal(search.status, 200);
  // A visitor's query never goes in a URL.
  const getSearch = await send(env, new Request("https://docs.test/api/v1/search_documents?query=portal"));
  assert.equal(getSearch.status, 405);
});

test("a batch of nine is refused, eight is answered, an oversized body is refused", async () => {
  const env = environment();
  const batch = (count) => Array.from({ length: count }, (_, id) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "inspect_bundle", arguments: {} } }));
  const legacy = { ...HEADERS, "mcp-protocol-version": "2025-03-26" };
  assert.equal((await rpc(env, batch(8), legacy)).status, 200);
  assert.equal((await rpc(env, batch(9), legacy)).status, 400);
  assert.equal((await rpc(env, "x".repeat(70 * 1024))).status, 413);
});

test("over the limit answers 429 with Retry-After and pages keep answering", async () => {
  const env = environment(1);
  assert.equal((await rpc(env, { jsonrpc: "2.0", id: 1, method: "tools/list" })).status, 200);
  const limited = await rpc(env, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  for (const pathname of ["/", "/llms.txt", "/sitemap.xml"]) {
    const page = await send(env, new Request(`https://docs.test${pathname}`));
    assert.equal(page.status, 200, pathname);
  }
});

test("without the rate-limit binding the endpoint is off and pages are untouched", async () => {
  const env = environment();
  delete env.AGENT_LIMITER;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const response = await rpc(env, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    // Falls through to the site, which answers a POST to /mcp as it would any other path.
    assert.ok([404, 405].includes(response.status), `status ${response.status}`);
    assert.equal((await send(env, new Request("https://docs.test/"))).status, 200);
  } finally { console.warn = originalWarn; }
});
