import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const script = path.resolve("scripts/documentation-impact.mjs");

test("documentation trigger records are valid operational records", async () => {
  const result = JSON.parse((await run(process.execPath, [script, "check"])).stdout);
  assert.deepEqual(result, { ok: true, command: "documentation impact check", records: 38 });
});

test("source changes and product events resolve affected reader pages", async () => {
  const result = JSON.parse((await run(process.execPath, [
    script,
    "--changed", "packages/core/src/document-mutation.ts",
    "--event", "stable-release-identity",
  ])).stdout);
  const pages = new Set(result.affected.flatMap((row) => row.pages));
  assert.equal(pages.has("architecture/document-mutation-lifecycle"), true);
  assert.equal(pages.has("troubleshooting/setup-and-bundle-resolution"), true);
  assert.equal(pages.has("architecture/architecture-at-a-glance"), false);
});

test("a nul-delimited Git change list drives the same bounded impact query", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "superbee-docs-impact-"));
  const changed = path.join(temporary, "changed.zlist");
  try {
    await writeFile(changed, "packages/core/src/document-mutation.ts\0packages/cli/src/commands/setup.ts\0");
    const result = JSON.parse((await run(process.execPath, [script, "--changed-list", changed])).stdout);
    assert.deepEqual(result.changed, ["packages/core/src/document-mutation.ts", "packages/cli/src/commands/setup.ts"]);
    const pages = new Set(result.affected.flatMap((row) => row.pages));
    assert.equal(pages.has("architecture/document-mutation-lifecycle"), true);
    assert.equal(pages.has("get-started/install-and-setup"), true);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("host and Skill events cover every agent-directed entry point", async () => {
  const result = JSON.parse((await run(process.execPath, [
    script,
    "--event", "supported-hosts",
    "--event", "skill-installation",
  ])).stdout);
  const pages = new Set(result.affected.flatMap((row) => row.pages));
  for (const id of [
    "get-started/install-and-setup",
    "guides/choose-privacy-and-bundle-boundaries",
    "guides/model-recurring-domain-concepts",
    "guides/preserve-context-between-sessions",
    "guides/share-and-synchronize-git-bundle",
    "learn/start-here",
    "reference/host-and-platform-support",
  ]) assert.equal(pages.has(id), true, id);
});

test("operational guide sources and events select their reader pages", async () => {
  const result = JSON.parse((await run(process.execPath, [
    script,
    "--changed", "packages/cli/src/build-identity.ts",
    "--changed", "packages/cli/src/commands/doc/read.ts",
    "--event", "portal-complete-bundle-artifact",
  ])).stdout);
  const pages = new Set(result.affected.flatMap((row) => row.pages));
  assert.equal(pages.has("get-started/verify-host-setup"), true);
  assert.equal(pages.has("guides/share-and-synchronize-git-bundle"), true);
  assert.equal(pages.has("guides/choose-privacy-and-bundle-boundaries"), true);
});
