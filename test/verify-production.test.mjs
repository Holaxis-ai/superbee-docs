import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { DEPLOYMENT_REDIRECTS } from "../scripts/deployment-assets.mjs";
import {
  DOCUMENTATION_NOT_FOUND_PROBE_ROUTE,
  documentationVerificationExtensionV1,
  PRODUCTION_VERIFICATION_RECEIPT_V1,
  verifyProductionWithRetryV1,
  writeProductionVerificationReceiptV1,
} from "../scripts/verify-production.mjs";

const ORIGIN = "https://docs.getsuperbee.com/";
const MARKDOWN = Buffer.from("# Start here\n");
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const declaredMarkdown = {
  path: "bundle/learn/start-here.md",
  digest: sha256(MARKDOWN),
  size: MARKDOWN.byteLength,
  mediaType: "text/markdown; charset=utf-8",
};

test("the recovery probe stays inside the trailing-slash documentation namespace", () => {
  assert.match(DOCUMENTATION_NOT_FOUND_PROBE_ROUTE, /^\/docs\/.+\/$/u);
});

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

test("production verification retries until the exact artifact is live and identifies its source", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "superbee-docs-production-verification-"));
  const artifactDigest = `sha256:${"a".repeat(64)}`;
  await mkdir(path.join(directory, "data"));
  await writeFile(path.join(directory, "data", "portal-manifest.json"), JSON.stringify({ artifactDigest }));
  const sleeps = [];
  const attemptReceipts = [];
  let calls = 0;
  try {
    const receipt = await verifyProductionWithRetryV1({
      baseUrl: ORIGIN,
      dist: directory,
      siteUrl: ORIGIN,
      sourceRepository: "Holaxis-ai/superbee-docs",
      sourceCommit: "A".repeat(40),
      attempts: 3,
      delayMs: 15_000,
      verify: async () => {
        calls += 1;
        return { ok: calls === 3, artifactDigest };
      },
      sleep: async (delay) => { sleeps.push(delay); },
      observedAt: () => "2026-09-01T12:00:00.000Z",
      onAttempt: async (attemptReceipt) => { attemptReceipts.push(attemptReceipt); },
    });
    assert.deepEqual(receipt, {
      schema: PRODUCTION_VERIFICATION_RECEIPT_V1,
      outcome: "VERIFIED",
      observedAt: "2026-09-01T12:00:00.000Z",
      source: { repository: "Holaxis-ai/superbee-docs", commit: "a".repeat(40) },
      target: { origin: "https://docs.getsuperbee.com" },
      artifactDigest,
      attempts: 3,
      verification: { ok: true, artifactDigest },
    });
    assert.deepEqual(sleeps, [15_000, 15_000]);
    assert.deepEqual(attemptReceipts.map(({ attempts, outcome }) => ({ attempts, outcome })), [
      { attempts: 1, outcome: "FAILED" },
      { attempts: 2, outcome: "FAILED" },
      { attempts: 3, outcome: "VERIFIED" },
    ]);

    const receiptPath = path.join(directory, "receipts", "production.json");
    assert.equal(await writeProductionVerificationReceiptV1(receipt, receiptPath), receiptPath);
    assert.deepEqual(JSON.parse(await readFile(receiptPath, "utf8")), receipt);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production verification preserves the final failure without retrying past its bound", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "superbee-docs-production-verification-"));
  const artifactDigest = `sha256:${"b".repeat(64)}`;
  await mkdir(path.join(directory, "data"));
  await writeFile(path.join(directory, "data", "portal-manifest.json"), JSON.stringify({ artifactDigest }));
  let calls = 0;
  try {
    const receipt = await verifyProductionWithRetryV1({
      baseUrl: ORIGIN,
      dist: directory,
      siteUrl: ORIGIN,
      sourceRepository: "Holaxis-ai/superbee-docs",
      sourceCommit: "b".repeat(40),
      attempts: 2,
      verify: async () => {
        calls += 1;
        throw new Error("origin unavailable");
      },
      sleep: async () => {},
      observedAt: () => "2026-09-01T12:00:00.000Z",
    });
    assert.equal(calls, 2);
    assert.equal(receipt.outcome, "FAILED");
    assert.equal(receipt.attempts, 2);
    assert.equal(receipt.error, "origin unavailable");
    assert.equal(receipt.verification, null);
    assert.equal(receipt.artifactDigest, artifactDigest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
