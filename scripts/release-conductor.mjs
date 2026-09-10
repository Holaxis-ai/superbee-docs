import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { releaseDocumentationStatus } from "./release-maintenance.mjs";
import { loadDocumentationTriggerRecords, queryDocumentationImpact } from "./documentation-impact.mjs";
import { validateInput } from "./release-docs.mjs";

const exec = promisify(execFile);
const SCHEMA = "superbee-docs-release-packet.v1";
const FACTS = ["schema", "package", "version", "npmTag", "publishedAt", "packageUrl", "tarballUrl",
  "npmIntegrity", "sourceUrl", "sourceCommit", "sourceTag", "nodeRequirement"];
const AUTHORED = ["summary", "changes", "action", "compatibility", "recovery", "supportedPlatforms", "verification"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
const fail = (message) => { throw new Error(message); };

async function optionalJson(file) {
  try { return await json(file); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
async function save(file, value) {
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}
async function command(bin, args, cwd) {
  try {
    const { stdout } = await exec(bin, args, { cwd, maxBuffer: 32 * 1024 * 1024, timeout: 15 * 60_000 });
    return stdout;
  } catch {
    // Do not echo arbitrary subprocess output: npm/Git/provider diagnostics can contain credentials.
    fail(`${path.basename(bin)} ${args[0] ?? ""} failed; inspect the relevant tool locally`);
  }
}
async function toolDigest(root) {
  const files = ["scripts/release-conductor.mjs", "scripts/release-maintenance.mjs", "scripts/release-docs.mjs",
    "scripts/cli-reference.mjs", "scripts/documentation-impact.mjs"];
  return hash(Buffer.concat(await Promise.all(files.map((file) => readFile(path.join(root, file))))));
}
export async function checkoutIdentity(root, run = command) {
  const head = (await run("git", ["rev-parse", "HEAD"], root)).trim();
  const names = (await run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], root))
    .split("\0").filter(Boolean).sort();
  const rows = [];
  for (const file of [...new Set(names)]) {
    try {
      const stat = await lstat(path.join(root, file));
      if (!stat.isFile()) fail(`unsupported checkout entry: ${file}`);
      rows.push([file, stat.mode & 0o111, hash(await readFile(path.join(root, file)))]);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      rows.push([file, "deleted"]);
    }
  }
  return { head, tree: hash(JSON.stringify(rows)), node: process.version };
}
export function manifestSkeleton(facts) {
  return { ...Object.fromEntries(FACTS.map((key) => [key, facts[key]])),
    ...Object.fromEntries(AUTHORED.map((key) => [key,
      ["changes", "supportedPlatforms", "verification"].includes(key) ? ["REPLACE_WITH_REVIEWED_CONTENT"] : "REPLACE_WITH_REVIEWED_CONTENT"])) };
}
export function assertPackageIdentity(identity, facts, artifact) {
  if (identity?.identity?.package?.name !== "superbee" || identity.identity.package.version !== facts.version ||
      identity.identity.source?.commit !== facts.sourceCommit || identity.identity.source?.dirty !== false ||
      identity.identity.artifact?.channel !== "npm-package") fail("packed package identity disagrees with the verified release");
  if (!/^sha256:[a-f0-9]{64}$/.test(identity.identity.artifact.sha256 ?? "") ||
      (artifact && artifact.sha256 !== identity.identity.artifact.sha256)) fail("packed artifact digest differs from frozen evidence");
}
async function executionFiles(root) {
  const digest = createHash("sha256");
  let externalLink = false;
  async function visit(file) {
    let stat;
    try { stat = await lstat(path.join(root, file)); }
    catch (error) { if (error.code !== "ENOENT") throw error; digest.update(`${file}:missing\n`); return; }
    digest.update(`${file}:${stat.mode}\n`);
    if (stat.isSymbolicLink()) {
      digest.update(await readlink(path.join(root, file)));
      const target = await realpath(path.join(root, file));
      // Hash explicitly linked executable files (including the locked Python interpreter).
      // External dependency directories are uncacheable; never traverse an unrelated tree.
      if ((await lstat(target)).isFile()) digest.update(hash(await readFile(target)));
      else if (!target.startsWith(`${root}${path.sep}`)) externalLink = true;
    }
    else if (stat.isDirectory()) for (const name of (await readdir(path.join(root, file))).sort()) await visit(path.join(file, name));
    else if (stat.isFile()) digest.update(hash(await readFile(path.join(root, file))));
  }
  // Reuse is earned by actual installed inputs and generated outputs, not just an unchanged lockfile.
  for (const file of ["node_modules", ".deps", "dist", "deploy", ".tmp/mkdocs"]) await visit(file);
  return externalLink ? null : digest.digest("hex");
}
export function assertReview(packet, manifest, review) {
  validateInput(manifest);
  for (const field of FACTS) if (manifest[field] !== packet.manifestFacts[field]) fail(`review changed verified fact: ${field}`);
  if (review?.packetDigest !== packet.digest || typeof review?.reviewedBy !== "string" || !review.reviewedBy.trim()) {
    fail("review must name its reviewer and the exact packet digest");
  }
  if (!Array.isArray(review.pages) || review.pages.length !== packet.affectedPages.length) fail("review must cover every affected page exactly once");
  for (const id of packet.affectedPages) {
    const rows = review.pages.filter((row) => row.id === id);
    if (rows.length !== 1 || !["updated", "no-change"].includes(rows[0].disposition) ||
        typeof rows[0].reason !== "string" || !rows[0].reason.trim() || /REPLACE_WITH|\bTODO\b/i.test(rows[0].reason)) {
      fail(`affected page needs a concrete disposition: ${id}`);
    }
  }
}
function validatePacket(packet) {
  const { digest, ...content } = packet;
  if (packet.schema !== SCHEMA || digest !== hash(JSON.stringify(content))) fail("packet is damaged or edited; prepare a new state directory");
  return packet;
}

// Each release has a private, ignored working directory. Never write state into a real bundle.
async function stateDirectory(root, requested) {
  const base = path.join(await realpath(root), ".tmp");
  const state = path.resolve(root, requested ?? ".tmp/release-conductor");
  if (!state.startsWith(`${base}${path.sep}`)) fail("state must be inside this repository's .tmp directory");
  let current = await realpath(root);
  for (const part of path.relative(current, state).split(path.sep)) {
    current = path.join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) fail("state path may not contain symlinks"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    await mkdir(current, { recursive: true });
  }
  return state;
}

export async function installEvidence(root, state, facts, run, fetcher) {
  const tarball = path.join(state, "superbee.tgz");
  let bytes;
  try { bytes = await readFile(tarball); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetcher(facts.tarballUrl, { signal: AbortSignal.timeout(60_000), redirect: "error" });
    if (!response.ok) fail("release tarball could not be downloaded");
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (`sha512-${createHash("sha512").update(bytes).digest("base64")}` !== facts.npmIntegrity) fail("release tarball integrity mismatch");
  await writeFile(tarball, bytes, { mode: 0o600 });
  const prefix = path.join(state, "package");
  await mkdir(prefix, { recursive: true });
  await writeFile(path.join(prefix, "package.json"), '{"private":true}\n');
  await run("npm", ["install", "--prefix", prefix, "--ignore-scripts", "--no-audit", "--no-fund", tarball], root);
  const bin = path.join(prefix, "node_modules", ".bin", "superbee");
  const identity = JSON.parse(await run(bin, ["version", "--json"], root));
  assertPackageIdentity(identity, facts);
  return { package: identity.identity.package, source: identity.identity.source, artifact: identity.identity.artifact };
}
export async function sourceDiff(root, state, supplied, status, run) {
  let source = supplied && path.resolve(root, supplied);
  if (!source) {
    source = path.join(state, "source");
    try { await lstat(path.join(source, ".git")); } catch {
      await run("git", ["clone", "--filter=blob:none", "--no-checkout", "https://github.com/Holaxis-ai/superbee.git", source], root);
    }
  }
  const remote = (await run("git", ["remote", "get-url", "origin"], source)).trim();
  if (!["https://github.com/Holaxis-ai/superbee.git", "https://github.com/Holaxis-ai/superbee", "git@github.com:Holaxis-ai/superbee.git"].includes(remote)) fail("source checkout is not the public Superbee repository");
  const { base, head } = status.sourceDiff;
  if (![base, head].every((sha) => /^[a-f0-9]{40}$/.test(sha))) fail("source diff requires exact commits");
  const tag = (await run("git", ["rev-parse", `${status.verifiedFacts.sourceTag}^{commit}`], source)).trim();
  if (tag !== head) fail("source checkout tag differs from verified release");
  await run("git", ["merge-base", "--is-ancestor", base, head], source);
  return (await run("git", ["diff", "--name-only", "--no-renames", "-z", `${base}..${head}`, "--"], source)).split("\0").filter(Boolean).sort();
}

export async function conduct(mode, options, dependencies = {}) {
  const root = await realpath(options.root ?? ".");
  const state = await stateDirectory(root, options.state);
  const run = dependencies.run ?? command;
  const fetcher = dependencies.fetch ?? fetch;
  const lock = path.join(state, ".lock");
  try { await mkdir(lock); } catch { fail("conductor state is locked; inspect the interrupted owner before removing .lock"); }
  const repositoryLock = path.join(root, ".tmp", ".release-apply.lock");
  let ownsRepositoryLock = false;
  try {
    if (["apply", "check"].includes(mode)) {
      try { await mkdir(repositoryLock); ownsRepositoryLock = true; }
      catch { fail("repository release writer is locked; inspect the owner of .tmp/.release-apply.lock"); }
    }
    const packetPath = path.join(state, "packet.json");
    let packet = await optionalJson(packetPath);
    if (packet) validatePacket(packet);
    if (mode === "prepare" && !packet) {
      const status = await (dependencies.status ?? releaseDocumentationStatus)({ root,
        registry: "https://registry.npmjs.org", githubApi: "https://api.github.com/repos/Holaxis-ai/superbee",
        githubToken: process.env.GITHUB_TOKEN });
      const identity = await checkoutIdentity(root, run);
      const toolchain = await toolDigest(root);
      let packageIdentity = null;
      let changedPaths = [];
      let affectedPages = [];
      if (status.status === "update_required") {
        packageIdentity = await (dependencies.install ?? installEvidence)(root, state, status.verifiedFacts, run, fetcher);
        changedPaths = await (dependencies.diff ?? sourceDiff)(root, state, options.source, status, run);
        const records = await (dependencies.triggers ?? loadDocumentationTriggerRecords)(root);
        affectedPages = [...new Set(queryDocumentationImpact(records, { changed: changedPaths, events: status.impactEvents })
          .flatMap((row) => row.pages))].sort();
      } else if (status.status !== "current") fail("unexpected release authority status");
      const skeleton = manifestSkeleton(status.verifiedFacts);
      const content = { schema: SCHEMA, status: status.status, identity, toolchain, evidence: status,
        manifestFacts: Object.fromEntries(FACTS.map((key) => [key, skeleton[key]])),
        packageIdentity, changedPaths, affectedPages };
      packet = { ...content, digest: hash(JSON.stringify(content)) };
      if (status.status === "update_required") {
        // Publish packet last: incomplete preparation cannot masquerade as a usable handoff.
        for (const [name, value] of [["release.json", skeleton], ["review.json", { packetDigest: packet.digest,
          reviewedBy: "", pages: affectedPages.map((id) => ({ id, disposition: "", reason: "" })) }]]) {
          const existing = await optionalJson(path.join(state, name));
          if (existing) fail(`incomplete preparation contains ${name}; use a new state directory to preserve authored work`);
          await save(path.join(state, name), value);
        }
      }
      await save(packetPath, packet);
    }
    if (!packet) fail("prepare a release packet first");
    if (packet.toolchain !== await toolDigest(root)) fail("conductor tools changed; prepare a new state directory");
    if (mode === "status" || mode === "prepare") return { status: packet.status, version: packet.manifestFacts.version,
      packetDigest: packet.digest, affectedPages: packet.affectedPages,
      next: packet.status === "current" ? "No update was needed when captured; use a new state directory for a fresh authority check."
        : "Review release.json and every review.json page; run apply, then check. No merge or deployment is automatic." };
    if (packet.status === "current") return { status: "current", changed: false };
    const manifestPath = path.join(state, "release.json");
    const manifest = await json(manifestPath);
    const review = await json(path.join(state, "review.json"));
    assertReview(packet, manifest, review);
    const reviewDigest = hash(JSON.stringify({ manifest, review }));
    const receiptPath = path.join(state, "receipt.json");
    let receipt = await optionalJson(receiptPath) ?? { packetDigest: packet.digest, reviewDigest, steps: [] };
    if (receipt.packetDigest !== packet.digest || receipt.reviewDigest !== reviewDigest) fail("applied review changed; start a new packet instead of rewriting release history");
    await run("git", ["merge-base", "--is-ancestor", packet.identity.head, "HEAD"], root);
    const installedBin = path.join(root, "node_modules", ".bin", "superbee");
    const installedIdentity = async () => assertPackageIdentity(JSON.parse(await run(installedBin, ["version", "--json"], root)), manifest, packet.packageIdentity.artifact);
    if (mode === "apply") {
      const current = await readFile(path.join(root, ".superbee", "releases", "current.md"), "utf8");
      const version = current.match(/^version: ["']?([^"'\n]+)["']?$/m)?.[1];
      if (![packet.evidence.documentedVersion, manifest.version].includes(version)) fail("documented release advanced since this packet");
      const before = await checkoutIdentity(root, run);
      if (!receipt.pending && receipt.applied && canonical(receipt.applied) === canonical(before)) {
        await installedIdentity();
        return { status: "applied", reused: true, packetDigest: packet.digest };
      }
      // Persist the immutable review binding before the first potentially mutating operation.
      await save(receiptPath, receipt);
      const step = async (name, action) => {
        receipt.pending = name;
        await save(receiptPath, receipt);
        await action();
        receipt.steps.push({ name, identity: await checkoutIdentity(root, run) });
        delete receipt.pending;
        await save(receiptPath, receipt);
      };
      await step("package", async () => {
        await run("npm", ["install", "--save-exact", "--ignore-scripts", "--no-audit", "--no-fund", `superbee@${manifest.version}`], root);
        const lockfile = await json(path.join(root, "package-lock.json"));
        const entry = lockfile.packages?.["node_modules/superbee"];
        if (entry?.version !== manifest.version || entry.integrity !== manifest.npmIntegrity || entry.resolved !== manifest.tarballUrl) fail("installed lockfile differs from frozen package evidence");
        await installedIdentity();
      });
      await step("release", () => run(process.execPath, ["scripts/release-docs.mjs", "update", "--manifest", manifestPath,
        "--superbee-bin", installedBin], root));
      await step("cli-reference", () => run(process.execPath, ["scripts/cli-reference.mjs", "build"], root));
      receipt.applied = await checkoutIdentity(root, run);
      delete receipt.verified;
      await save(receiptPath, receipt);
      return { status: "applied", reused: false, packetDigest: packet.digest, next: "Run check after completing reader-page edits." };
    }
    if (mode !== "check") fail("expected prepare, status, apply, or check");
    if (!receipt.applied || receipt.pending) fail("complete apply before verification");
    const identity = await checkoutIdentity(root, run);
    if (receipt.verified && receipt.executionFiles && canonical(receipt.verified) === canonical(identity) && receipt.executionFiles === await executionFiles(root)) {
      await installedIdentity();
      return { status: "verified", reused: true, identity };
    }
    delete receipt.verified;
    await save(receiptPath, receipt);
    for (const args of [["ci"], ["run", "source:sync"], ["run", "portal:build"], ["run", "mkdocs:sync"], ["run", "check"]]) {
      await run("npm", args, root);
    }
    await installedIdentity();
    const after = await checkoutIdentity(root, run);
    if (canonical(identity) !== canonical(after)) fail("checkout changed during verification; rerun check");
    receipt.verified = after;
    receipt.executionFiles = await executionFiles(root);
    await save(receiptPath, receipt);
    return { status: "verified", reused: false, identity: after, next: "Review and commit the diff; CI and production verification remain required." };
  } catch (error) {
    await save(path.join(state, "failure.json"), { status: "blocked", mode, reason: error.message });
    throw error;
  } finally {
    if (ownsRepositoryLock) await rm(repositoryLock, { recursive: true });
    await rm(lock, { recursive: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [mode, ...args] = process.argv.slice(2);
  try {
    if (mode === "--help") console.log("release-conductor prepare|status|apply|check [--root PATH] [--state .tmp/PATH] [--source CHECKOUT]\nPrepare captures evidence; edit release.json and review.json before apply. No publish, merge, or deploy action exists.");
    else {
      if (!["prepare", "status", "apply", "check"].includes(mode)) fail("expected prepare, status, apply, or check");
      const options = {};
      for (let i = 0; i < args.length; i += 2) {
        if (!["--root", "--state", "--source"].includes(args[i]) || !args[i + 1]) fail("invalid conductor option");
        options[args[i].slice(2)] = args[i + 1];
      }
      const result = await conduct(mode, options);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) { console.error(JSON.stringify({ status: "blocked", reason: error.message })); process.exitCode = 1; }
}
