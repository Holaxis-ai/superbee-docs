import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const script = path.resolve("scripts/release-docs.mjs");
const superbee = path.resolve("node_modules/.bin/superbee");
const recipe = path.resolve("node_modules/@superbee/recipe-studio/recipes/codebase-documentation/v0");

async function sb(root, args) {
  return run(superbee, [...args, "--dir", path.join(root, ".superbee"), "--json"], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
}

async function setupDocumentationModel(root) {
  await sb(root, ["recipe", "add", recipe]);
  await sb(root, ["new", "Documentation System", "main", "--title", "Test documentation", "--product_name", "Superbee",
    "--version_label", "Latest", "--body", "# Purpose\n\nTest.\n\n# Audience\n\nTest.\n\n# Source boundaries\n\nTest.\n\n# Maintenance policy\n\nTest."]);
  await sb(root, ["new", "Documentation Section", "releases-and-migrations", "--title", "Releases and migrations", "--order", "0",
    "--documents", "releases/release-notes", "--documents", "releases/current", "--body", "# Purpose\n\nTest."]);
  await sb(root, ["new", "Documentation Publication", "current", "--title", "Current documentation", "--home", "releases/current",
    "--operational_types", "Documentation Trigger", "--link", "for system=documentation-systems/main",
    "--link", "contains=documentation-sections/releases-and-migrations",
    "--body", "# Purpose\n\nTest.\n\n# Selection policy\n\nTest."]);
}

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
  return run(process.execPath, [script, command, "--root", root, "--superbee-bin", superbee, ...extra], { cwd: path.resolve("."), maxBuffer: 8 * 1024 * 1024 });
}

test("release update is idempotent, advances stable identities, and preserves immutable history", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "superbee-docs-release-test-"));
  try {
    await mkdir(path.join(root, ".superbee"), { recursive: true });
    await writeFile(path.join(root, ".superbee", "index.md"), "---\nokf_version: '0.2'\n---\n# Test bundle\n");
    await setupDocumentationModel(root);
    const firstManifest = path.join(root, "first.json");
    await writeFile(firstManifest, JSON.stringify(input("1.2.3")));
    const first = JSON.parse((await invoke(root, "update", ["--manifest", firstManifest])).stdout);
    assert.equal(first.changed.length, 5);
    assert.equal(first.versionLabel, "v1.2.3");
    assert.equal(first.documentationSystemChanged, true);
    assert.equal(first.selectionChanged, true);
    const firstSystem = JSON.parse((await sb(root, ["doc", "read", "documentation-systems/main"])).stdout);
    const firstPublication = JSON.parse((await sb(root, ["doc", "read", "documentation-publications/current"])).stdout);
    const releaseSection = JSON.parse((await sb(root, ["doc", "read", "documentation-sections/releases-and-migrations"])).stdout);
    assert.equal(firstSystem.version_label, "v1.2.3");
    assert.deepEqual(releaseSection.documents, ["releases/release-notes", "releases/current"]);
    assert.deepEqual(firstPublication.supporting_documents,
      ["releases/1.2.3", "sources/superbee-release-1.2.3"]);
    assert.match(await readFile(path.join(root, ".superbee", "releases", "release-notes.md"), "utf8"), /# Current stable release[\s\S]+Superbee 1\.2\.3/);
    const repeat = JSON.parse((await invoke(root, "update", ["--manifest", firstManifest])).stdout);
    assert.deepEqual(repeat.changed, []);
    assert.equal(repeat.documentationSystemChanged, false);
    assert.equal(repeat.selectionChanged, false);
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
    assert.deepEqual(next.changed.sort(), ["releases/1.2.4", "releases/current", "releases/release-notes", "sources/current-release", "sources/superbee-release-1.2.4"].sort());
    assert.equal(next.versionLabel, "v1.2.4");
    assert.equal(next.documentationSystemChanged, true);
    assert.equal(next.selectionChanged, true);
    const nextSystem = JSON.parse((await sb(root, ["doc", "read", "documentation-systems/main"])).stdout);
    const nextPublication = JSON.parse((await sb(root, ["doc", "read", "documentation-publications/current"])).stdout);
    assert.equal(nextSystem.version_label, "v1.2.4");
    assert.deepEqual(nextPublication.supporting_documents,
      ["releases/1.2.3", "releases/1.2.4", "sources/superbee-release-1.2.3", "sources/superbee-release-1.2.4"]);
    const archive = await readFile(path.join(root, ".superbee", "releases", "release-notes.md"), "utf8");
    assert.match(archive, /# Current stable release[\s\S]+Superbee 1\.2\.4/);
    assert.match(archive, /# Previous stable releases[\s\S]+Superbee 1\.2\.3/);
    assert.deepEqual(await readFile(path.join(root, ".superbee", "releases", "1.2.3.md")), oldRelease);
    assert.deepEqual(await readFile(path.join(root, ".superbee", "releases", "current.md")), await readFile(path.join(root, ".superbee", "releases", "1.2.4.md")));
    assert.deepEqual(await readFile(path.join(root, ".superbee", "sources", "current-release.md")), await readFile(path.join(root, ".superbee", "sources", "superbee-release-1.2.4.md")));
    await invoke(root, "check");

    await writeFile(path.join(root, ".superbee", "releases", "current.md"), oldRelease);
    await assert.rejects(invoke(root, "check"), /semantically identical/);
    const resumed = JSON.parse((await invoke(root, "update", ["--manifest", nextManifest])).stdout);
    assert.deepEqual(resumed.changed, ["releases/current"]);
    await invoke(root, "check");

    await sb(root, ["doc", "update", "documentation-systems/main", "--version_label", "Latest", "--strict"]);
    await assert.rejects(invoke(root, "check"), /versionLabel must equal v1\.2\.4 from releases\/current/);
    const repaired = JSON.parse((await invoke(root, "update", ["--manifest", nextManifest])).stdout);
    assert.deepEqual(repaired.changed, []);
    assert.equal(repaired.documentationSystemChanged, true);
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
