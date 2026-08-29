import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { architectureImpact, checkArchitecture } from "../scripts/architecture-docs.mjs";

const run = promisify(execFile);

async function git(root, ...args) {
  return (await run("git", ["-C", root, ...args], { encoding: "utf8" })).stdout.trim();
}

async function commit(root, message) {
  await git(root, "add", "-A");
  await git(root, "commit", "-m", message);
  return git(root, "rev-parse", "HEAD");
}

function sourceDocument(pin) {
  return `---
type: Source
title: Source
---
# Evidence

- \`source_repository\`: \`https://github.com/Holaxis-ai/superbee\`
- \`source_commit\`: \`${pin}\`
`;
}

function architecturePage(pin, { anchor = "L1-L2", trigger = "packages/core/src/backend.ts", citationSha = pin } = {}) {
  return `---
type: Diagram
title: Mutation
---
# Evidence

[backend](https://github.com/Holaxis-ai/superbee/blob/${citationSha}/packages/core/src/backend.ts#${anchor})

# Change triggers

Review exact source paths:

- \`${trigger}\`

[pinned implementation evidence](../sources/superbee-codebase-main.md)
`;
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "architecture-docs-test-"));
  const source = join(root, "source");
  const docs = join(root, "docs");
  await mkdir(join(source, "packages/core/src"), { recursive: true });
  await mkdir(join(docs, ".superbee/sources"), { recursive: true });
  await mkdir(join(docs, ".superbee/architecture"), { recursive: true });
  await run("git", ["init", source]);
  await git(source, "config", "user.name", "Architecture test");
  await git(source, "config", "user.email", "architecture@example.test");
  await git(source, "remote", "add", "origin", "https://github.com/Holaxis-ai/superbee.git");
  await writeFile(join(source, "packages/core/src/backend.ts"), "export const one = 1;\nexport const two = 2;\n");
  await writeFile(join(source, "README.md"), "initial\n");
  const pin = await commit(source, "initial source");
  await writeFile(join(docs, ".superbee/sources/superbee-codebase-main.md"), sourceDocument(pin));
  await writeFile(join(docs, ".superbee/architecture/mutation.md"), architecturePage(pin));
  return { root, source, docs, pin };
}

test("architecture check validates one source authority, citations, triggers, and anchors", async () => {
  const value = await fixture();
  try {
    const before = await Promise.all([
      readFile(join(value.docs, ".superbee/sources/superbee-codebase-main.md")),
      readFile(join(value.docs, ".superbee/architecture/mutation.md")),
    ]);
    const result = await checkArchitecture({ root: value.docs, source: value.source });
    assert.equal(result.sourceCommit, value.pin);
    assert.deepEqual(result.pages.map((page) => page.id), ["architecture/mutation"]);
    const after = await Promise.all([
      readFile(join(value.docs, ".superbee/sources/superbee-codebase-main.md")),
      readFile(join(value.docs, ".superbee/architecture/mutation.md")),
    ]);
    assert.deepEqual(after, before);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("forward impact distinguishes no impact from semantic review and supports one historical commit", async () => {
  const value = await fixture();
  try {
    await writeFile(join(value.source, "README.md"), "unrelated\n");
    const readmeHead = await commit(value.source, "readme only");
    const noImpact = await architectureImpact({ root: value.docs, source: value.source, head: readmeHead });
    assert.equal(noImpact.status, "no_impact");
    assert.deepEqual(noImpact.pages, []);

    await writeFile(join(value.source, "packages/core/src/backend.ts"), "export const one = 2;\nexport const two = 2;\n");
    const relevantHead = await commit(value.source, "change backend");
    const impacted = await architectureImpact({ root: value.docs, source: value.source, head: relevantHead });
    assert.equal(impacted.status, "semantic_review_required");
    assert.deepEqual(impacted.pages.map((page) => page.id), ["architecture/mutation"]);
    assert.deepEqual(impacted.pages[0].matches, [{ status: "M", path: "packages/core/src/backend.ts" }]);

    const historical = await architectureImpact({ root: value.docs, source: value.source, change: relevantHead });
    assert.equal(historical.mode, "historical-change");
    assert.equal(historical.status, "semantic_review_required");
    assert.deepEqual(historical.changed, [{ status: "M", path: "packages/core/src/backend.ts" }]);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("broken anchors, mixed citation pins, and unmatched or unsafe triggers fail closed", async () => {
  const value = await fixture();
  const page = join(value.docs, ".superbee/architecture/mutation.md");
  try {
    await writeFile(page, architecturePage(value.pin, { anchor: "L2-L9" }));
    await assert.rejects(checkArchitecture({ root: value.docs, source: value.source }), /line range is invalid/);

    await writeFile(join(value.source, "README.md"), "next\n");
    const other = await commit(value.source, "other commit");
    await writeFile(page, architecturePage(value.pin, { citationSha: other }));
    await assert.rejects(checkArchitecture({ root: value.docs, source: value.source }), /different source commit/);

    await writeFile(page, architecturePage(value.pin, { trigger: "packages/server/src/*.ts" }));
    await assert.rejects(checkArchitecture({ root: value.docs, source: value.source }), /matches no regular file/);

    await writeFile(page, architecturePage(value.pin, { trigger: "../packages/core/src/backend.ts" }));
    await assert.rejects(checkArchitecture({ root: value.docs, source: value.source }), /invalid architecture change trigger/);
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});

test("wrong repository identity and divergent forward history never report no impact", async () => {
  const value = await fixture();
  try {
    await git(value.source, "remote", "set-url", "origin", "https://github.com/example/not-superbee.git");
    await assert.rejects(checkArchitecture({ root: value.docs, source: value.source }), /does not match/);
    await git(value.source, "remote", "set-url", "origin", "https://github.com/Holaxis-ai/superbee.git");

    const tree = await git(value.source, "rev-parse", `${value.pin}^{tree}`);
    const divergent = (await run("git", ["-C", value.source, "commit-tree", tree, "-m", "unrelated root"], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Architecture test",
        GIT_AUTHOR_EMAIL: "architecture@example.test",
        GIT_COMMITTER_NAME: "Architecture test",
        GIT_COMMITTER_EMAIL: "architecture@example.test",
      },
    })).stdout.trim();
    await assert.rejects(
      architectureImpact({ root: value.docs, source: value.source, head: divergent }),
      /is not a descendant/,
    );
  } finally {
    await rm(value.root, { recursive: true, force: true });
  }
});
