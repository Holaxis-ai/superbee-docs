import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertHostedWriter, main } from "../scripts/content-writer.mjs";

async function fixture(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "docs-content-writer-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = path.join(root, "superbee.mjs");
  const state = path.join(root, "receipt.json");
  const trace = path.join(root, "trace.jsonl");
  const directory = path.join(root, ".superbee");
  await writeFile(bin, `#!${process.execPath}
import {appendFileSync,readFileSync,mkdirSync} from 'node:fs';
const args=process.argv.slice(2);
appendFileSync(${JSON.stringify(trace)}, JSON.stringify(args)+'\\n');
if(args[0]==='checkout') mkdirSync(${JSON.stringify(directory)});
if(args[0]==='bundle') process.stdout.write(readFileSync(${JSON.stringify(state)}));
`);
  await chmod(bin, 0o755);
  const receipt = { home: "hosted", available: true, locator: { kind: "local-path", path: directory },
    hosted: { host: "https://mcp.getsuperbee.com", bundle_id: "superbee-docs", workspace: "org:13f08d25-21bb-406a-bf0c-9782ba34c5b8", principal: "principal-id" } };
  const set = (value) => writeFile(state, JSON.stringify(value));
  await set(receipt);
  return { root, bin, directory, receipt, set, trace: async () => (await readFile(trace, "utf8")).trim().split("\n").map(JSON.parse) };
}

test("guard uses public locate and rejects nonhosted, wrong target and invalid workspace receipts", async (t) => {
  const f = await fixture(t);
  await mkdir(f.directory);
  assert.deepEqual(await assertHostedWriter(f), f.receipt);
  for (const changed of [
    { ...f.receipt, home: "local" },
    { ...f.receipt, hosted: { ...f.receipt.hosted, host: "https://other.example" } },
    { ...f.receipt, hosted: { ...f.receipt.hosted, bundle_id: "other" } },
    { ...f.receipt, hosted: { ...f.receipt.hosted, workspace: null } },
    { ...f.receipt, hosted: { ...f.receipt.hosted, workspace: "another-workspace" } },
    { ...f.receipt, locator: { kind: "local-path", path: f.root } },
  ]) {
    await f.set(changed);
    await assert.rejects(assertHostedWriter(f), /registered hosted checkout/);
  }
  assert.deepEqual((await f.trace())[0], ["bundle", "locate", "--dir", f.directory, "--json"]);
});

test("checkout only creates an absent folder, sync is explicit and wrapper preserves arguments and exit status", async (t) => {
  const f = await fixture(t);
  assert.equal(await main(["checkout"], f), 0);
  assert.deepEqual((await f.trace())[0], ["checkout", "holaxis-sites/superbee-docs", "--host", "https://mcp.getsuperbee.com", "--dir", f.directory]);
  assert.equal(await main(["checkout"], f), 0);
  assert.equal((await f.trace()).filter((args) => args[0] === "checkout").length, 1);
  const output = path.join(f.root, "child.json");
  const code = `require('node:fs').writeFileSync(process.argv[1], JSON.stringify(process.argv.slice(2)));process.exitCode=7`;
  assert.equal(await main(["--", process.execPath, "-e", code, output, "literal $(no-shell)", "with spaces"], f), 7);
  assert.deepEqual(JSON.parse(await readFile(output, "utf8")), ["literal $(no-shell)", "with spaces"]);
  assert.equal((await f.trace()).some((args) => args[0] === "sync"), false);
  assert.equal(await main(["sync"], f), 0);
  assert.deepEqual((await f.trace()).at(-1), ["sync", "--dir", f.directory]);
  await f.set({ ...f.receipt, home: "local" });
  await assert.rejects(main(["checkout"], f), /registered hosted checkout/);
  await assert.rejects(main(["--", process.execPath, "-e", "throw Error('must not run')"], f), /registered hosted checkout/);
  assert.equal((await f.trace()).filter((args) => args[0] === "checkout").length, 1);
});

test("guard refuses symlinked bundle roots before invoking the CLI", async (t) => {
  const f = await fixture(t);
  await symlink(f.root, f.directory);
  await assert.rejects(assertHostedWriter(f), /registered hosted checkout/);
  await assert.rejects(readFile(path.join(f.root, "trace.jsonl")), { code: "ENOENT" });
});
