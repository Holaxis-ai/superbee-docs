import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DOCUMENTATION_DEPLOYMENT_VERIFICATION_V1,
  verifyDocumentationDeploymentV1,
} from "../scripts/verify-production.mjs";

const ORIGIN = "https://docs.example.test/";
const INDEX = [
  "<!doctype html><html lang=\"en\"><head>",
  "<link rel=\"canonical\" href=\"https://docs.example.test/\">",
  "<link rel=\"alternate\" type=\"text/markdown\" href=\"/bundle/learn/start-here.md\">",
  "<link rel=\"describedby\" href=\"/llms.txt\">",
  "<meta property=\"og:url\" content=\"https://docs.example.test/\">",
  "<meta name=\"twitter:card\" content=\"summary\">",
  "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\"}</script>",
  "</head><body>index</body></html>\n",
].join("");

const FILES = {
  "index.html": INDEX,
  "llms.txt": "# Superbee\n",
  "robots.txt": "User-agent: *\nAllow: /\nSitemap: https://docs.example.test/sitemap.xml\n",
  "sitemap.xml": "<urlset/>\n",
  "404.md": "# Page not found\n",
  "404.html": "<!doctype html><title>Page not found</title>\n",
  "bundle/learn/start-here.md": "# Start here\n",
};

const MEDIA_TYPES = {
  "index.html": "text/html; charset=utf-8",
  "llms.txt": "text/markdown; charset=utf-8",
  "robots.txt": "text/plain; charset=utf-8",
  "sitemap.xml": "application/xml; charset=utf-8",
  "404.md": "text/markdown; charset=utf-8",
  "404.html": "text/html; charset=utf-8",
  "bundle/learn/start-here.md": "text/markdown; charset=utf-8",
};

async function artifact() {
  const directory = await mkdtemp(path.join(tmpdir(), "superbee-docs-verify-"));
  for (const [relative, body] of Object.entries(FILES)) {
    const target = path.join(directory, ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
  await mkdir(path.join(directory, "data"), { recursive: true });
  await writeFile(path.join(directory, "data", "portal-manifest.json"), JSON.stringify({
    artifactDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    files: Object.entries(MEDIA_TYPES).map(([relative, mediaType]) => ({ path: relative, mediaType })),
  }));
  return directory;
}

/** A deterministic stand-in for the deployed origin; each option injects one realistic defect. */
function origin({
  emptyNotFound = false,
  staleLlms = false,
  varyAccept = false,
  plainTextLlms = false,
  strippedHead = false,
} = {}) {
  return async (url, init = {}) => {
    const pathname = new URL(url).pathname.replace(/^\//, "") || "index.html";
    const headers = new Headers();
    if (varyAccept) headers.set("Vary", "Accept, Accept-Encoding");
    if (Object.hasOwn(FILES, pathname)) {
      let body = FILES[pathname];
      if (pathname === "llms.txt" && staleLlms) body = "# Stale\n";
      if (pathname === "index.html" && strippedHead) body = body.replace(/<link rel="alternate"[^>]*>/, "");
      headers.set("Content-Type", pathname === "llms.txt" && plainTextLlms ? "text/plain" : MEDIA_TYPES[pathname]);
      return new Response(body, { status: 200, headers });
    }
    if (emptyNotFound) return new Response(null, { status: 404, headers });
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(FILES["404.html"], { status: 404, headers });
  };
}

test("a faithful deployment passes every published-byte comparison", async () => {
  const dist = await artifact();
  try {
    const result = await verifyDocumentationDeploymentV1({ baseUrl: ORIGIN, dist, fetchImpl: origin() });
    assert.equal(result.schema, DOCUMENTATION_DEPLOYMENT_VERIFICATION_V1);
    assert.equal(result.ok, true, JSON.stringify(result.results.filter((row) => !row.ok), null, 2));
    assert.equal(result.failed, 0);
    assert.deepEqual(result.mediaTypeDrift, []);
    assert.deepEqual(result.results.map((row) => row.name), [
      "agent entry point",
      "crawler policy",
      "sitemap",
      "recovery body (markdown)",
      "documentation index",
      "unknown route recovery",
      "markdown alternate",
      "no unadvertised content negotiation",
    ]);
  } finally { await rm(dist, { recursive: true, force: true }); }
});

test("each realistic deployment defect fails its own named check", async () => {
  const dist = await artifact();
  const failing = async (options) => {
    const result = await verifyDocumentationDeploymentV1({ baseUrl: ORIGIN, dist, fetchImpl: origin(options) });
    assert.equal(result.ok, false, JSON.stringify(options));
    return result.results.filter((row) => !row.ok).map((row) => row.name);
  };
  try {
    // The baseline defect this work exists to close: a status-only 404 with no recovery body.
    assert.deepEqual(await failing({ emptyNotFound: true }), ["unknown route recovery"]);
    // A stale edge cache serving a previous agent entry point.
    assert.deepEqual(await failing({ staleLlms: true }), ["agent entry point"]);
    // A Vary: Accept header the origin cannot honour would fragment every shared cache.
    assert.deepEqual(await failing({ varyAccept: true }), ["no unadvertised content negotiation"]);
    // A page that lost its Markdown alternate stops advertising the agent-facing source.
    assert.deepEqual(await failing({ strippedHead: true }), ["documentation index", "markdown alternate"]);
  } finally { await rm(dist, { recursive: true, force: true }); }
});

test("an unexpected status is never reported as media type drift", async () => {
  const dist = await artifact();
  try {
    // A status-only 404 carries no Content-Type. Recording that as drift-to-empty would hide the
    // real failure -- the missing recovery body -- behind a second, invented one.
    const result = await verifyDocumentationDeploymentV1({
      baseUrl: ORIGIN, dist, fetchImpl: origin({ emptyNotFound: true }),
    });
    assert.equal(result.ok, false);
    assert.deepEqual(result.results.filter((row) => !row.ok).map((row) => row.name), ["unknown route recovery"]);
    assert.deepEqual(result.mediaTypeDrift, []);
  } finally { await rm(dist, { recursive: true, force: true }); }
});

test("media type drift is reported without being confused for a byte regression", async () => {
  const dist = await artifact();
  try {
    const result = await verifyDocumentationDeploymentV1({
      baseUrl: ORIGIN, dist, fetchImpl: origin({ plainTextLlms: true }),
    });
    assert.equal(result.ok, true, "an extension-derived Content-Type is not a published-byte failure");
    assert.deepEqual(result.mediaTypeDrift, [
      { path: "/llms.txt", declared: "text/markdown", observed: "text/plain" },
    ]);
    const row = result.results.find((candidate) => candidate.name === "agent entry point");
    assert.equal(row.declaredMediaType, "text/markdown");
    assert.equal(row.observedMediaType, "text/plain");
  } finally { await rm(dist, { recursive: true, force: true }); }
});
