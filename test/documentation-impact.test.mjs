import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const script = path.resolve("scripts/documentation-impact.mjs");

test("documentation trigger records are valid operational records", async () => {
  const result = JSON.parse((await run(process.execPath, [script, "check"])).stdout);
  assert.deepEqual(result, { ok: true, command: "documentation impact check", records: 17 });
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
