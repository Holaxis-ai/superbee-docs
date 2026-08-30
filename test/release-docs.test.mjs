import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const script = path.resolve("scripts/release-docs.mjs");

function input(version) {
  return {
    schema: "superbee-docs-release-input.v1",
    package: "superbee",
    version,
    npmTag: "latest",
    publishedAt: "2026-08-28",
    summary: `Superbee ${version} makes a verified release available.`,
    changes: ["Adds one tested capability.", "Keeps existing bundles compatible."],
    action: "Install or update with `npm install -g superbee`.",
    compatibility: "Verified on macOS and Linux with Node 20 or newer.",
    recovery: "Install the preceding version if the verified path does not work.",
    packageUrl: `https://www.npmjs.com/package/superbee/v/${version}`,
    tarballUrl: `https://registry.npmjs.org/superbee/-/superbee-${version}.tgz`,
    npmIntegrity: "sha512-YWJjZA==",
    sourceUrl: `https://github.com/Holaxis-ai/superbee/tree/v${version}`,
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    sourceTag: `v${version}`,
    nodeRequirement: ">=20",
    supportedPlatforms: ["darwin", "linux"],
    verification: ["Installed the exact package in an isolated prefix.", "Completed the disposable workspace journey."],
  };
}

async function invoke(root, command, extra = []) {
  return run(process.execPath, [script, command, "--root", root, ...extra], { cwd: path.resolve("."), maxBuffer: 8 * 1024 * 1024 });
}

test("release update is idempotent, advances stable identities, and preserves immutable history", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "superbee-docs-release-test-"));
  try {
    await mkdir(path.join(root, ".superbee"), { recursive: true });
    await writeFile(path.join(root, ".superbee", "index.md"), "---\nokf_version: '0.2'\n---\n# Test bundle\n");
    await writeFile(path.join(root, "portal.config.json"), JSON.stringify({ documentation: { versionLabel: "Latest", navigation: [{ label: "Releases", documents: ["releases/current"] }] } }));
    const firstManifest = path.join(root, "first.json");
    await writeFile(firstManifest, JSON.stringify(input("1.2.3")));
    const first = JSON.parse((await invoke(root, "update", ["--manifest", firstManifest])).stdout);
    assert.equal(first.changed.length, 4);
    assert.equal(first.versionLabel, "v1.2.3");
    assert.equal(first.portalConfigChanged, true);
    assert.equal(JSON.parse(await readFile(path.join(root, "portal.config.json"), "utf8")).documentation.versionLabel, "v1.2.3");
    const repeat = JSON.parse((await invoke(root, "update", ["--manifest", firstManifest])).stdout);
    assert.deepEqual(repeat.changed, []);
    assert.equal(repeat.portalConfigChanged, false);
    await invoke(root, "check");
    await writeFile(firstManifest, JSON.stringify({ ...input("1.2.3"), summary: "A changed account of an already published release." }));
    await assert.rejects(invoke(root, "update", ["--manifest", firstManifest]), /refusing to replace immutable release document/);

    const placeholderManifest = path.join(root, "placeholder.json");
    await writeFile(placeholderManifest, JSON.stringify({ ...input("1.2.4"), action: "TODO: decide what users should do." }));
    await assert.rejects(invoke(root, "update", ["--manifest", placeholderManifest]), /authored-content placeholder/);

    const contradictoryManifests = [
      [{ npmTag: "next" }, /npmTag must be latest/],
      [{ sourceTag: "v9.9.9" }, /sourceTag must equal v<version>/],
      [{ packageUrl: "https://www.npmjs.com/package/superbee/v/9.9.9" }, /packageUrl must equal/],
      [{ tarballUrl: "https://registry.npmjs.org/superbee/-/superbee-9.9.9.tgz" }, /tarballUrl must equal/],
      [{ sourceUrl: "https://github.com/Holaxis-ai/superbee/tree/v9.9.9" }, /sourceUrl must equal/],
    ];
    for (const [override, expected] of contradictoryManifests) {
      const contradictoryManifest = path.join(root, `contradictory-${Object.keys(override)[0]}.json`);
      await writeFile(contradictoryManifest, JSON.stringify({ ...input("1.2.4"), ...override }));
      await assert.rejects(invoke(root, "update", ["--manifest", contradictoryManifest]), expected);
    }

    const oldRelease = await readFile(path.join(root, ".superbee", "releases", "1.2.3.md"));
    const nextManifest = path.join(root, "next.json");
    await writeFile(nextManifest, JSON.stringify(input("1.2.4")));
    const next = JSON.parse((await invoke(root, "update", ["--manifest", nextManifest])).stdout);
    assert.deepEqual(next.changed.sort(), ["releases/1.2.4", "releases/current", "sources/current-release", "sources/superbee-release-1.2.4"].sort());
    assert.equal(next.versionLabel, "v1.2.4");
    assert.equal(next.portalConfigChanged, true);
    assert.equal(JSON.parse(await readFile(path.join(root, "portal.config.json"), "utf8")).documentation.versionLabel, "v1.2.4");
    assert.deepEqual(await readFile(path.join(root, ".superbee", "releases", "1.2.3.md")), oldRelease);
    assert.deepEqual(await readFile(path.join(root, ".superbee", "releases", "current.md")), await readFile(path.join(root, ".superbee", "releases", "1.2.4.md")));
    assert.deepEqual(await readFile(path.join(root, ".superbee", "sources", "current-release.md")), await readFile(path.join(root, ".superbee", "sources", "superbee-release-1.2.4.md")));
    await invoke(root, "check");

    await writeFile(path.join(root, ".superbee", "releases", "current.md"), oldRelease);
    await assert.rejects(invoke(root, "check"), /semantically identical/);
    const resumed = JSON.parse((await invoke(root, "update", ["--manifest", nextManifest])).stdout);
    assert.deepEqual(resumed.changed, ["releases/current"]);
    await invoke(root, "check");

    const configPath = path.join(root, "portal.config.json");
    const staleConfig = JSON.parse(await readFile(configPath, "utf8"));
    staleConfig.documentation.versionLabel = "Latest";
    await writeFile(configPath, JSON.stringify(staleConfig));
    await assert.rejects(invoke(root, "check"), /versionLabel must equal v1\.2\.4 from releases\/current/);
    const repaired = JSON.parse((await invoke(root, "update", ["--manifest", nextManifest])).stdout);
    assert.deepEqual(repaired.changed, []);
    assert.equal(repaired.portalConfigChanged, true);
    await invoke(root, "check");

    await mkdir(path.join(root, ".superbee", "migrations"), { recursive: true });
    await writeFile(path.join(root, ".superbee", "migrations", "allowed-history.md"), "---\ntype: Guide\n---\n[Evidence](../sources/superbee-release-1.2.3.md) for the historical migration.\n");
    await invoke(root, "check");

    await mkdir(path.join(root, ".superbee", "guides"), { recursive: true });
    await writeFile(path.join(root, ".superbee", "guides", "stale.md"), `---
type: Guide
---
[Evidence](../sources/superbee-release-1.2.3.md)
[Release](../releases/1.2.3.md)
https://www.npmjs.com/package/superbee/v/1.2.3
https://registry.npmjs.org/superbee/-/superbee-1.2.3.tgz
`);
    await assert.rejects(invoke(root, "check"), /hardcoded Superbee package version/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
