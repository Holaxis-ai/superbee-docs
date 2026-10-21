// hosted-content: the docs site's content lives in the hosted bundle holaxis-sites/superbee-docs
// (superbee-dev decision sites-content-lives-in-hosted-2026-10-16). Git keeps code and config.
//
//   node scripts/hosted-content.mjs export --to <new folder>    verified export of the hosted bundle
//   node scripts/hosted-content.mjs materialize --from <export>  make .superbee exactly the export
//   node scripts/hosted-content.mjs acquire                      export, then materialize
//   node scripts/hosted-content.mjs compare [--from <export>]    hosted versus .superbee, file by file
//   node scripts/hosted-content.mjs baseline [--check]           write or check freshness-baseline.json;
//                                                                retired: it refuses now that content has left Git
//
// `export` has two paths, chosen by the environment. With a bearer (SUPERBEE_ACCESS_TOKEN, which CI's
// scripts/hosted-workload-token.mjs supplies with SUPERBEE_HOST), it downloads through
// `@superbee/core`'s hosted client, which verifies every entry against the host's digest manifests
// before anything is returned; the bearer is sent only to the gateway constant below. Without one, a
// person's `superbee login` session is used through the pinned `superbee export`, because the library
// has no sign-in. Both paths yield the same receipt and are checked by the same invariants.
//
// `materialize` replaces a reader projection with the exact export. It refuses writer checkouts.
// Assistant policy lives in Git assistant/ and is combined only in a disposable build input.
// `snapshot` lets CI readers reuse a complete successful main production run's public export.
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFile, cp, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import {
  bearerCredentials,
  createHostedClient,
  HostedCarrierError,
  HostedRouteNotServed,
  isMalformedAnswer,
  RemoteError,
} from "@superbee/core/hosted-client";
import { downloadExport, EXPORT_WINDOW_MS, ExportArchiveError, HostedExportError } from "@superbee/core/hosted-client/node";
import { materializeExport } from "@superbee/core/portable-export";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HOSTED_CONTENT = Object.freeze({
  /** The hosted bundle, qualified by its workspace (one reference for a person and a workload). */
  bundle: "holaxis-sites/superbee-docs",
  workspace: "holaxis-sites",
  bundleId: "superbee-docs",
  /**
   * The production gateway: a person's session targets it, and it is the only origin a workload
   * bearer is ever sent to. Never read from the environment; SUPERBEE_HOST must name this same one.
   */
  gateway: "https://mcp.getsuperbee.com",
  /** The hosted sync route family on the gateway. */
  syncPrefix: "/sync/v1",
  /** Reserved top-level content paths: assistant policy is Git-owned, never hosted. */
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

/** The person-run CLI, or HOSTED_CONTENT_SUPERBEE in its place (a test or a local CLI build). */
function superbeeCommand(env) {
  if (env.HOSTED_CONTENT_SUPERBEE) return [process.execPath, [env.HOSTED_CONTENT_SUPERBEE]];
  const bin = fileURLToPath(new URL("../node_modules/superbee/dist/superbee.mjs", import.meta.url));
  return [process.execPath, [bin]];
}

/** Which export path runs: a bearer in the environment is a workload's ("library"); none, or a blank one, is a person's ("cli"). */
export function exportPath(env) {
  return env.SUPERBEE_ACCESS_TOKEN?.trim() ? "library" : "cli";
}

/**
 * Export the hosted bundle into the new folder `to` and check its receipt. A bearer in the
 * environment selects the library path; otherwise the pinned CLI runs with the person's session.
 * `fetch` is the library path's transport (a test's); `run` is the CLI path's process runner.
 */
export async function exportHosted({ to, env = process.env, run = spawnSync, fetch } = {}) {
  if (!to) fail("export needs --to <new folder>");
  if (exportPath(env) === "library") return checkReceipt(await exportThroughLibrary({ to, env, fetch }));
  // A blank bearer is no bearer: the CLI sees the environment as if it were unset.
  const { SUPERBEE_ACCESS_TOKEN: blank, ...unset } = env;
  const receipt = exportThroughCli({ to, env: blank === undefined ? env : unset, run });
  return checkReceipt(receipt);
}

/** Run the pinned `superbee export` into a new folder; the person's `superbee login` session authenticates. */
export function exportThroughCli({ to, env, run = spawnSync }) {
  // Token/host environment variables bind the credential, but do not select the host for a named bundle.
  const args = ["export", HOSTED_CONTENT.bundle, "--host", HOSTED_CONTENT.gateway, "--to", to, "--json"];
  const [command, prefix] = superbeeCommand(env);
  const result = run(command, [...prefix, ...args], { encoding: "utf8", env, maxBuffer: 16 << 20 });
  let receipt;
  try { receipt = JSON.parse(result.stdout || "null"); } catch { receipt = null; }
  if (result.status !== 0) {
    const why = receipt?.error?.message ?? (result.stderr || result.stdout || "").trim().split("\n").at(-1);
    fail(`superbee export ${HOSTED_CONTENT.bundle} failed (exit ${result.status}): ${why || "no output"}`);
  }
  return receipt;
}

/**
 * Download the verified export through `@superbee/core`'s hosted client with the environment's
 * bearer, then place it at `to`: staged in a private sibling by `materializeExport` and renamed onto
 * `to` in one step, so `to` is either absent or complete. The receipt has the CLI receipt's fields,
 * each from the verified result; it and the entries' paths are checked before any file is written.
 */
export async function exportThroughLibrary({ to, env, fetch }) {
  const token = env.SUPERBEE_ACCESS_TOKEN;
  // The library sends the bearer to whatever origin it is given; only the constant is ever given.
  if (env.SUPERBEE_HOST !== HOSTED_CONTENT.gateway) {
    fail(`SUPERBEE_HOST is ${JSON.stringify(env.SUPERBEE_HOST ?? null)}, not ${HOSTED_CONTENT.gateway}; the workload bearer is sent only to ${HOSTED_CONTENT.gateway}`);
  }
  const target = path.resolve(to);
  const inside = path.relative(BUNDLE_PATH, target);
  if (!inside.startsWith("..") && !path.isAbsolute(inside)) fail(`${to} is inside ${BUNDLE_PATH}; export to a folder outside the bundle`);
  const existing = await lstat(target).catch(() => null);
  if (existing && (!existing.isDirectory() || (await readdir(target)).length > 0)) fail(`${to} exists; export needs a new folder`);
  const client = createHostedClient({
    target: { origin: HOSTED_CONTENT.gateway, syncPrefix: HOSTED_CONTENT.syncPrefix },
    credentials: bearerCredentials(() => token),
    deadlineMs: EXPORT_WINDOW_MS,
    ...(fetch ? { fetch } : {}),
  }).within(HOSTED_CONTENT.workspace);
  let verified;
  try {
    verified = await downloadExport(client, HOSTED_CONTENT.bundleId);
  } catch (error) {
    // A new error carrying no `cause`, so nothing from the transport reaches a log unredacted.
    fail(redact(libraryFailure(error), token));
  }
  // Everything from here names host-chosen paths (and a filesystem error names the whole path), so
  // every failure is redacted, keeping the specific messages this function raises itself.
  try {
    const receipt = checkReceipt({
      export: "created",
      bundle_id: verified.source.bundleId,
      host: client.target.origin,
      revision: verified.source.revision,
      exported_at: verified.exportedAt,
      documents: verified.counts.documents,
      reserved: verified.counts.reserved,
      blobs: verified.counts.blobs,
      bytes: verified.bytes,
      root_index: verified.entries.some((entry) => entry.path === "index.md"),
    });
    // The folder rule, applied to the verified entries so a refused export never creates `to`.
    checkExportPaths(verified.entries.map((entry) => entry.path));
    const parent = path.dirname(target);
    await mkdir(parent, { recursive: true });
    const staged = await materializeExport(verified, parent);
    try {
      await rename(staged, target);
    } catch (error) {
      await rm(staged, { recursive: true, force: true }).catch(() => {});
      if (["ENOTEMPTY", "EEXIST", "ENOTDIR"].includes(error.code)) fail(`${to} is no longer empty; nothing was written`);
      throw error;
    }
    return receipt;
  } catch (error) {
    fail(redact(error?.exit !== undefined ? error.message : libraryFailure(error), token));
  }
}

const redact = (message, token) => (token ? message.split(token).join("[redacted]") : message);

/** The user-facing failure a typed library error is: auth, route not served, deadline, verification, or the host's refusal. */
export function libraryFailure(error) {
  const what = `hosted export of ${HOSTED_CONTENT.bundle} from ${HOSTED_CONTENT.gateway} failed`;
  const nothing = "nothing was written";
  if (error instanceof HostedRouteNotServed) return `${what} (route not served): the host does not serve ${HOSTED_CONTENT.syncPrefix}/export; ${nothing}`;
  if (isMalformedAnswer(error)) return `${what} (verification): the host's answer is malformed; ${nothing}`;
  if (error instanceof RemoteError) {
    const answered = `${error.status} ${error.code}`;
    if (error.status === 401) return `${what} (auth): the host refused the workload bearer (${answered}); mint a new one and retry`;
    if (error.status === 403) return `${what} (auth): the workload bearer may not export this bundle (${answered})`;
    if (error.code === "bundle_not_found") return `${what} (not found): no hosted bundle ${HOSTED_CONTENT.bundle} is visible to the workload (${answered})`;
    return `${what} (refused): the host answered ${answered}; ${nothing}`;
  }
  if (error instanceof HostedCarrierError) {
    if (error.code === "denied") return `${what} (auth): no credential could be sent`;
    if (["AbortError", "TimeoutError"].includes(error.cause?.name)) {
      return `${what} (deadline): no answer within ${EXPORT_WINDOW_MS / 1000} s; ${nothing}`;
    }
    return `${what} (unavailable): the host could not be reached or did not answer; ${nothing}`;
  }
  if (error instanceof HostedExportError) {
    if (error.problem === "stopped") return `${what} (deadline): the export stopped part way; ${nothing}`;
    if (error.problem === "too_large") return `${what} (verification): the export is larger than ${error.maximum} bytes; ${nothing}`;
    return `${what} (source changed): the bundle kept changing while it was exported; ${nothing}`;
  }
  if (error instanceof ExportArchiveError) return `${what} (verification: ${error.problem}): ${error.message}; ${nothing}`;
  if (typeof error?.code === "string" && error.syscall) return `${what} (placement: ${error.code}): ${error.message}; ${nothing}`;
  return `${what}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
}

/** The invariants every export receipt meets, from either path. */
export function checkReceipt(receipt) {
  if (receipt?.export !== "created" || receipt.bundle_id !== HOSTED_CONTENT.bundleId) {
    fail(`superbee export answered no export of ${HOSTED_CONTENT.bundleId}`);
  }
  for (const field of ["revision", "documents", "reserved", "blobs", "bytes"]) {
    if (!Number.isSafeInteger(receipt[field]) || receipt[field] < 0) fail(`superbee export reported no ${field}`);
  }
  if (receipt.documents === 0) fail("the hosted bundle exported no documents");
  if (receipt.root_index !== true || receipt.reserved < 1) fail("superbee export reported no root index.md");
  if (receipt.host !== HOSTED_CONTENT.gateway) {
    fail(`superbee export read ${JSON.stringify(receipt.host ?? null)}, not ${HOSTED_CONTENT.gateway}`);
  }
  return receipt;
}

/**
 * The receipt.json of an export at `to` (the snapshot artifact's, which `materialize --tree-digest`
 * and `materializeSnapshot` consume): the folder's shape and counts checked, and its tree digest.
 */
export async function exportReceipt(receipt, to) {
  const files = await checkExport(to);
  checkCounts(receipt, files);
  return {
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
}

/** Refuse an export path the reader tree may not hold: a configuration path or a dot entry. */
export function checkExportPaths(files) {
  for (const file of files) {
    const [top] = file.split("/");
    if (HOSTED_CONTENT.configPaths.includes(top.toLowerCase())) fail(`the hosted bundle carries ${file}; ${top}/ is configuration and stays in git`);
    if (file.split("/").some((segment) => segment.startsWith("."))) fail(`the hosted bundle carries the dot entry ${file}`);
  }
}

/** Check an export folder's shape: plain files only, no dot entries, no configuration paths. */
export async function checkExport(from) {
  const files = await listFiles(from);
  checkExportPaths(files);
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
 * Make a reader `bundleDir` exactly the export. Registered writer checkouts are refused. The tree is
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
    if (await lstat(path.join(bundleDir, ".superbee", "checkout.json")).catch(() => null)) {
      fail(`${bundleDir} is a writer checkout; use superbee sync, or acquire into a separate clone`);
    }
    const inside = path.relative(await realpath(bundleDir), await realpath(from));
    if (!inside.startsWith("..") && !path.isAbsolute(inside)) fail(`${from} is inside ${bundleDir}`);
  }
  const suffix = randomBytes(6).toString("hex");
  const staging = `${bundleDir}.staging-${suffix}`;
  const retired = `${bundleDir}.retired-${suffix}`;
  try {
    await cp(from, staging, { recursive: true, errorOnExist: true, force: false });
    const placed = await listFiles(staging);
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
  if (!tracked.length) fail("content has left Git; retain the frozen baseline rather than regenerating it from a checkout");
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


/** Read-only CI consumers use an export from a successful main production run, never PR OIDC. */
export const SNAPSHOT_REPOSITORY = "Holaxis-ai/superbee-docs";
const SNAPSHOT_REPOSITORY_ID = 1349797123;
const SNAPSHOT_WORKFLOW = ".github/workflows/verify-production.yml";

/**
 * `published` (the default) takes the export of a production run that succeeded end to end: the
 * content the site serves. `acquired` takes the newest export whose acquire job succeeded, even if a
 * later job failed: the acquire job verified those bytes against the host's digest manifest, and a
 * build that waits on a Git change in the same pull request must not hide them from that PR's CI.
 */
export const SNAPSHOT_MODES = Object.freeze(["published", "acquired"]);

export async function selectSnapshot({ api, isMainAncestor, now = Date.now(), mode = "published" }) {
  if (!SNAPSHOT_MODES.includes(mode)) fail(`snapshot mode must be one of ${SNAPSHOT_MODES.join(", ")}`);
  const filter = mode === "published" ? "&status=success" : "";
  const listing = await api(`repos/${SNAPSHOT_REPOSITORY}/actions/workflows/verify-production.yml/runs?branch=main${filter}&per_page=30`);
  for (const run of listing.workflow_runs ?? []) {
    if (run.status !== "completed" || (mode === "published" && run.conclusion !== "success") || run.head_branch !== "main"
      || !["schedule", "workflow_dispatch"].includes(run.event) || run.path !== SNAPSHOT_WORKFLOW
      || run.repository?.id !== SNAPSHOT_REPOSITORY_ID || run.head_repository?.id !== SNAPSHOT_REPOSITORY_ID
      || !Number.isSafeInteger(run.id) || !/^[a-f0-9]{40}$/.test(run.head_sha ?? "")) continue;
    if (!await isMainAncestor(run.head_sha)) continue;
    let acquire;
    if (mode === "acquired") {
      const jobs = await api(`repos/${SNAPSHOT_REPOSITORY}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
      const acquired = (jobs.jobs ?? []).filter((job) => job.name === "acquire");
      if (acquired.length !== 1) continue;
      [acquire] = acquired;
      if (acquire.status !== "completed" || acquire.conclusion !== "success"
        || (run.run_attempt !== undefined && acquire.run_attempt !== run.run_attempt)
        || !Number.isFinite(Date.parse(acquire.started_at)) || !Number.isFinite(Date.parse(acquire.completed_at))) continue;
    }
    const artifacts = await api(`repos/${SNAPSHOT_REPOSITORY}/actions/runs/${run.id}/artifacts?per_page=100`);
    const name = `superbee-docs-hosted-content-${run.id}`;
    // Any job in the run may upload this name; in acquired mode only the acquire job's upload counts.
    const matches = (artifacts.artifacts ?? []).filter((a) => a.name === name && !a.expired
      && Date.parse(a.expires_at) > now && Number.isSafeInteger(a.id)
      && (!acquire || (Date.parse(a.created_at) >= Date.parse(acquire.started_at)
        && Date.parse(a.created_at) <= Date.parse(acquire.completed_at))));
    if (matches.length === 1) return { mode, runId: run.id, sourceCommit: run.head_sha, artifactId: matches[0].id, name };
  }
  fail(`no retained ${mode === "published" ? "verified" : "acquire-verified"} main hosted-content export; dispatch verify-production.yml on main, then retry`);
}

/** Check both the receipt identity and every exported byte before changing the local reader tree. */
export async function materializeSnapshot({ directory, bundleDir = BUNDLE_PATH }) {
  const receipt = JSON.parse(await readFile(path.join(directory, "receipt.json"), "utf8"));
  if (receipt.schema !== RECEIPT_SCHEMA || receipt.bundle !== HOSTED_CONTENT.bundle
    || receipt.host !== HOSTED_CONTENT.gateway || !TREE_DIGEST.test(receipt.treeDigest ?? "")
    || !Number.isSafeInteger(receipt.revision) || receipt.revision < 0
    || !["documents", "reserved", "blobs", "bytes", "files"].every((key) => Number.isSafeInteger(receipt[key]) && receipt[key] >= 0)
    || receipt.documents < 1 || receipt.reserved < 1 || !Number.isFinite(Date.parse(receipt.exportedAt))) {
    fail("snapshot receipt is not a verified docs hosted-content export");
  }
  const from = path.join(directory, "export");
  const files = await checkExport(from);
  checkCounts(receipt, files);
  if (receipt.files !== files.length) fail("snapshot receipt file count differs");
  let bytes = 0;
  for (const file of files) bytes += (await lstat(path.join(from, file))).size;
  if (bytes !== receipt.bytes) fail("snapshot receipt byte count differs");
  return { ...await materialize({ from, bundleDir, expectedDigest: receipt.treeDigest }), revision: receipt.revision };
}

export async function acquireSnapshot({ env = process.env, bundleDir = BUNDLE_PATH, mode = "published" } = {}) {
  const gh = (args) => execFileSync("gh", args, { encoding: "utf8", env, maxBuffer: 16 << 20 });
  const selected = await selectSnapshot({
    mode,
    api: async (endpoint) => JSON.parse(gh(["api", endpoint])),
    isMainAncestor: async (commit) => spawnSync("git", ["-C", ROOT, "merge-base", "--is-ancestor", commit, "origin/main"]).status === 0,
  });
  const temporary = await mkdtemp(path.join(env.RUNNER_TEMP || tmpdir(), "superbee-docs-snapshot-"));
  try {
    gh(["run", "download", String(selected.runId), "--repo", SNAPSHOT_REPOSITORY, "--name", selected.name, "--dir", temporary]);
    return { ...selected, ...await materializeSnapshot({ directory: temporary, bundleDir }) };
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export async function main(argv, { env = process.env, log = (line) => process.stdout.write(`${line}\n`) } = {}) {
  const [command, ...args] = argv;
  if (command === "snapshot") {
    const result = await acquireSnapshot({ env, mode: option(args, "--mode") ?? "published" });
    if (env.GITHUB_STEP_SUMMARY) {
      await appendFile(env.GITHUB_STEP_SUMMARY, `Hosted content snapshot: ${result.mode} export from verify-production run ${result.runId} (source ${result.sourceCommit}).\n`);
    }
    log(JSON.stringify(result));
    return 0;
  }
  if (command === "export") {
    const to = option(args, "--to");
    const result = await exportReceipt(await exportHosted({ to, env }), to);
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
        exported = await exportHosted({ to: from, env });
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
        checkCounts(await exportHosted({ to: from, env }), await checkExport(from));
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
  fail("usage: hosted-content.mjs snapshot | export --to <dir> [--receipt <file>] | materialize --from <dir> [--tree-digest <d>] | acquire | compare [--from <dir>] | baseline [--check]");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`hosted-content: ${error.message}\n`);
    process.exitCode = error.exit ?? 1;
  });
}
