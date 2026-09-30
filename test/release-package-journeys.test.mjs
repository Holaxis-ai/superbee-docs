import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { currentPackageFacts, packageJourneys } from "../scripts/release-package-journeys.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const identity = {
  package: { name: "superbee", version: "0.3.0" },
  source: { commit: "bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8", dirty: false },
  artifact: { channel: "npm-package", sha256: `sha256:${"a".repeat(64)}` },
};
const facts = { version: identity.package.version, sourceCommit: identity.source.commit };

async function fakePackage(t, value) {
  const scratch = await mkdtemp(path.join(tmpdir(), "superbee-journey-test-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const bin = path.join(scratch, "package.mjs");
  const capture = path.join(scratch, "child.json");
  await writeFile(bin, `import {writeFileSync} from "node:fs";
writeFileSync(${JSON.stringify(capture)}, JSON.stringify({cwd:process.cwd(),env:process.env}));
console.log(JSON.stringify({identity:${JSON.stringify(value)}}));
`);
  return { bin, capture };
}

test("identity mismatch refuses the package before mutations and cleans its isolated environment", async (t) => {
  const fixture = await fakePackage(t, { ...identity, source: { ...identity.source, commit: "b".repeat(40) } });
  const poisoned = ["NODE_OPTIONS", "SUPERBEE_ACCESS_TOKEN", "SUPERBEE_HOST", "SUPERBEE_ACTOR", "AGENTSTATE_LITE_ACTOR"];
  const previous = new Map(poisoned.map((key) => [key, process.env[key]]));
  for (const key of poisoned) process.env[key] = "synthetic-parent-value";
  try {
    await assert.rejects(packageJourneys({ bin: fixture.bin, facts }), /Installed-package journeys failed/);
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  const child = JSON.parse(await readFile(fixture.capture, "utf8"));
  for (const key of poisoned) assert.equal(child.env[key], undefined, key);
  assert.equal(child.env.HOME, child.cwd);
  for (const key of ["TMPDIR", "XDG_CONFIG_HOME", "XDG_STATE_HOME", "LOCALAPPDATA"]) assert.equal(child.env[key], child.cwd, key);
  await assert.rejects(access(child.cwd), { code: "ENOENT" });
});

test("an artifact identity mismatch also refuses before local bundle initialization", async (t) => {
  const fixture = await fakePackage(t, identity);
  await assert.rejects(packageJourneys({ bin: fixture.bin, facts: { ...facts, artifact: { sha256: `sha256:${"b".repeat(64)}` } } }), /Installed-package journeys failed/);
  const child = JSON.parse(await readFile(fixture.capture, "utf8"));
  await assert.rejects(access(child.cwd), { code: "ENOENT" });
});

function closedProbe(preload, code) {
  const result = spawnSync(process.execPath, ["--import", path.join(root, "scripts/release-journey-fixtures", preload), "--input-type=module", "-e", code], {
    cwd: root, env: { PATH: process.env.PATH }, encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
}

test("the journey preload refuses fetch and socket requests before network activity", () => {
  closedProbe("no-network.mjs", `
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import net from "node:net";
await assert.rejects(fetch("https://example.invalid"), /Network refused/);
assert.throws(() => http.get("http://example.invalid"), /Network refused/);
assert.throws(() => https.request("https://example.invalid"), /Network refused/);
assert.throws(() => net.connect(443, "example.invalid"), /Network refused/);
assert.throws(() => new net.Socket().connect(443, "example.invalid"), /Network refused/);
`);
});

test("hosted fixtures admit only configured read POSTs for the disposable bundle", () => {
  closedProbe("host-fixture.mjs", `
import assert from "node:assert/strict";
import https from "node:https";
const host = "https://hosted.example";
const request = {method:"POST",body:'{"bundleId":"team.knowledge"}'};
for (const [url, init] of [
  ["https://example.invalid/sync/v1/heads", request],
  [host+"/sync/v1/heads", {method:"GET"}],
  [host+"/sync/v1/heads?extra=1", request],
  [host+"/sync/v1/heads#extra", request],
  [host+"/sync/v1/replace", request],
  [host+"/sync/v1/heads", {method:"POST",body:'{"bundleId":"other.bundle"}'}],
]) await assert.rejects(fetch(url, init), /refused/);
assert.throws(() => https.get(host), /Network refused/);
const answer = await fetch(host+"/sync/v1/heads", request);
assert.equal(answer.status, 200);
assert.equal((await answer.json()).count, 3);
`);
});

test("the installed published package completes all 29 disposable journey commands", async () => {
  const published = await currentPackageFacts(root);
  const receipt = await packageJourneys({ bin: path.join(root, "node_modules/.bin/superbee"), facts: published });
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.commands, 29);
  assert.deepEqual(receipt.identity.package, { name: "superbee", version: published.version });
  assert.deepEqual(receipt.identity.source, { commit: published.sourceCommit, dirty: false });
  assert.equal(receipt.identity.artifact.channel, "npm-package");
  assert.equal(receipt.checks.length, 6);
  const serialized = JSON.stringify(receipt);
  assert.doesNotMatch(serialized, /executable_path|superbee-release-journey-|fabricated-fixture-value/);
});
