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

test("permission-aware sharing owners select every coupled reader journey", async () => {
  const bothPages = [
    "get-started/first-durable-workspace",
    "guides/share-and-synchronize-git-bundle",
  ];
  const sourceExpectations = new Map([
    ["README.md", bothPages],
    ["packages/cli/SKILL.md", bothPages],
    ["packages/cli/src/commands/sync/establish.ts", bothPages],
    ["packages/cli/src/commands/sync/orchestrate.ts", bothPages],
    ["packages/cli/src/skill-render.ts", bothPages],
    ["packages/cli/src/sync-outcomes.ts", bothPages],
    ["packages/cli/test/skill-distribution.test.ts", bothPages],
    ["packages/cli/test/sync-establish.test.ts", bothPages],
    ["packages/cli/test/sync-outcomes.test.ts", bothPages],
    ["packages/board-git/src/errors.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/board-git/test/channel.test.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/board-git/test/git-porcelain.test.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/src/commands/sync/establish-committed.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/src/commands/sync/converge.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/src/ui/sharing.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/test/board-git-errors.test.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/test/fixtures/sync-outcomes/fixtures.json", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/test/sync-establish-committed.test.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/test/sync-intree.test.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/test/sync.test.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/cli/test/ui-sharing.test.ts", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/ui/src/views/Launcher.test.tsx", ["guides/share-and-synchronize-git-bundle"]],
    ["packages/ui-server/test/config.test.ts", ["guides/share-and-synchronize-git-bundle"]],
  ]);

  for (const [source, expectedPages] of sourceExpectations) {
    const result = JSON.parse((await run(process.execPath, [script, "--changed", source])).stdout);
    const pages = new Set(result.affected.flatMap((row) => row.pages));
    for (const page of expectedPages) assert.equal(pages.has(page), true, `${source} -> ${page}`);
  }

  for (const event of ["bundle-sharing-permissions", "repository-before-board", "shared-board-establishment"]) {
    const result = JSON.parse((await run(process.execPath, [script, "--event", event])).stdout);
    const pages = new Set(result.affected.flatMap((row) => row.pages));
    for (const page of bothPages) assert.equal(pages.has(page), true, `${event} -> ${page}`);
  }
});
