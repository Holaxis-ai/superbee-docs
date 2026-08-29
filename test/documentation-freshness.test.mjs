import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { deriveDocumentationFreshness } from "../scripts/documentation-freshness.mjs";

const run = promisify(execFile);

async function git(root, args, env = {}) {
  return run("git", args, { cwd: root, env: { ...process.env, ...env } });
}

async function commit(root, message, timestamp) {
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", message], {
    GIT_AUTHOR_DATE: timestamp,
    GIT_COMMITTER_DATE: timestamp,
  });
}

function snapshot(body, frontmatter = { type: "Guide" }) {
  return {
    manifest: {
      documents: [{ id: "guide/start", version: `version:${body}`, frontmatter, body }],
    },
  };
}

test("page updates, evidence-only commits, unchanged rebuilds, and unknown facts remain distinct", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-freshness-"));
  try {
  const bundle = path.join(root, ".superbee");
  await mkdir(path.join(bundle, "guide"), { recursive: true });
  await mkdir(path.join(bundle, "maintenance"), { recursive: true });
  await git(root, ["init"]);
  await git(root, ["config", "user.name", "Fixture"]);
  await git(root, ["config", "user.email", "fixture@example.test"]);
  await writeFile(path.join(bundle, "guide/start.md"), "first\n");
  await writeFile(path.join(bundle, "maintenance/evidence.md"), "first evidence\n");
  await commit(root, "initial page", "2026-08-20T10:00:00Z");

  const input = { root, bundle, snapshot: snapshot("first"), documentIds: ["guide/start"] };
  const initial = await deriveDocumentationFreshness(input);
  assert.deepEqual(initial, [{
    documentId: "guide/start",
    sourceVersion: "version:first",
    updatedAt: "2026-08-20T10:00:00.000Z",
  }]);
  assert.deepEqual(await deriveDocumentationFreshness(input), initial, "unchanged rebuilds are deterministic");

  await writeFile(path.join(bundle, "maintenance/evidence.md"), "verification completed\n");
  await commit(root, "verify evidence", "2026-08-21T11:00:00Z");
  assert.deepEqual(await deriveDocumentationFreshness(input), initial,
    "an evidence-only verification must not masquerade as a page update");

  await writeFile(path.join(bundle, "guide/start.md"), "second\n");
  await commit(root, "update page", "2026-08-22T12:00:00Z");
  assert.deepEqual(await deriveDocumentationFreshness({ ...input, snapshot: snapshot("second") }), [{
    documentId: "guide/start",
    sourceVersion: "version:second",
    updatedAt: "2026-08-22T12:00:00.000Z",
  }]);

  await writeFile(path.join(bundle, "guide/start.md"), `${await readFile(path.join(bundle, "guide/start.md"), "utf8")}dirty`);
  assert.deepEqual(await deriveDocumentationFreshness({ ...input, snapshot: snapshot("dirty") }), [],
    "dirty bytes have no immutable Git update fact");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the OKF meaningful-change clock wins without Git and is normalized", async () => {
  const facts = await deriveDocumentationFreshness({
    root: "/missing",
    bundle: "/missing/.superbee",
    snapshot: snapshot("current", { type: "Guide", generated: { at: "2026-08-29T08:07:06-04:00" } }),
    documentIds: ["guide/start"],
  });
  assert.deepEqual(facts, [{
    documentId: "guide/start",
    sourceVersion: "version:current",
    updatedAt: "2026-08-29T12:07:06.000Z",
  }]);
});
