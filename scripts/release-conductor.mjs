import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { releaseDocumentationStatus } from "./release-maintenance.mjs";
import { loadDocumentationTriggerRecords, queryDocumentationImpact } from "./documentation-impact.mjs";
import { validateInput } from "./release-docs.mjs";
import { dependencyPreflight } from "./release-dependency-preflight.mjs";
import { packageJourneys } from "./release-package-journeys.mjs";

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
    "scripts/cli-reference.mjs", "scripts/documentation-impact.mjs", "scripts/release-dependency-preflight.mjs",
    "scripts/release-package-journeys.mjs", ... (await readdir(path.join(root, "scripts/release-journey-fixtures")))
      .sort().map((name) => `scripts/release-journey-fixtures/${name}`), ".github/workflows/check.yml"];
  const manifest = await json(path.join(root, "package.json"));
  return hash(JSON.stringify({ scripts: manifest.scripts, engines: manifest.engines,
    files: await Promise.all(files.map(async (file) => [file, hash(await readFile(path.join(root, file)))])) }));
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
export function journeyVerification(journeys) {
  if (journeys?.status !== "passed" || !Number.isInteger(journeys.commands) || journeys.commands < 1 ||
      !["darwin", "linux"].includes(journeys.platform) || !/^v\d+\.\d+\.\d+/.test(journeys.node ?? "")) {
    fail("captured package journeys need a successful machine receipt");
  }
  return `The captured npm package completed ${journeys.commands} credential-free installed command probes on ${journeys.platform} / Node ${journeys.node}: document CAS and stale refusal, Kind order, hosted help, local operation refusal, and hosted checkout/read/operation fixtures. Production host acceptance and live OAuth/write/conflict/deletion/transfer journeys are not established by these fixtures.`;
}
export function manifestSkeleton(facts, journeys) {
  return { ...Object.fromEntries(FACTS.map((key) => [key, facts[key]])),
    ...Object.fromEntries(AUTHORED.map((key) => [key,
      ["changes", "supportedPlatforms", "verification"].includes(key) ?
        ["REPLACE_WITH_REVIEWED_CONTENT", ...(key === "verification" && journeys ? [journeyVerification(journeys)] : [])] : "REPLACE_WITH_REVIEWED_CONTENT"])) };
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
  if (packet.journeys && !manifest.verification.includes(journeyVerification(packet.journeys))) {
    fail("reviewed verification must retain the captured machine journey summary");
  }
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
  // The admitted packed CLI is self-contained. Refuse unexpected network dependencies rather
  // than letting isolated evidence capture reach a configured private registry.
  await run("npm", ["install", "--prefix", prefix, "--offline", "--ignore-scripts", "--no-audit", "--no-fund", tarball], root);
  const bin = path.join(prefix, "node_modules", ".bin", "superbee");
  const identity = JSON.parse(await run(bin, ["version", "--json"], root));
  assertPackageIdentity(identity, facts);
  return { package: identity.identity.package, source: identity.identity.source, artifact: identity.identity.artifact };
}
export async function sourceDiff(root, state, supplied, status, run) {
  const { base, head } = status.sourceDiff;
  if (![base, head].every((sha) => /^[a-f0-9]{40}$/.test(sha))) fail("source diff requires exact commits");
  const sourceTag = status.verifiedFacts.sourceTag;
  if (!/^v\d+\.\d+\.\d+$/.test(sourceTag)) fail("source diff requires a stable release tag");
  if (supplied) {
    const source = path.resolve(root, supplied);
    const remote = (await run("git", ["remote", "get-url", "origin"], source)).trim();
    if (!["https://github.com/Holaxis-ai/superbee.git", "https://github.com/Holaxis-ai/superbee", "git@github.com:Holaxis-ai/superbee.git"].includes(remote)) fail("source checkout is not the public Superbee repository");
    const localTag = (await run("git", ["for-each-ref", "--format=%(refname)", `refs/tags/${sourceTag}`], source)).trim();
    if (localTag && (await run("git", ["rev-parse", `${sourceTag}^{commit}`], source)).trim() !== head) {
      fail("supplied source tag contradicts verified release; existing tags were not changed");
    }
  }
  // Fetch only into ignored, state-owned storage. Never fetch, checkout, or rewrite refs in a
  // supplied checkout. A conflicting private ref also fails instead of being force-updated.
  const source = path.join(state, "source-cache");
  try { if ((await lstat(source)).isSymbolicLink()) fail("source cache may not be a symlink"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await mkdir(source, { recursive: true });
  await run("git", ["init", "--bare", "--quiet", source], root);
  const privateTag = "refs/release-conductor/verified-tag";
  const publicSource = "https://github.com/Holaxis-ai/superbee.git";
  const existing = (await run("git", ["for-each-ref", "--format=%(objectname)", privateTag], source)).trim();
  if (existing && (await run("git", ["rev-parse", `${privateTag}^{commit}`], source)).trim() !== head) {
    fail("private source tag contradicts verified release; cached ref was not changed");
  }
  const fetchedRef = `refs/release-conductor/fetch-${randomUUID()}`;
  try {
    await run("git", ["fetch", "--no-tags", "--no-write-fetch-head", "--depth=1", publicSource,
      `refs/tags/${sourceTag}:${fetchedRef}`], source);
    const fetched = (await run("git", ["rev-parse", fetchedRef], source)).trim();
    const tag = (await run("git", ["rev-parse", `${fetchedRef}^{commit}`], source)).trim();
    if (tag !== head) fail("source checkout tag differs from verified release");
    if (existing && existing !== fetched) fail("private source tag object changed; cached ref was not changed");
    await run("git", ["update-ref", privateTag, fetched, existing || "0".repeat(40)], source);
  } finally { await run("git", ["update-ref", "-d", fetchedRef], source); }
  // Compare the two released trees directly. A stable release may be cut from a release branch whose
  // own commits never reach the next release's line, so ancestry is not required; any base-only
  // change that the new release lacks is a real difference and stays in the impact set.
  await run("git", ["fetch", "--no-tags", "--no-write-fetch-head", "--depth=1", publicSource, base], source);
  await run("git", ["cat-file", "-e", `${base}^{commit}`], source);
  return (await run("git", ["diff", "--name-only", "--no-renames", "-z", base, head, "--"], source)).split("\0").filter(Boolean).sort();
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
    if (["apply", "check", "finalize"].includes(mode)) {
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
      let journeys = null;
      if (status.status === "update_required") {
        packageIdentity = await (dependencies.install ?? installEvidence)(root, state, status.verifiedFacts, run, fetcher);
        journeys = await (dependencies.journeys ?? packageJourneys)({
          bin: path.join(state, "package/node_modules/.bin/superbee"),
          facts: { ...status.verifiedFacts, artifact: packageIdentity.artifact } });
        if (journeys.status !== "passed") fail("captured package journeys did not pass");
        assertPackageIdentity(journeys, status.verifiedFacts, packageIdentity.artifact);
        changedPaths = await (dependencies.diff ?? sourceDiff)(root, state, options.source, status, run);
        const records = await (dependencies.triggers ?? loadDocumentationTriggerRecords)(root);
        affectedPages = [...new Set(queryDocumentationImpact(records, { changed: changedPaths, events: status.impactEvents })
          .flatMap((row) => row.pages))].sort();
      } else if (status.status !== "current") fail("unexpected release authority status");
      const skeleton = manifestSkeleton(status.verifiedFacts, journeys);
      const content = { schema: SCHEMA, status: status.status, identity, toolchain, evidence: status,
        manifestFacts: Object.fromEntries(FACTS.map((key) => [key, skeleton[key]])),
        packageIdentity, journeys, changedPaths, affectedPages };
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
      verification: "not-performed", publication: { capturedDocumentedVersion: packet.evidence.documentedVersion,
        capturedNpmVersion: packet.manifestFacts.version, capturedState: packet.status === "current" ? "no-update-at-capture" : "update-required-at-capture" },
      next: packet.status === "current" ? "No update was needed when captured; use a new state directory for a fresh authority check."
        : "Review release.json, captured journeys, and every review.json page; author the affected pages, then run finalize. CI and merge remain separate." };
    if (packet.status === "current") return { status: "current", changed: false, verification: "not-performed",
      next: "This captured authority probe performed no finalization checks. Use npm run check and fresh CI for verification; prepare a new state for fresh authority." };
    const manifestPath = path.join(state, "release.json");
    const manifest = await json(manifestPath);
    const review = await json(path.join(state, "review.json"));
    assertReview(packet, manifest, review);
    if (mode === "finalize") {
      const currentAuthority = await (dependencies.status ?? releaseDocumentationStatus)({ root,
        registry: "https://registry.npmjs.org", githubApi: "https://api.github.com/repos/Holaxis-ai/superbee",
        githubToken: process.env.GITHUB_TOKEN });
      for (const key of FACTS) if (currentAuthority.verifiedFacts[key] !== packet.manifestFacts[key]) {
        fail("public release authority changed since preparation; prepare and review a new packet before finalizing");
      }
    }
    const reviewDigest = hash(JSON.stringify({ manifest, review }));
    const receiptPath = path.join(state, "receipt.json");
    let receipt = await optionalJson(receiptPath) ?? { packetDigest: packet.digest, reviewDigest, steps: [] };
    if (receipt.packetDigest !== packet.digest || receipt.reviewDigest !== reviewDigest) fail("applied review changed; start a new packet instead of rewriting release history");
    await run("git", ["merge-base", "--is-ancestor", packet.identity.head, "HEAD"], root);
    const installedBin = path.join(root, "node_modules", ".bin", "superbee");
    const installedIdentity = async () => assertPackageIdentity(JSON.parse(await run(installedBin, ["version", "--json"], root)), manifest, packet.packageIdentity.artifact);
    if (mode === "apply" || mode === "finalize") {
      const current = await readFile(path.join(root, ".superbee", "releases", "current.md"), "utf8");
      const version = current.match(/^version: ["']?([^"'\n]+)["']?$/m)?.[1];
      if (![packet.evidence.documentedVersion, manifest.version].includes(version)) fail("documented release advanced since this packet");
      const before = await checkoutIdentity(root, run);
      if (!receipt.pending && receipt.applied && canonical(receipt.applied) === canonical(before)) {
        await installedIdentity();
        if (mode === "apply") return { status: "applied", reused: true, packetDigest: packet.digest };
      } else {
        await (dependencies.preflight ?? dependencyPreflight)(root, { run, replacement: manifest });
        // Nightly review artifacts transport JSON, not installed executables. Reconstruct the
        // admitted package from frozen tarball facts and check its artifact before using it.
        const captured = await (dependencies.install ?? installEvidence)(root, state, manifest, run, fetcher);
        assertPackageIdentity({ identity: captured }, manifest, packet.packageIdentity.artifact);
        const journeys = await (dependencies.journeys ?? packageJourneys)({
          bin: path.join(state, "package/node_modules/.bin/superbee"), facts: { ...manifest, artifact: packet.packageIdentity.artifact } });
        if (journeys.status !== "passed") fail("captured package journeys did not pass");
        assertPackageIdentity(journeys, manifest, packet.packageIdentity.artifact);
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
        receipt.journeys = journeys;
        delete receipt.verified;
        await save(receiptPath, receipt);
        if (mode === "apply") return { status: "applied", reused: false, packetDigest: packet.digest, next: "Run check after completing reader-page edits." };
      }
    }
    if (!["check", "finalize"].includes(mode)) fail("expected prepare, status, apply, check, or finalize");
    if (!receipt.applied || receipt.pending) fail("complete apply before verification");
    const identity = await checkoutIdentity(root, run);
    if (receipt.verified && receipt.executionFiles && canonical(receipt.verified) === canonical(identity) && receipt.executionFiles === await executionFiles(root)) {
      await installedIdentity();
      return { status: "verified", reused: true, identity, journeys: receipt.journeys,
        next: "Exact local inputs reused. Independent exact-head review and fresh required CI remain required before a separately authorized merge." };
    }
    delete receipt.verified;
    await save(receiptPath, receipt);
    await (dependencies.preflight ?? dependencyPreflight)(root, { run });
    for (const args of [["ci"], ["run", "source:sync"], ["run", "portal:build"], ["run", "mkdocs:sync"], ["run", "check"]]) {
      await run("npm", args, root);
    }
    await installedIdentity();
    const after = await checkoutIdentity(root, run);
    if (canonical(identity) !== canonical(after)) fail("checkout changed during verification; rerun check");
    receipt.verified = after;
    receipt.executionFiles = await executionFiles(root);
    await save(receiptPath, receipt);
    return { status: "verified", reused: false, identity: after, journeys: receipt.journeys,
      next: "Review and commit the diff. Independent exact-head review and fresh required CI remain required before a separately authorized merge." };
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
    if (mode === "--help") console.log("release-conductor prepare|status|apply|check|finalize [--root PATH] [--state .tmp/PATH] [--source CHECKOUT]\nPrepare captures evidence and isolated journeys; review release.json and review.json, then finalize applies and checks under one lock. No publish, merge, or deploy action exists.");
    else {
      if (!["prepare", "status", "apply", "check", "finalize"].includes(mode)) fail("expected prepare, status, apply, check, or finalize");
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
