import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { conduct, manifestSkeleton, assertReview, assertPackageIdentity, sourceDiff, installEvidence, journeyVerification } from "../scripts/release-conductor.mjs";

const exec = promisify(execFile);
const realRun = async (bin, args, cwd) => (await exec(bin, args, { cwd })).stdout;
const read = async (file) => JSON.parse(await readFile(file, "utf8"));
const write = (file, value) => writeFile(file, JSON.stringify(value));
const facts = { schema: "superbee-docs-release-input.v1", package: "superbee", version: "1.2.4", npmTag: "latest",
  publishedAt: "2026-09-10", packageUrl: "https://www.npmjs.com/package/superbee/v/1.2.4",
  tarballUrl: "https://registry.npmjs.org/superbee/-/superbee-1.2.4.tgz", npmIntegrity: "sha512-YWJjZA==",
  sourceUrl: "https://github.com/Holaxis-ai/superbee/tree/v1.2.4", sourceCommit: "a".repeat(40),
  sourceTag: "v1.2.4", nodeRequirement: ">=22", githubReleaseNotes: "Untrusted evidence", githubReleaseUrl: "https://example.org" };
const packed = { package: { name: "superbee", version: facts.version }, source: { commit: facts.sourceCommit, dirty: false },
  artifact: { channel: "npm-package", sha256: `sha256:${"b".repeat(64)}` } };
const authored = { summary: "Reviewed change.", changes: ["A verified command was added."], action: "Update the package.",
  compatibility: "Existing bundles remain supported.", recovery: "Use the prior package if needed.", supportedPlatforms: ["darwin"], verification: ["Ran a disposable journey."] };

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "docs-conductor-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".superbee/releases"), { recursive: true });
  await cp("scripts", path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, ".github/workflows"), { recursive: true });
  await cp(".github/workflows/check.yml", path.join(root, ".github/workflows/check.yml"));
  await writeFile(path.join(root, ".gitignore"), ".tmp/\nnode_modules\n.deps/\ndist/\ndeploy/\n");
  await writeFile(path.join(root, ".superbee/releases/current.md"), "---\nversion: 1.2.3\n---\n");
  await write(path.join(root, "package.json"), { dependencies: { superbee: "1.2.3" } });
  await write(path.join(root, "package-lock.json"), {});
  await realRun("git", ["init", "-q"], root);
  await realRun("git", ["add", "."], root);
  await realRun("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], root);
  const calls = [];
  let breakRelease = false;
  const dependencies = {
    status: async () => { calls.push("status"); return { status: "update_required", documentedVersion: "1.2.3", verifiedFacts: facts,
      sourceDiff: { base: "c".repeat(40), head: facts.sourceCommit }, impactEvents: ["npm-latest"] }; },
    preflight: async () => { calls.push("preflight"); },
    journeys: async () => ({ status: "passed", commands: 29, platform: "darwin", node: process.version, identity: packed }),
    install: async () => { calls.push("install-evidence"); return packed; },
    diff: async () => ["packages/cli/changed.ts"],
    triggers: async () => [
      { id: "path", pages: ["guide/path"], sources: ["packages/cli/**"], events: [] },
      { id: "event", pages: ["guide/event"], sources: [], events: ["npm-latest"] },
    ],
    run: async (bin, args, cwd) => {
      if (bin === "git") return realRun(bin, args, cwd);
      if (args[0] === "version") return JSON.stringify({ identity: packed });
      calls.push(args.join(" "));
      if (bin === "npm" && args[0] === "install") {
        await write(path.join(root, "package.json"), { dependencies: { superbee: facts.version } });
        await write(path.join(root, "package-lock.json"), { packages: { "node_modules/superbee": {
          version: facts.version, integrity: facts.npmIntegrity, resolved: facts.tarballUrl } } });
      }
      if (args[0] === "scripts/release-docs.mjs") {
        if (breakRelease) { breakRelease = false; throw new Error("simulated interruption"); }
        await writeFile(path.join(root, ".superbee/releases/current.md"), `---\nversion: ${facts.version}\n---\n`);
      }
      return "";
    },
  };
  const options = { root };
  const state = path.join(root, ".tmp/release-conductor");
  const review = async () => {
    const packet = await read(path.join(state, "packet.json"));
    await write(path.join(state, "release.json"), { ...manifestSkeleton(facts), ...authored, verification: [...authored.verification, journeyVerification(packet.journeys)] });
    await write(path.join(state, "review.json"), { packetDigest: packet.digest, reviewedBy: "test-reviewer",
      pages: packet.affectedPages.map((id) => ({ id, disposition: "no-change", reason: "Reviewed the released change; this page remains accurate." })) });
    return packet;
  };
  return { root, state, options, dependencies, calls, review, interrupt: () => { breakRelease = true; } };
}

function fixtureSourceRun(remote) {
  return (bin, args, cwd) => realRun(bin, args.map((arg) => arg === "https://github.com/Holaxis-ai/superbee.git" ? remote : arg), cwd);
}

test("prepare freezes one evidence packet, includes path and event impact, and preserves authored retries", async (t) => {
  const f = await fixture(t);
  const result = await conduct("prepare", f.options, f.dependencies);
  assert.deepEqual(result.affectedPages, ["guide/event", "guide/path"]);
  const packet = await f.review();
  const authoredBytes = await readFile(path.join(f.state, "release.json"));
  await conduct("prepare", f.options, f.dependencies);
  assert.equal(f.calls.filter((x) => x === "status").length, 1);
  assert.equal(f.calls.filter((x) => x === "install-evidence").length, 1);
  assert.deepEqual(await readFile(path.join(f.state, "release.json")), authoredBytes);
  assert.equal(packet.manifestFacts.githubReleaseNotes, undefined);
  assert.equal(packet.evidence.verifiedFacts.githubReleaseNotes, facts.githubReleaseNotes);
  await write(path.join(f.state, "packet.json"), { ...packet, changedPaths: [] });
  await assert.rejects(conduct("status", f.options, f.dependencies), /damaged or edited/);
});

test("current preparation is a cheap saved no-op and never installs or mutates the bundle", async (t) => {
  const f = await fixture(t);
  f.dependencies.status = async () => ({ status: "current", verifiedFacts: facts });
  const before = await readFile(path.join(f.root, ".superbee/releases/current.md"));
  assert.equal((await conduct("prepare", f.options, f.dependencies)).status, "current");
  assert.equal((await conduct("apply", f.options, f.dependencies)).changed, false);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(await readFile(path.join(f.root, ".superbee/releases/current.md")), before);
});

test("review rejects placeholders, changed evidence, omitted/duplicate pages and unverified artifacts", () => {
  const skeleton = manifestSkeleton(facts);
  const packet = { digest: "packet", manifestFacts: Object.fromEntries(Object.keys(skeleton).filter((k) => !Object.hasOwn(authored, k)).map((k) => [k, skeleton[k]])), affectedPages: ["guide/a"] };
  const manifest = { ...skeleton, ...authored };
  const review = { packetDigest: "packet", reviewedBy: "reviewer", pages: [{ id: "guide/a", disposition: "updated", reason: "Ran the new journey." }] };
  assert.doesNotThrow(() => assertReview(packet, manifest, review));
  assert.throws(() => assertReview(packet, skeleton, review), /placeholder/);
  assert.throws(() => assertReview(packet, { ...manifest, sourceCommit: "d".repeat(40) }, review), /verified fact/);
  assert.throws(() => assertReview(packet, manifest, { ...review, pages: [] }), /every affected/);
  assert.throws(() => assertReview(packet, manifest, { ...review, pages: [...review.pages, ...review.pages] }), /every affected/);
  assert.throws(() => assertPackageIdentity({ identity: packed }, facts, { sha256: "different" }), /artifact digest/);
  assert.throws(() => assertPackageIdentity({ identity: { ...packed, source: { ...packed.source, dirty: true } } }, facts), /identity/);
});

test("apply resumes after interruption, then verification reuses only exact checkout and execution files", async (t) => {
  const f = await fixture(t);
  await conduct("prepare", f.options, f.dependencies);
  await assert.rejects(conduct("apply", f.options, f.dependencies), /placeholder/);
  await f.review();
  f.interrupt();
  await assert.rejects(conduct("apply", f.options, f.dependencies), /simulated interruption/);
  assert.equal((await read(path.join(f.state, "receipt.json"))).pending, "release");
  assert.equal((await conduct("apply", f.options, f.dependencies)).status, "applied");
  const before = f.calls.length;
  assert.equal((await conduct("apply", f.options, f.dependencies)).reused, true);
  assert.equal(f.calls.length, before);
  const pending = await read(path.join(f.state, "receipt.json"));
  await write(path.join(f.state, "receipt.json"), { ...pending, pending: "package" });
  assert.equal((await conduct("apply", f.options, f.dependencies)).reused, false);
  assert.equal((await read(path.join(f.state, "receipt.json"))).pending, undefined);
  assert.equal((await conduct("check", f.options, f.dependencies)).reused, false);
  assert.equal((await conduct("check", f.options, f.dependencies)).reused, true);
  await mkdir(path.join(f.root, "dist"));
  await writeFile(path.join(f.root, "dist/index.html"), "changed ignored output");
  assert.equal((await conduct("check", f.options, f.dependencies)).reused, false);
  await writeFile(path.join(f.root, ".superbee/guide.md"), "edited reader page");
  assert.equal((await conduct("check", f.options, f.dependencies)).reused, false);
  const manifest = await read(path.join(f.state, "release.json"));
  await write(path.join(f.state, "release.json"), { ...manifest, summary: "Different account of this release." });
  await assert.rejects(conduct("apply", f.options, f.dependencies), /applied review changed/);
});

test("state containment and the single-writer lock fail closed", async (t) => {
  const f = await fixture(t);
  await assert.rejects(conduct("prepare", { ...f.options, state: ".superbee/state" }, f.dependencies), /inside.*\.tmp/);
  await mkdir(path.join(f.root, ".tmp"));
  await symlink(path.join(f.root, ".superbee"), path.join(f.root, ".tmp/linked"));
  await assert.rejects(conduct("prepare", { ...f.options, state: ".tmp/linked/state" }, f.dependencies), /symlinks/);
  await mkdir(path.join(f.state, ".lock"), { recursive: true });
  await assert.rejects(conduct("prepare", f.options, f.dependencies), /locked/);
});

test("tarball admission checks exact integrity before any executable or npm command", async (t) => {
  const f = await fixture(t);
  await mkdir(f.state, { recursive: true });
  let invoked = 0;
  await assert.rejects(installEvidence(f.root, f.state, facts, async () => { invoked++; },
    async () => new Response("wrong bytes")), /integrity mismatch/);
  assert.equal(invoked, 0);
  const bytes = Buffer.from("test tarball");
  const exact = { ...facts, npmIntegrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}` };
  const identity = await installEvidence(f.root, f.state, exact, async (bin, args) => {
    if (bin === "npm") { assert.ok(args.includes("--ignore-scripts")); return ""; }
    return JSON.stringify({ identity: packed });
  }, async () => new Response(bytes));
  assert.deepEqual(identity, packed);
});

test("source diff uses the released tag rather than a newer checkout and rejects another remote", async (t) => {
  const f = await fixture(t);
  await realRun("git", ["remote", "add", "origin", "https://github.com/Holaxis-ai/superbee.git"], f.root);
  const base = (await realRun("git", ["rev-parse", "HEAD"], f.root)).trim();
  await writeFile(path.join(f.root, "released.txt"), "released");
  await realRun("git", ["add", "."], f.root);
  await realRun("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "release"], f.root);
  const head = (await realRun("git", ["rev-parse", "HEAD"], f.root)).trim();
  await realRun("git", ["tag", facts.sourceTag], f.root);
  await writeFile(path.join(f.root, "unreleased.txt"), "not in released evidence");
  const status = { sourceDiff: { base, head }, verifiedFacts: facts };
  assert.deepEqual(await sourceDiff(f.root, f.state, f.root, status, fixtureSourceRun(f.root)), ["released.txt"]);
  await realRun("git", ["remote", "set-url", "origin", "https://example.org/other.git"], f.root);
  await assert.rejects(sourceDiff(f.root, f.state, f.root, status, fixtureSourceRun(f.root)), /public Superbee/);
});

test("source diff compares a release cut from a branch the next release never merged", async (t) => {
  const f = await fixture(t);
  const git = (...args) => realRun("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", ...args], f.root);
  await git("remote", "add", "origin", "https://github.com/Holaxis-ai/superbee.git");
  const fork = (await git("rev-parse", "HEAD")).trim();
  await git("checkout", "-qb", "release-line");
  await writeFile(path.join(f.root, "release-only.txt"), "prepared on the release branch");
  await git("add", ".");
  await git("commit", "-qm", "prepare the documented release");
  const base = (await git("rev-parse", "HEAD")).trim();
  await git("checkout", "-q", fork);
  await writeFile(path.join(f.root, "next.txt"), "next release");
  await git("add", ".");
  await git("commit", "-qm", "next release");
  const head = (await git("rev-parse", "HEAD")).trim();
  await git("tag", facts.sourceTag);
  await assert.rejects(git("merge-base", "--is-ancestor", base, head));
  const status = { sourceDiff: { base, head }, verifiedFacts: facts };
  assert.deepEqual(await sourceDiff(f.root, f.state, f.root, status, fixtureSourceRun(f.root)), ["next.txt", "release-only.txt"]);
  await assert.rejects(sourceDiff(f.root, f.state, f.root, { ...status, sourceDiff: { base: "d".repeat(40), head } }, fixtureSourceRun(f.root)), /fetch/);
});

test("conductor drives the real release writer and CLI generator, preserving prior history on replay", async (t) => {
  const f = await fixture(t);
  await cp(".superbee", path.join(f.root, ".superbee"), { recursive: true });
  await cp("package.json", path.join(f.root, "package.json"));
  await cp("package-lock.json", path.join(f.root, "package-lock.json"));
  await symlink(path.resolve("node_modules"), path.join(f.root, "node_modules"));
  const actualIdentity = JSON.parse(await realRun(path.resolve("node_modules/.bin/superbee"), ["version", "--json"], process.cwd())).identity;
  const version = actualIdentity.package.version;
  const lock = await read("package-lock.json");
  const entry = lock.packages["node_modules/superbee"];
  const currentFacts = { ...facts, version, sourceTag: `v${version}`, sourceCommit: actualIdentity.source.commit,
    packageUrl: `https://www.npmjs.com/package/superbee/v/${version}`,
    sourceUrl: `https://github.com/Holaxis-ai/superbee/tree/v${version}`,
    tarballUrl: entry.resolved, npmIntegrity: entry.integrity };
  // Dispose only this fixture's current version pair; retained predecessor bytes are the oracle.
  await rm(path.join(f.root, `.superbee/releases/${version}.md`));
  await rm(path.join(f.root, `.superbee/sources/superbee-release-${version}.md`));
  const predecessor = await readFile(path.join(f.root, ".superbee/releases/0.1.4.md"));
  await writeFile(path.join(f.root, ".superbee/releases/current.md"), predecessor);
  await cp(path.join(f.root, ".superbee/sources/superbee-release-0.1.4.md"), path.join(f.root, ".superbee/sources/current-release.md"));
  f.dependencies.status = async () => ({ status: "update_required", documentedVersion: "0.1.4", verifiedFacts: currentFacts,
    sourceDiff: { base: "c".repeat(40), head: currentFacts.sourceCommit }, impactEvents: [] });
  f.dependencies.journeys = async () => ({ status: "passed", commands: 29, platform: process.platform, node: process.version, identity: actualIdentity });
  f.dependencies.install = async () => ({ package: actualIdentity.package, source: actualIdentity.source, artifact: actualIdentity.artifact });
  f.dependencies.run = async (bin, args, cwd) => {
    // Package is already installed from the repository lock; all writer/generator calls are real.
    if (bin === "npm" && args[0] === "install") return "";
    return realRun(bin, args, cwd);
  };
  await conduct("prepare", f.options, f.dependencies);
  const packet = await read(path.join(f.state, "packet.json"));
  await write(path.join(f.state, "release.json"), { ...manifestSkeleton(currentFacts), ...authored, verification: [...authored.verification, journeyVerification(packet.journeys)] });
  await write(path.join(f.state, "review.json"), { packetDigest: packet.digest, reviewedBy: "integration-test",
    pages: packet.affectedPages.map((id) => ({ id, disposition: "updated", reason: "Verified the real generator path." })) });
  assert.equal((await conduct("apply", f.options, f.dependencies)).status, "applied");
  const releaseBytes = await readFile(path.join(f.root, `.superbee/releases/${version}.md`));
  assert.equal((await conduct("apply", f.options, f.dependencies)).reused, true);
  assert.deepEqual(await readFile(path.join(f.root, `.superbee/releases/${version}.md`)), releaseBytes);
  assert.deepEqual(await readFile(path.join(f.root, ".superbee/releases/0.1.4.md")), predecessor);
  await realRun(process.execPath, ["scripts/release-docs.mjs", "check", "--superbee-bin", path.resolve("node_modules/.bin/superbee")], f.root);
  await realRun(process.execPath, ["scripts/cli-reference.mjs", "check"], f.root);
});

test("finalize requires authored review, binds machine verification, retries and reuses exact inputs", async (t) => {
  const f = await fixture(t);
  await conduct("prepare", f.options, f.dependencies);
  await assert.rejects(conduct("finalize", f.options, f.dependencies), /placeholder/);
  await f.review();
  const manifest = await read(path.join(f.state, "release.json"));
  await write(path.join(f.state, "release.json"), { ...manifest, verification: authored.verification });
  await assert.rejects(conduct("finalize", f.options, f.dependencies), /machine journey summary/);
  await write(path.join(f.state, "release.json"), manifest);
  f.interrupt();
  await assert.rejects(conduct("finalize", f.options, f.dependencies), /simulated interruption/);
  const verified = await conduct("finalize", f.options, f.dependencies);
  assert.equal(verified.status, "verified"); assert.equal(verified.journeys.commands, 29);
  assert.equal(f.calls.filter((call) => call === "ci").length, 1);
  const reused = await conduct("finalize", f.options, f.dependencies);
  assert.equal(reused.reused, true); assert.equal(reused.journeys.commands, 29);
  assert.equal(f.calls.filter((call) => call === "ci").length, 1);
  await writeFile(path.join(f.root, "scripts/vendor/package-verification/src/no-network.mjs"), "changed fixture guard");
  await assert.rejects(conduct("finalize", f.options, f.dependencies), /conductor tools changed/);
});

test("finalize current probe never implies verification and changed public authority blocks mutation", async (t) => {
  const f = await fixture(t);
  const initial = f.dependencies.status;
  f.dependencies.status = async () => ({ status: "current", verifiedFacts: facts });
  await conduct("prepare", f.options, f.dependencies);
  assert.deepEqual(await conduct("finalize", f.options, f.dependencies), {
    status: "current", changed: false, verification: "not-performed",
    next: "This captured authority probe performed no finalization checks. Use npm run check and fresh CI for verification; prepare a new state for fresh authority." });
  assert.deepEqual(f.calls, []);
  const options = { ...f.options, state: ".tmp/second" };
  f.dependencies.status = initial;
  await conduct("prepare", options, f.dependencies);
  const state = path.join(f.root, options.state), packet = await read(path.join(state, "packet.json"));
  await write(path.join(state, "release.json"), { ...manifestSkeleton(facts), ...authored, verification: [...authored.verification, journeyVerification(packet.journeys)] });
  await write(path.join(state, "review.json"), { packetDigest: packet.digest, reviewedBy: "test", pages: packet.affectedPages.map((id) => ({ id, disposition: "updated", reason: "Reviewed." })) });
  f.dependencies.status = async () => ({ ...(await initial()), verifiedFacts: { ...facts, sourceCommit: "e".repeat(40) } });
  const before = f.calls.length;
  await assert.rejects(conduct("finalize", options, f.dependencies), /public release authority changed/);
  assert.ok(!f.calls.slice(before).some((call) => call.startsWith("install ") || call === "ci"));
});

test("dependency denial precedes install and ci and preserves docs and installed files", async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, "node_modules"));
  await writeFile(path.join(f.root, "node_modules/retained"), "preserved");
  await conduct("prepare", f.options, f.dependencies); await f.review();
  const files = [".superbee/releases/current.md", "package.json", "package-lock.json", "node_modules/retained"];
  const snapshot = () => Promise.all(files.map((name) => readFile(path.join(f.root, name))));
  const before = await snapshot();
  f.dependencies.preflight = async () => { throw new Error("sanitized registry access failure"); };
  const start = f.calls.length;
  await assert.rejects(conduct("finalize", f.options, f.dependencies), /registry access failure/);
  assert.ok(!f.calls.slice(start).some((call) => call.startsWith("install ") || call === "ci"));
  assert.deepEqual(await snapshot(), before);
  f.dependencies.preflight = async () => {};
  await conduct("apply", f.options, f.dependencies);
  const applied = await snapshot(), checkStart = f.calls.length;
  f.dependencies.preflight = async () => { throw new Error("sanitized registry access failure"); };
  await assert.rejects(conduct("check", f.options, f.dependencies), /registry access failure/);
  assert.ok(!f.calls.slice(checkStart).includes("ci"));
  assert.deepEqual(await snapshot(), applied);
});

test("source refresh fills missing tag in private cache and preserves supplied checkout and conflicting refs", async (t) => {
  const f = await fixture(t);
  const git = (...args) => realRun("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", ...args], f.root);
  const base = (await git("rev-parse", "HEAD")).trim();
  const supplied = path.join(f.root, ".tmp/stale-source");
  await realRun("git", ["clone", "-q", f.root, supplied], f.root);
  await realRun("git", ["remote", "set-url", "origin", "https://github.com/Holaxis-ai/superbee.git"], supplied);
  await writeFile(path.join(supplied, "local-edit.txt"), "uncommitted preserved");
  await writeFile(path.join(f.root, "released.txt"), "released"); await git("add", "."); await git("commit", "-qm", "released");
  const head = (await git("rev-parse", "HEAD")).trim(); await git("tag", "-a", facts.sourceTag, "-m", "release");
  const status = { sourceDiff: { base, head }, verifiedFacts: facts };
  const run = fixtureSourceRun(f.root);
  assert.deepEqual(await sourceDiff(f.root, f.state, supplied, status, run), ["released.txt"]);
  assert.equal((await realRun("git", ["rev-parse", "HEAD"], supplied)).trim(), base);
  assert.equal((await realRun("git", ["tag", "--list"], supplied)).trim(), "");
  assert.equal(await readFile(path.join(supplied, "local-edit.txt"), "utf8"), "uncommitted preserved");
  await realRun("git", ["tag", facts.sourceTag, base], supplied);
  await assert.rejects(sourceDiff(f.root, f.state, supplied, status, run), /supplied source tag contradicts/);
  assert.equal((await realRun("git", ["rev-parse", facts.sourceTag], supplied)).trim(), base);
  const cache = path.join(f.state, "source-cache"), ref = "refs/release-conductor/verified-tag";
  await realRun("git", ["update-ref", ref, base], cache);
  await assert.rejects(sourceDiff(f.root, f.state, undefined, status, run), /private source tag contradicts/);
  assert.equal((await realRun("git", ["rev-parse", ref], cache)).trim(), base);
});

test("transported JSON review reconstructs captured executable and rejects a changed artifact before apply", async (t) => {
  const f = await fixture(t);
  await conduct("prepare", f.options, f.dependencies); await f.review();
  const imported = { ...f.options, state: ".tmp/imported-review" };
  const state = path.join(f.root, imported.state);
  await mkdir(state, { recursive: true });
  for (const name of ["packet.json", "release.json", "review.json"]) await cp(path.join(f.state, name), path.join(state, name));
  const files = [".superbee/releases/current.md", "package.json", "package-lock.json"];
  const before = await Promise.all(files.map((name) => readFile(path.join(f.root, name))));
  const install = f.dependencies.install;
  f.dependencies.install = async () => ({ ...packed, artifact: { ...packed.artifact, sha256: `sha256:${"e".repeat(64)}` } });
  const start = f.calls.length;
  await assert.rejects(conduct("finalize", imported, f.dependencies), /artifact digest differs/);
  assert.ok(!f.calls.slice(start).some((call) => call.startsWith("install ") || call === "ci"));
  assert.deepEqual(await Promise.all(files.map((name) => readFile(path.join(f.root, name)))), before);
  f.dependencies.install = install;
  assert.equal((await conduct("finalize", imported, f.dependencies)).status, "verified");
  assert.equal(f.calls.filter((call) => call === "install-evidence").length, 2);
});

test("a changed annotated tag object cannot overwrite an admitted private cache ref", async (t) => {
  const f = await fixture(t);
  const git = (...args) => realRun("git", ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", ...args], f.root);
  const head = (await git("rev-parse", "HEAD")).trim();
  await git("tag", "-a", facts.sourceTag, "-m", "original annotation");
  const status = { sourceDiff: { base: head, head }, verifiedFacts: facts };
  const run = fixtureSourceRun(f.root);
  await sourceDiff(f.root, f.state, undefined, status, run);
  const cache = path.join(f.state, "source-cache"), ref = "refs/release-conductor/verified-tag";
  const original = (await realRun("git", ["rev-parse", ref], cache)).trim();
  await git("tag", "-fa", facts.sourceTag, "-m", "changed annotation");
  await assert.rejects(sourceDiff(f.root, f.state, undefined, status, run), /tag object changed/);
  assert.equal((await realRun("git", ["rev-parse", ref], cache)).trim(), original);
  assert.equal((await realRun("git", ["for-each-ref", "--format=%(refname)", "refs/release-conductor/fetch-"], cache)).trim(), "");
});
