import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(root, args) {
  const result = await execFileAsync("git", args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  return result.stdout.trim();
}

/** Ensure Git-backed freshness facts see the same complete history on every build host. */
export async function ensureCompleteRepositoryHistory(root) {
  const shallow = await git(root, ["rev-parse", "--is-shallow-repository"]);
  if (shallow === "false") return false;
  if (shallow !== "true") throw new Error(`unexpected Git shallow-repository result: ${shallow}`);
  await git(root, ["fetch", "--unshallow", "--no-tags", "origin"]);
  if (await git(root, ["rev-parse", "--is-shallow-repository"]) !== "false") {
    throw new Error("repository remains shallow after fetching complete history");
  }
  return true;
}

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  const root = resolve(dirname(modulePath), "..");
  const expanded = await ensureCompleteRepositoryHistory(root);
  console.log(`repository_history: ${expanded ? "expanded" : "complete"}`);
}
