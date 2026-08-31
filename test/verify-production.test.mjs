import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DEPLOYMENT_REDIRECTS } from "../scripts/deployment-assets.mjs";
import { documentationVerificationExtensionV1 } from "../scripts/verify-production.mjs";

const ORIGIN = "https://docs.getsuperbee.com/";
const MARKDOWN = Buffer.from("# Start here\n");
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const declaredMarkdown = {
  path: "bundle/learn/start-here.md",
  digest: sha256(MARKDOWN),
  size: MARKDOWN.byteLength,
  mediaType: "text/markdown; charset=utf-8",
};

function page({ omit = "", alternate = "/bundle/learn/start-here.md" } = {}) {
  return Buffer.from([
    "<!doctype html><html><head>",
    omit === "canonical" ? "" : `<link rel="canonical" href="${ORIGIN}">`,
    `<link rel="alternate" type="text/markdown" href="${alternate}">`,
    '<link rel="describedby" href="/llms.txt">',
    `<meta property="og:url" content="${ORIGIN}">`,
    '<meta name="twitter:card" content="summary">',
    '<script type="application/ld+json">{}</script>',
    "</head><body>Start here</body></html>\n",
  ].join(""));
}

function context(options = {}) {
  const html = page(options);
  const redirects = new Map(DEPLOYMENT_REDIRECTS.map((rule) => [rule.from, rule]));
  return {
    origin: ORIGIN,
    routes: [{ route: "/", artifactPath: "index.html", disposition: "shell" }],
    declared: (relative) => relative === declaredMarkdown.path ? declaredMarkdown : undefined,
    digest: sha256,
    probe: async (route) => {
      const redirect = redirects.get(route);
      if (redirect) {
        return {
          route,
          status: redirect.status,
          contentType: null,
          vary: null,
          headers: { location: redirect.to },
          bytes: new Uint8Array(),
          digest: sha256(new Uint8Array()),
        };
      }
      const bytes = route === "/" ? html : MARKDOWN;
      return {
        route,
        status: 200,
        contentType: route === "/" ? "text/html; charset=utf-8" : declaredMarkdown.mediaType,
        vary: null,
        headers: {},
        bytes,
        digest: sha256(bytes),
      };
    },
  };
}

test("the Docs extension verifies presentation facts, the advertised Markdown, and site entry redirects", async () => {
  const rows = await documentationVerificationExtensionV1(context(), ORIGIN);
  assert.deepEqual(rows.map((row) => row.id), [
    "documentation presentation /",
    "documentation Markdown alternate /",
    "documentation entry redirect /docs",
    "documentation entry redirect /docs/",
  ]);
  assert.equal(rows.every((row) => row.outcome === "pass"), true, JSON.stringify(rows, null, 2));
});

test("presentation drift and an unsafe Markdown alternate fail their own Docs rows", async () => {
  const missingCanonical = await documentationVerificationExtensionV1(context({ omit: "canonical" }), ORIGIN);
  assert.deepEqual(missingCanonical.filter((row) => row.outcome === "fail").map((row) => row.id), [
    "documentation presentation /",
  ]);

  const outside = await documentationVerificationExtensionV1(context({ alternate: "https://elsewhere.test/source.md" }), ORIGIN);
  assert.deepEqual(outside.filter((row) => row.outcome === "fail").map((row) => row.id), [
    "documentation presentation /",
    "documentation Markdown alternate /",
  ]);
});

test("the built artifact declares exact canonical routes and aliases in hosting requirements v2", async () => {
  const requirements = JSON.parse(await readFile("dist/data/hosting-requirements.json", "utf8"));
  assert.equal(requirements.schema, "https://getsuperbee.com/schemas/hosting-requirements/v2");
  assert.ok(requirements.requiredCapabilities.includes("canonical-route-redirects.v1"));

  const canonical = new Map(requirements.routes
    .filter((row) => row.artifactPath?.endsWith(".html"))
    .map((row) => [row.artifactPath, row.pattern]));
  assert.equal(canonical.get("index.html"), "/");
  assert.equal(canonical.get("404.html"), "/404");
  assert.equal(canonical.get("docs/learn/start-here/index.html"), "/docs/learn/start-here/");

  const aliases = new Map(requirements.redirects.map((row) => [row.source, row]));
  for (const [artifactPath, route] of canonical) {
    const source = `/${artifactPath}`;
    if (source === route) continue;
    assert.deepEqual(aliases.get(source), {
      source,
      destination: route,
      status: 307,
      methods: ["GET", "HEAD"],
    });
  }
});
