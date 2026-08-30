import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { ensureCompleteRepositoryHistory } from "../scripts/bootstrap-repository-history.mjs";

const run = promisify(execFile);
const git = async (cwd, ...args) => (await run("git", args, { cwd })).stdout.trim();

test("bootstrap expands a shallow checkout before deriving Git-backed freshness", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "superbee-docs-history-"));
  const source = path.join(parent, "source");
  const checkout = path.join(parent, "checkout");
  try {
    await mkdir(source);
    await git(source, "init", "--initial-branch=main");
    await git(source, "config", "user.name", "Docs test");
    await git(source, "config", "user.email", "docs@example.test");
    await writeFile(path.join(source, "page.md"), "one\n");
    await git(source, "add", "page.md");
    await git(source, "commit", "-m", "one");
    await writeFile(path.join(source, "page.md"), "two\n");
    await git(source, "commit", "-am", "two");
    await run("git", ["clone", "--depth", "1", `file://${source}`, checkout]);

    assert.equal(await git(checkout, "rev-parse", "--is-shallow-repository"), "true");
    assert.equal(await ensureCompleteRepositoryHistory(checkout), true);
    assert.equal(await git(checkout, "rev-parse", "--is-shallow-repository"), "false");
    assert.equal(await git(checkout, "rev-list", "--count", "HEAD"), "2");
    assert.equal(await ensureCompleteRepositoryHistory(checkout), false);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
