import { execFile, spawn } from "node:child_process";
import { lstat, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const HOST = "https://mcp.getsuperbee.com";
const WORKSPACE = "org:13f08d25-21bb-406a-bf0c-9782ba34c5b8";
const BUNDLE = "holaxis-sites/superbee-docs";
// Writers use their own pinned CLI. The `superbee` dependency stays the documented stable release
// that readers, exports and the CLI reference are checked against.
const pinnedBin = (root) => path.join(root, "node_modules", "superbee-writer", "dist", "superbee.mjs");
export const WRITER_BIN_ENV = "DOCS_CONTENT_SUPERBEE";
const missingWriter = () => new Error("the pinned writer CLI is not installed (node_modules/superbee-writer); run npm ci");
const refusal = () => new Error("content writes require this site's registered hosted checkout; use content:checkout in a workspace without an existing .superbee folder");

export async function assertHostedWriter({ root = ROOT, bin = pinnedBin(root) } = {}) {
  if (!(await lstat(bin).catch(() => null))) throw missingWriter();
  const directory = path.resolve(root, ".superbee");
  const info = await lstat(directory).catch((error) => { if (error.code === "ENOENT") throw refusal(); throw error; });
  if (!info.isDirectory() || info.isSymbolicLink()) throw refusal();
  let receipt;
  try {
    const { stdout } = await exec(bin, ["bundle", "locate", "--dir", directory, "--json"], { cwd: root, maxBuffer: 1024 * 1024 });
    receipt = JSON.parse(stdout);
  } catch { throw refusal(); }
  const hosted = receipt?.hosted;
  if (receipt?.home !== "hosted" || receipt.available !== true
    || receipt.locator?.kind !== "local-path" || receipt.locator.path !== await realpath(directory)
    || hosted?.host !== HOST || hosted.bundle_id !== "superbee-docs"
    || hosted.workspace !== WORKSPACE
    || typeof hosted.principal !== "string" || !hosted.principal.trim()) throw refusal();
  return receipt;
}

function forward(command, args, root, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: "inherit", shell: false });
    child.once("error", () => reject(new Error("content command could not start")));
    child.once("exit", (code, signal) => resolve(signal ? 1 : code ?? 1));
  });
}

/** Run a wrapped writer with the writer CLI first on PATH as `superbee`, and named in WRITER_BIN_ENV. */
async function forwardWithWriter(command, args, root, bin) {
  const shim = await mkdtemp(path.join(tmpdir(), "superbee-docs-writer-"));
  try {
    const writer = path.resolve(bin);
    await symlink(writer, path.join(shim, "superbee"));
    const PATH = process.env.PATH ? `${shim}${path.delimiter}${process.env.PATH}` : shim;
    const env = { ...process.env, PATH, [WRITER_BIN_ENV]: writer };
    return await forward(command, args, root, env);
  } finally {
    await rm(shim, { recursive: true, force: true });
  }
}

export async function main(argv, { root = ROOT, bin = pinnedBin(root) } = {}) {
  const directory = path.resolve(root, ".superbee");
  if (argv.length === 1 && argv[0] === "checkout") {
    const exists = await lstat(directory).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (exists) { await assertHostedWriter({ root, bin }); return 0; }
    if (!(await lstat(bin).catch(() => null))) throw missingWriter();
    const code = await forward(bin, ["checkout", BUNDLE, "--host", HOST, "--dir", directory], root);
    if (code !== 0) return code;
    await assertHostedWriter({ root, bin });
    return 0;
  }
  if (argv.length === 1 && argv[0] === "sync") {
    await assertHostedWriter({ root, bin });
    return forward(bin, ["sync", "--dir", directory], root);
  }
  if (argv[0] !== "--" || !argv[1]) throw new Error("usage: content-writer.mjs <checkout|sync> or -- <command> [args...]");
  await assertHostedWriter({ root, bin });
  return forwardWithWriter(argv[1], argv.slice(2), root, bin);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(`content writer: ${error.message}`);
    process.exitCode = 1;
  });
}
