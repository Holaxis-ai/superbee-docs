import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(args) {
  const { stdout } = await execFileAsync("superbee", [...args, "--json"], {
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

test("the documented governed OKF v0.1 compatibility journey remains usable", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-v01-journey-"));
  const bundle = path.join(root, ".superbee");
  try {
    await run([
      "init", "--create-only", "--okf-version", "0.1", "--recipe", "work-tracking",
      "--dir", bundle,
    ]);
    const created = await run([
      "new", "Task", "compatibility-check",
      "--title", "Verify v0.1 compatibility",
      "--progress_status", "todo",
      "--dir", bundle,
    ]);
    assert.equal(created.id, "tasks/compatibility-check");

    const listed = await run([
      "list", "--type", "Task", "--field", "progress_status=todo", "--dir", bundle,
    ]);
    assert.equal(listed.count, 1);
    assert.equal(listed.docs[0].progress_status, "todo");

    await run([
      "doc", "update", created.id, "--progress_status", "done", "--dir", bundle,
    ]);
    const updated = await run(["doc", "read", created.id, "--dir", bundle]);
    assert.equal(updated.status, "done");

    const status = await run(["status", "--limit", "0", "--dir", bundle]);
    assert.equal(status.malformed, 0);
    assert.equal(status.kind_warnings, 0);
    assert.equal(status.okf_upgrade?.recommended_logical_field, "progress_status");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
