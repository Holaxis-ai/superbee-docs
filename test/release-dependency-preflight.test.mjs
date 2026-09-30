import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { dependencyPreflight, preflightPackages } from "../scripts/release-dependency-preflight.mjs";

const entry = (name) => ({ version: "1.2.3", resolved: `https://registry.npmjs.org/${name}/-/fixture-1.2.3.tgz`, integrity: "sha512-fixture" });
test("preflight bounds selection to direct packages and their locked scopes", () => {
  const manifest = { dependencies: { "@superbee/a": "1.2.3", superbee: "1.2.3" } };
  const lock = { packages: { "node_modules/@superbee/a": entry("@superbee/a"), "node_modules/@superbee/transitive": entry("@superbee/transitive"),
    "node_modules/superbee": entry("superbee"), "node_modules/@unrelated/public": entry("@unrelated/public"), "node_modules/public-transitive": entry("public-transitive") } };
  assert.deepEqual(preflightPackages(lock, manifest).map((pkg) => pkg.name), ["@superbee/a", "@superbee/transitive", "superbee"]);
  assert.throws(() => preflightPackages({ packages: {} }, manifest), /complete reviewed/);
  assert.throws(() => preflightPackages({ packages: { "node_modules/superbee": { version: "1.2.3" } } }, manifest), /complete reviewed/);
  assert.throws(() => preflightPackages({ packages: { "node_modules/superbee": { version: "1.2.3" } } }, { dependencies: { superbee: "1.2.3" } }), /complete reviewed/);
  assert.equal(preflightPackages({ packages: { "node_modules/wrangler": { version: "1.2.3" } } }, { devDependencies: { wrangler: "1.2.3" } })[0].metadataOnly, true);
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "docs-preflight-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "node_modules"));
  await writeFile(path.join(root, "node_modules/retained"), "existing installed tree");
  const dependencies = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`@superbee/p${i}`, "1.2.3"]));
  const packages = Object.fromEntries(Object.keys(dependencies).map((name) => [`node_modules/${name}`, entry(name)]));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies }));
  await writeFile(path.join(root, "package-lock.json"), JSON.stringify({ packages }));
  return root;
}

test("preflight checks exact metadata with at most three concurrent read commands", async (t) => {
  const root = await fixture(t);
  let active = 0, maximum = 0, calls = 0;
  const result = await dependencyPreflight(root, { run: async (bin, args) => {
    assert.equal(bin, "npm"); assert.equal(args[0], "view");
    active++; maximum = Math.max(maximum, active); calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    const name = args[1].slice(0, args[1].lastIndexOf("@"));
    return JSON.stringify({ tarball: entry(name).resolved, integrity: entry(name).integrity });
  } });
  assert.equal(result.status, "accessible"); assert.equal(calls, 7); assert.equal(maximum, 3);
});

test("denied access and wrong metadata are sanitized and leave dependency inputs untouched", async (t) => {
  const root = await fixture(t);
  const files = ["package.json", "package-lock.json", "node_modules/retained"];
  const before = await Promise.all(files.map((name) => readFile(path.join(root, name))));
  for (const run of [async () => { throw new Error("registry diagnostic secret-token private-path"); },
    async () => JSON.stringify({ tarball: "https://evil.invalid/fixture", integrity: "wrong" })]) {
    await assert.rejects(dependencyPreflight(root, { run }), (error) => {
      assert.match(error.message, /Dependency metadata access or identity failed/);
      assert.doesNotMatch(error.message, /secret-token|private-path|evil.invalid/); return true;
    });
  }
  assert.deepEqual(await Promise.all(files.map((name) => readFile(path.join(root, name)))), before);
  await writeFile(path.join(root, "package-lock.json"), 'private-invalid-json');
  await assert.rejects(dependencyPreflight(root), (error) => {
    assert.doesNotMatch(error.message, /private-invalid-json|docs-preflight/); return true;
  });
});
