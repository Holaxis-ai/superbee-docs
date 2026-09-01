import { execFile } from "node:child_process";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { ensureCompleteRepositoryHistory } from "./bootstrap-repository-history.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, ".deps/source");
const pin = {
  repository: "https://github.com/Holaxis-ai/superbee.git",
  commit: "77c20318205156d5020a16763e2791845f17826c",
};

await ensureCompleteRepositoryHistory(root);

async function run(command, args, cwd = root) {
  const result = await execFileAsync(command, args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return result.stdout.trim();
}

async function isDirectory(path) {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

async function exactCheckout() {
  const target = resolve(sourceRoot, "superbee");
  if (await isDirectory(target)) {
    let matches = false;
    try {
      const [observed, repository] = await Promise.all([
        run("git", ["rev-parse", "HEAD"], target),
        run("git", ["remote", "get-url", "origin"], target),
      ]);
      matches = observed === pin.commit && repository === pin.repository;
    } catch {
      // A failed cached clone is not an authority. Recreate it below.
    }
    if (!matches) await rm(target, { recursive: true, force: true });
  }
  if (!(await isDirectory(target))) {
    await run("git", ["clone", "--filter=blob:none", pin.repository, target]);
    await run("git", ["checkout", "--detach", pin.commit], target);
  }
  const observed = await run("git", ["rev-parse", "HEAD"], target);
  if (observed !== pin.commit) {
    throw new Error(`Superbee source is ${observed}; remove .deps/source/superbee and rerun`);
  }
  const dirty = await run("git", ["status", "--porcelain=v1", "--untracked-files=all"], target);
  if (dirty !== "") throw new Error("Superbee source is dirty; remove .deps/source/superbee and rerun");
}

await mkdir(sourceRoot, { recursive: true });
await exactCheckout();
console.log(`source_sync: complete\nsuperbee: ${pin.commit}`);
