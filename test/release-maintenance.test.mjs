import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { releaseDocumentationStatus } from "../scripts/release-maintenance.mjs";

const version = "1.2.4";
const integrity = "sha512-YWJjZA==";
const tagSha = "1111111111111111111111111111111111111111";
const sourceCommit = "2222222222222222222222222222222222222222";

async function fixture(documentedVersion, evidenceIntegrity = integrity, evidenceSourceCommit = sourceCommit) {
  const root = await mkdtemp(path.join(os.tmpdir(), "superbee-release-status-"));
  await mkdir(path.join(root, ".superbee", "releases"), { recursive: true });
  await mkdir(path.join(root, ".superbee", "sources"), { recursive: true });
  await writeFile(path.join(root, ".superbee", "releases", "current.md"), `---\ntype: Release\nversion: ${documentedVersion}\n---\n# Current\n`);
  await writeFile(path.join(root, ".superbee", "sources", `superbee-release-${documentedVersion}.md`), `---\ntype: Source\n---\n| npm integrity | \`${evidenceIntegrity}\` |\n| source commit | \`${evidenceSourceCommit}\` |\n`);
  return root;
}

async function server() {
  const listener = http.createServer((request, response) => {
    const routes = {
      "/superbee/latest": {
        name: "superbee",
        version,
        engines: { node: ">=20" },
        dist: { integrity, tarball: `http://127.0.0.1:${listener.address().port}/superbee/-/superbee-${version}.tgz` },
      },
      [`/repos/Holaxis-ai/superbee/releases/tags/v${version}`]: {
        tag_name: `v${version}`,
        draft: false,
        prerelease: false,
        published_at: "2026-08-30T12:00:00Z",
        html_url: `https://github.com/Holaxis-ai/superbee/releases/tag/v${version}`,
        body: "Verified generated notes.",
      },
      [`/repos/Holaxis-ai/superbee/git/ref/tags/v${version}`]: { object: { type: "tag", sha: tagSha } },
      [`/repos/Holaxis-ai/superbee/git/tags/${tagSha}`]: { object: { type: "commit", sha: sourceCommit } },
    };
    const body = routes[request.url];
    response.writeHead(body ? 200 : 404, { "content-type": "application/json" });
    response.end(JSON.stringify(body ?? { error: "missing" }));
  });
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;
  return { listener, registry: base, githubApi: `${base}/repos/Holaxis-ai/superbee` };
}

test("release status distinguishes current documentation from an update requiring authored review", async () => {
  const remote = await server();
  const currentRoot = await fixture(version);
  const priorCommit = "3333333333333333333333333333333333333333";
  const staleRoot = await fixture("1.2.3", integrity, priorCommit);
  try {
    const current = await releaseDocumentationStatus({ root: currentRoot, registry: remote.registry, githubApi: remote.githubApi });
    assert.equal(current.status, "current");
    assert.deepEqual(current.authoredFieldsRequired, []);
    assert.equal(current.verifiedFacts.sourceCommit, sourceCommit);

    const stale = await releaseDocumentationStatus({
      root: staleRoot,
      registry: remote.registry,
      githubApi: remote.githubApi,
      triggerRecords: [
        { id: "maintenance/documentation-triggers/setup", pages: ["get-started/install"], sources: [], events: ["npm-latest"] },
        { id: "maintenance/documentation-triggers/platform", pages: ["reference/platforms"], sources: [], events: ["stable-release-identity"] },
      ],
    });
    assert.equal(stale.status, "update_required");
    assert.deepEqual(stale.authoredFieldsRequired, [
      "summary", "changes", "action", "compatibility", "recovery", "supportedPlatforms", "verification",
    ]);
    assert.deepEqual(stale.impactEvents, ["npm-latest", "stable-release-identity", "stable-release-verified"]);
    assert.deepEqual(stale.eventAffectedPages, ["get-started/install", "reference/platforms"]);
    assert.deepEqual(stale.sourceDiff, { base: priorCommit, head: sourceCommit });
    assert.equal(stale.verifiedFacts.npmIntegrity, integrity);
    assert.match(stale.next, /author the required reader-facing fields/);
  } finally {
    await Promise.all([rm(currentRoot, { recursive: true, force: true }), rm(staleRoot, { recursive: true, force: true })]);
    await new Promise((resolve) => remote.listener.close(resolve));
  }
});

test("release status rejects disagreement with documented stable evidence", async () => {
  const remote = await server();
  const root = await fixture(version, "sha512-ZGlmZmVyZW50");
  try {
    await assert.rejects(
      releaseDocumentationStatus({ root, registry: remote.registry, githubApi: remote.githubApi }),
      /documented npm integrity differs/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await new Promise((resolve) => remote.listener.close(resolve));
  }
});
