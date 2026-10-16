// hosted-content: the docs site's content lives in the hosted bundle holaxis-sites/superbee-docs
// (superbee-dev decision sites-content-lives-in-hosted-2026-10-16). Git keeps code and config.
//
//   node scripts/hosted-content.mjs export --to <new folder>    verified export of the hosted bundle
//   node scripts/hosted-content.mjs materialize --from <export>  make .superbee the export (+ git config)
//   node scripts/hosted-content.mjs acquire                      export, then materialize
//   node scripts/hosted-content.mjs compare [--from <export>]    hosted versus .superbee, file by file
//   node scripts/hosted-content.mjs baseline [--check]           write or check freshness-baseline.json
//
// `export` runs the pinned `superbee export`, which verifies every entry against the host's digest
// manifest before it writes a file. A person's session needs nothing more; CI wraps the command in
// scripts/hosted-workload-token.mjs, which supplies SUPERBEE_ACCESS_TOKEN and SUPERBEE_HOST.
//
// `materialize` replaces everything in .superbee except CONFIG_PATHS (the assistant's instructions and
// golden questions, which are configuration and stay in git) with the export, so every script that
// reads .superbee builds the hosted content unchanged. An export that carries a config path, a dot
// entry, a symlink or anything but plain files and folders is refused before .superbee is touched.
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HOSTED_CONTENT = Object.freeze({
  /** The hosted bundle, qualified by its workspace (one reference for a person and a workload). */
  bundle: "holaxis-sites/superbee-docs",
  bundleId: "superbee-docs",
  /** The gateway a person's session targets; a workload bearer arrives with SUPERBEE_HOST set. */
  gateway: "https://mcp.getsuperbee.com",
  /** Top-level .superbee entries that are configuration: kept from git, never hosted. */
  configPaths: Object.freeze(["assistant"]),
});

export const RECEIPT_SCHEMA = "https://getsuperbee.com/schemas/superbee-docs/hosted-content-receipt/v1";
export const BASELINE_SCHEMA = "https://getsuperbee.com/schemas/superbee-docs/freshness-baseline/v1";
/** The repository root, from this script's location (never the working directory). */
export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const BASELINE_FILE = "freshness-baseline.json";
export const BASELINE_PATH = path.join(ROOT, BASELINE_FILE);
const BUNDLE_DIR = ".superbee";
export const BUNDLE_PATH = path.join(ROOT, BUNDLE_DIR);
const VERSION = /^sha256:[0-9a-f]{64}$/;
const SAFE_ID = /^(?![-!])(?=.{1,512}$)[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const fail = (message) => { throw Object.assign(new Error(message), { exit: 1 }); };

/** Every regular file under `root` as sorted posix paths; refuses links and special files. */
export async function listFiles(root, { skipTop = [] } = {}) {
  const files = [];
  async function walk(directory, relative) {
    for (const name of (await readdir(directory)).sort()) {
      const rel = relative ? `${relative}/${name}` : name;
      if (!relative && skipTop.includes(name)) continue;
      const info = await lstat(path.join(directory, name));
      if (info.isSymbolicLink()) fail(`${rel} is a symbolic link`);
      if (info.isDirectory()) await walk(path.join(directory, name), rel);
      else if (info.isFile()) files.push(rel);
      else fail(`${rel} is not a regular file or folder`);
    }
  }
  await walk(root, "");
  return files.sort();
}

/** The digest of a file tree: sha256 over its sorted `path\0sha256\n` rows. */
export async function treeDigest(root, files) {
  const rows = [];
  for (const file of files) rows.push(`${file}\0${sha256(await readFile(path.join(root, file)))}\n`);
  return sha256(rows.join(""));
}

function superbeeCommand(env) {
  if (env.HOSTED_CONTENT_SUPERBEE) return [process.execPath, [env.HOSTED_CONTENT_SUPERBEE]];
  const bin = fileURLToPath(new URL("../node_modules/superbee/dist/superbee.mjs", import.meta.url));
  return [process.execPath, [bin]];
}

/** Run the pinned `superbee export` into a new folder and check its receipt. */
export function exportHosted({ to, env = process.env, run = spawnSync }) {
  if (!to) fail("export needs --to <new folder>");
  const args = ["export", HOSTED_CONTENT.bundle, "--to", to, "--json"];
  // A workload bearer names its own gateway (SUPERBEE_HOST); a person's session needs the host.
  if (!env.SUPERBEE_ACCESS_TOKEN) args.splice(2, 0, "--host", HOSTED_CONTENT.gateway);
  const [command, prefix] = superbeeCommand(env);
  const result = run(command, [...prefix, ...args], { encoding: "utf8", env, maxBuffer: 16 << 20 });
  let receipt;
  try { receipt = JSON.parse(result.stdout || "null"); } catch { receipt = null; }
  if (result.status !== 0) {
    const why = receipt?.error?.message ?? (result.stderr || result.stdout || "").trim().split("\n").at(-1);
    fail(`superbee export ${HOSTED_CONTENT.bundle} failed (exit ${result.status}): ${why || "no output"}`);
  }
  if (receipt?.export !== "created" || receipt.bundle_id !== HOSTED_CONTENT.bundleId) {
    fail(`superbee export answered no export of ${HOSTED_CONTENT.bundleId}`);
  }
  for (const field of ["revision", "documents", "reserved", "blobs", "bytes"]) {
    if (!Number.isSafeInteger(receipt[field]) || receipt[field] < 0) fail(`superbee export reported no ${field}`);
  }
  if (receipt.documents === 0) fail("the hosted bundle exported no documents");
  if (receipt.root_index !== true || receipt.reserved < 1) fail("superbee export reported no root index.md");
  // A person's session targets the gateway; a workload bearer's SUPERBEE_HOST names the same one.
  const expectedHost = env.SUPERBEE_ACCESS_TOKEN ? env.SUPERBEE_HOST : HOSTED_CONTENT.gateway;
  if (receipt.host !== HOSTED_CONTENT.gateway || expectedHost !== HOSTED_CONTENT.gateway) {
    fail(`superbee export read ${JSON.stringify(receipt.host ?? null)}, not ${HOSTED_CONTENT.gateway}`);
  }
  return receipt;
}

/** Check an export folder's shape: plain files only, no dot entries, no configuration paths. */
export async function checkExport(from) {
  const files = await listFiles(from);
  for (const file of files) {
    const [top] = file.split("/");
    if (HOSTED_CONTENT.configPaths.includes(top.toLowerCase())) fail(`the hosted bundle carries ${file}; ${top}/ is configuration and stays in git`);
    if (file.split("/").some((segment) => segment.startsWith("."))) fail(`the hosted bundle carries the dot entry ${file}`);
  }
  if (!files.includes("index.md")) fail("the export has no root index.md");
  return files;
}

/** Check that an export receipt's counts describe exactly the files in the folder. */
export function checkCounts(receipt, files) {
  const expected = receipt.documents + receipt.reserved + receipt.blobs;
  if (files.length !== expected) fail(`the export holds ${files.length} files, but its receipt counts ${expected}`);
}

export const TREE_DIGEST = /^sha256:[0-9a-f]{64}$/;

/**
 * Make `bundleDir` exactly the export plus the configuration paths it already holds. The new tree is
 * assembled and verified in a sibling staging folder, then swapped in by rename, so a failure leaves
 * the old folder whole. An `expectedDigest` (the acquire job's) must match the export before anything
 * is copied.
 */
export async function materialize({ from, bundleDir = BUNDLE_PATH, expectedDigest }) {
  const source = await lstat(from).catch(() => null);
  if (!source?.isDirectory()) fail(`${from} is not a folder (a link is refused)`);
  const files = await checkExport(from);
  const digest = await treeDigest(from, files);
  if (expectedDigest !== undefined && (!TREE_DIGEST.test(expectedDigest ?? "") || expectedDigest !== digest)) {
    fail(`${from} does not match tree digest ${JSON.stringify(expectedDigest)}`);
  }
  const info = await lstat(bundleDir).catch(() => null);
  if (info && !info.isDirectory()) fail(`${bundleDir} is not a folder (a link is refused)`);
  if (info) {
    const inside = path.relative(await realpath(bundleDir), await realpath(from));
    if (!inside.startsWith("..") && !path.isAbsolute(inside)) fail(`${from} is inside ${bundleDir}`);
  }
  const suffix = randomBytes(6).toString("hex");
  const staging = `${bundleDir}.staging-${suffix}`;
  const retired = `${bundleDir}.retired-${suffix}`;
  try {
    await cp(from, staging, { recursive: true, errorOnExist: true, force: false });
    for (const name of info ? HOSTED_CONTENT.configPaths : []) {
      const config = path.join(bundleDir, name);
      const kept = await lstat(config).catch(() => null);
      if (!kept) continue;
      if (!kept.isDirectory()) fail(`${config} is not a folder (a link is refused)`);
      await listFiles(config);
      await cp(config, path.join(staging, name), { recursive: true, errorOnExist: true, force: false });
    }
    const placed = await listFiles(staging, { skipTop: HOSTED_CONTENT.configPaths });
    if (placed.join("\n") !== files.join("\n") || await treeDigest(staging, placed) !== digest) {
      fail(`${bundleDir} would not equal the export after materializing`);
    }
    if (info) await rename(bundleDir, retired);
    try {
      await rename(staging, bundleDir);
    } catch (error) {
      if (info) {
        await rename(retired, bundleDir).catch((restore) => {
          process.stderr.write(`hosted-content: could not restore ${bundleDir} from ${retired}: ${restore.message}\n`);
        });
      }
      throw error;
    }
    await rm(retired, { recursive: true, force: true }).catch((cleanup) => {
      process.stderr.write(`hosted-content: ${bundleDir} is in place; could not remove ${retired}: ${cleanup.message}\n`);
    });
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
  }
  return { files: files.length, treeDigest: digest };
}

/** Compare two trees (configuration paths skipped on both sides). */
export async function compareTrees(left, right) {
  const skipTop = HOSTED_CONTENT.configPaths;
  const [a, b] = await Promise.all([listFiles(left, { skipTop }), listFiles(right, { skipTop })]);
  const inB = new Set(b);
  const inA = new Set(a);
  const differ = [];
  let identical = 0;
  for (const file of a) {
    if (!inB.has(file)) continue;
    const [x, y] = await Promise.all([readFile(path.join(left, file)), readFile(path.join(right, file))]);
    if (Buffer.compare(x, y) === 0) identical += 1;
    else differ.push(file);
  }
  return {
    identical,
    differ,
    onlyLeft: a.filter((file) => !inB.has(file)),
    onlyRight: b.filter((file) => !inA.has(file)),
  };
}

function git(root, args) {
  return execFileSync("git", ["-c", "core.quotepath=false", "-C", root, ...args], { encoding: "utf8", maxBuffer: 16 << 20 }).trim();
}

/**
 * The page freshness Git gives today, frozen so it survives the content leaving Git: for every
 * tracked, clean bundle document, the commit time of its last change and the version (sha256 of
 * its exact bytes) it applies to. The build uses a row only for a document with no meaningful-change
 * clock of its own whose bytes are still exactly that version; anything else is omitted, as Git
 * omits a dirty or untracked file.
 */
export async function freshnessBaseline({ root = ROOT } = {}) {
  if (git(root, ["rev-parse", "--is-shallow-repository"]) !== "false") fail("the freshness baseline needs complete Git history");
  const tracked = git(root, ["ls-files", "--", `${BUNDLE_DIR}/`]).split("\n").filter(Boolean);
  const rows = [];
  for (const file of tracked.sort()) {
    const relative = file.slice(BUNDLE_DIR.length + 1);
    if (!relative.endsWith(".md") || relative === "index.md" || relative === "log.md") continue;
    if (HOSTED_CONTENT.configPaths.includes(relative.split("/")[0])) continue;
    if (git(root, ["status", "--porcelain=v1", "--", file]) !== "") fail(`${file} has uncommitted changes`);
    const committed = new Date(git(root, ["log", "-1", "--format=%cI", "--", file]));
    if (!Number.isFinite(committed.valueOf())) fail(`${file} has no commit time`);
    const documentId = relative.slice(0, -".md".length);
    rows.push({ documentId, sourceVersion: sha256(await readFile(path.join(root, file))), committedAt: committed.toISOString() });
  }
  return { schema: BASELINE_SCHEMA, bundle: HOSTED_CONTENT.bundle, documents: rows };
}

/** Read and check freshness-baseline.json; absent is an empty baseline. */
export async function readFreshnessBaseline(file) {
  let text;
  try { text = await readFile(file, "utf8"); } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
  const value = JSON.parse(text);
  if (value?.schema !== BASELINE_SCHEMA || value.bundle !== HOSTED_CONTENT.bundle || !Array.isArray(value.documents)) {
    fail(`${file} is not a freshness baseline for ${HOSTED_CONTENT.bundle}`);
  }
  const rows = new Map();
  for (const row of value.documents) {
    if (!SAFE_ID.test(row?.documentId ?? "") || !VERSION.test(row.sourceVersion ?? "")
      || typeof row.committedAt !== "string" || new Date(row.committedAt).toISOString() !== row.committedAt
      || rows.has(row.documentId)) {
      fail(`${file} has an invalid row ${JSON.stringify(row?.documentId ?? null)}`);
    }
    rows.set(row.documentId, row);
  }
  return rows;
}

/** True when the frontmatter carries its own meaningful-change clock (docs-tooling freshness/v1). */
function declaresClock(frontmatter) {
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) return false;
  const generated = frontmatter.generated;
  if (generated && typeof generated === "object" && !Array.isArray(generated) && Object.hasOwn(generated, "at")) return true;
  return Object.hasOwn(frontmatter, "timestamp");
}

/**
 * Fill freshness facts Git could not give from the baseline. Order and precedence match
 * deriveGitDocumentationFreshnessV1: a declared clock, then Git, then the baseline row for the exact
 * same bytes. Facts come back sorted by document id, as Git's derivation returns them.
 */
export function withFreshnessBaseline({ facts, baseline, snapshot, documentIds }) {
  const have = new Set(facts.map((fact) => fact.documentId));
  const byId = new Map(snapshot.manifest.documents.map((document) => [document.id, document]));
  const merged = [...facts];
  for (const documentId of documentIds) {
    if (have.has(documentId)) continue;
    const row = baseline.get(documentId);
    const document = byId.get(documentId);
    if (!row || !document || declaresClock(document.frontmatter) || document.version !== row.sourceVersion) continue;
    merged.push(Object.freeze({ documentId, sourceVersion: document.version, updatedAt: row.committedAt }));
  }
  return Object.freeze(merged.sort((left, right) => (left.documentId < right.documentId ? -1 : left.documentId > right.documentId ? 1 : 0)));
}

/** A new folder outside the repository: `superbee export` refuses a target inside a bundle tree. */
async function temporaryExport(env) {
  const parent = await mkdtemp(path.join(env.RUNNER_TEMP || tmpdir(), "superbee-docs-hosted-"));
  return { to: path.join(parent, "export"), cleanup: () => rm(parent, { recursive: true, force: true }) };
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export async function main(argv, { env = process.env, log = (line) => process.stdout.write(`${line}\n`) } = {}) {
  const [command, ...args] = argv;
  if (command === "export") {
    const to = option(args, "--to");
    const receipt = exportHosted({ to, env });
    const files = await checkExport(to);
    checkCounts(receipt, files);
    const result = {
      schema: RECEIPT_SCHEMA,
      bundle: HOSTED_CONTENT.bundle,
      host: receipt.host,
      revision: receipt.revision,
      exportedAt: receipt.exported_at,
      documents: receipt.documents,
      reserved: receipt.reserved,
      blobs: receipt.blobs,
      bytes: receipt.bytes,
      files: files.length,
      treeDigest: await treeDigest(to, files),
    };
    if (option(args, "--receipt")) await writeJson(option(args, "--receipt"), result);
    log(JSON.stringify(result));
    return 0;
  }
  if (command === "materialize" || command === "acquire") {
    let from = option(args, "--from");
    let exported;
    let temporary;
    try {
      if (command === "acquire") {
        temporary = await temporaryExport(env);
        from = temporary.to;
        exported = exportHosted({ to: from, env });
        checkCounts(exported, await checkExport(from));
      }
      if (!from) fail("materialize needs --from <export folder>");
      const expectedDigest = args.includes("--tree-digest") ? option(args, "--tree-digest") ?? "" : undefined;
      const placed = await materialize({ from, expectedDigest });
      const result = { schema: RECEIPT_SCHEMA, bundle: HOSTED_CONTENT.bundle, materialized: BUNDLE_DIR, ...placed,
        ...(exported ? { host: exported.host, revision: exported.revision, exportedAt: exported.exported_at } : {}) };
      log(JSON.stringify(result));
      return 0;
    } finally {
      await temporary?.cleanup();
    }
  }
  if (command === "compare") {
    let from = option(args, "--from");
    let temporary;
    try {
      if (!from) {
        temporary = await temporaryExport(env);
        from = temporary.to;
        checkCounts(exportHosted({ to: from, env }), await checkExport(from));
      }
      await checkExport(from);
      const result = await compareTrees(BUNDLE_PATH, from);
      log(JSON.stringify({ compared: `${BUNDLE_DIR} vs ${HOSTED_CONTENT.bundle}`, ...result }));
      return result.differ.length || result.onlyLeft.length || result.onlyRight.length ? 1 : 0;
    } finally {
      await temporary?.cleanup();
    }
  }
  if (command === "baseline") {
    const value = await freshnessBaseline();
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (args.includes("--check")) {
      const current = await readFile(BASELINE_PATH, "utf8").catch(() => "");
      if (current !== text) { log(`${BASELINE_FILE} is not current; run node scripts/hosted-content.mjs baseline`); return 1; }
      log(`${BASELINE_FILE}: current (${value.documents.length} documents)`);
      return 0;
    }
    await writeFile(BASELINE_PATH, text);
    log(`${BASELINE_FILE}: ${value.documents.length} documents`);
    return 0;
  }
  fail("usage: hosted-content.mjs export --to <dir> [--receipt <file>] | materialize --from <dir> [--tree-digest <d>] | acquire | compare [--from <dir>] | baseline [--check]");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`hosted-content: ${error.message}\n`);
    process.exitCode = error.exit ?? 1;
  });
}
