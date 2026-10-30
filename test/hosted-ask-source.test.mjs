import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { ASK_SOURCE_SITE, publishAskSource, readArtifact } from "../scripts/hosted-ask-source.mjs";
import { GATEWAY } from "../scripts/hosted-workload-token.mjs";

const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const BEARER = `sbw_${"a".repeat(32)}`;

/** A small public Portal-shaped artifact on disk. */
async function artifactDir(audience = "public") {
  const root = await mkdtemp(path.join(tmpdir(), "ask-source-"));
  const files = { "index.html": "<h1>docs</h1>", "assets/app.js": "1;", "assets/copy.js": "1;" };
  for (const [relative, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), text);
  }
  const manifest = {
    artifactDigest: sha(Buffer.from("artifact")),
    audience,
    files: Object.entries(files).map(([p, text]) => ({ path: p, digest: sha(Buffer.from(text)), size: text.length })),
  };
  await mkdir(path.join(root, "data"), { recursive: true });
  await writeFile(path.join(root, "data/portal-manifest.json"), `${JSON.stringify(manifest)}\n`);
  return { root, manifest };
}

/** Hosted's three routes, recording every call; `missing` is what begin reports. */
function hosted(missing) {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    const route = url.slice(`${GATEWAY}/sync/v1/`.length);
    if (route === "site-release-begin") {
      const manifest = JSON.parse(Buffer.from(init.body).toString("utf8"));
      return Response.json({ version: 1, releaseId: "r1", artifactDigest: manifest.artifactDigest, state: "staged", missing });
    }
    if (route === "site-object") return Response.json({ version: 1, accepted: true });
    if (route === "site-release-complete") return Response.json({ version: 1, releaseId: "r1", state: "complete", indexDigest: sha(Buffer.from("i")) });
    return Response.json({ error: "not_found" }, { status: 404 });
  };
  return { calls, request };
}

test("the artifact is published as the site's Ask source: begin, the missing objects once each, complete", async () => {
  const { root, manifest } = await artifactDir();
  try {
    const artifact = await readArtifact(root);
    const digests = [...new Set(manifest.files.map((file) => file.digest))];
    const { calls, request } = hosted(digests);
    const result = await publishAskSource({ artifact, bearer: BEARER, codeCommit: "a".repeat(40), request, log: () => {} });
    assert.deepEqual(result, { releaseId: "r1", uploaded: digests.length });
    const routes = calls.map((call) => call.url.slice(`${GATEWAY}/sync/v1/`.length));
    assert.equal(routes[0], "site-release-begin");
    assert.equal(routes.at(-1), "site-release-complete");
    assert.equal(routes.filter((route) => route === "site-object").length, digests.length, "shared bytes upload once");
    for (const { url, init } of calls) {
      assert.ok(url.startsWith(`${GATEWAY}/sync/v1/`), "the bearer goes to the gateway only");
      assert.equal(init.redirect, "error");
      assert.equal(init.headers.Authorization, `Bearer ${BEARER}`);
    }
    assert.equal(calls[0].init.headers["X-Superbee-Site"], ASK_SOURCE_SITE);
    assert.equal(calls[0].init.headers["X-Superbee-Code-Commit"], "a".repeat(40));
    const object = calls.find((call) => call.url.endsWith("/site-object"));
    assert.equal(object.init.headers["X-Superbee-Release"], "r1");
    assert.equal(sha(object.init.body), object.init.headers["X-Superbee-Object-Digest"]);
    assert.deepEqual(JSON.parse(calls.at(-1).init.body), { site: ASK_SOURCE_SITE, releaseId: "r1" });
    // Nothing missing: no uploads, still completed (a re-publish of the same artifact).
    const again = hosted([]);
    await publishAskSource({ artifact, bearer: BEARER, request: again.request, log: () => {} });
    assert.deepEqual(again.calls.map((call) => call.url.split("/").pop()), ["site-release-begin", "site-release-complete"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a restricted artifact, a changed file, a stray digest, a bad bearer or a refusal stops the publish", async () => {
  const restricted = await artifactDir("restricted");
  const { root, manifest } = await artifactDir();
  try {
    await assert.rejects(readArtifact(restricted.root), { exit: 2 });
    const artifact = await readArtifact(root);
    await assert.rejects(publishAskSource({ artifact, bearer: "not-a-bearer", request: hosted([]).request }), { exit: 2 });
    await assert.rejects(
      publishAskSource({ artifact, bearer: BEARER, request: hosted([sha(Buffer.from("unlisted"))]).request, log: () => {} }),
      /does not list/u,
    );
    await writeFile(path.join(root, "index.html"), "<h1>changed</h1>");
    const changed = manifest.files.find((file) => file.path === "index.html").digest;
    await assert.rejects(
      publishAskSource({ artifact, bearer: BEARER, request: hosted([changed]).request, log: () => {} }),
      { exit: 2 },
    );
    const refusing = async () => Response.json({ error: "audience_not_restricted" }, { status: 400 });
    await assert.rejects(publishAskSource({ artifact, bearer: BEARER, request: refusing, log: () => {} }), /400 audience_not_restricted/u);
  } finally {
    await rm(restricted.root, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
});
