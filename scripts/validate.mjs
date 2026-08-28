import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skipped = new Set([".git", ".deps", ".tmp", "dist", "node_modules"]);

async function files(directory, out = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await files(path, out);
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

const credential = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}|\bAKIA[0-9A-Z]{16}\b/;
const workstation = /(?:^|[\s('"`])(?:\/Users\/[^/\s]+\/|[A-Za-z]:\\Users\\[^\\\s]+\\)/m;
for (const path of await files(root)) {
  const bytes = await readFile(path);
  if (bytes.includes(0)) continue;
  const text = bytes.toString("utf8");
  const name = relative(root, path);
  if (credential.test(text)) throw new Error(`public-boundary credential pattern in ${name}`);
  if (workstation.test(text)) throw new Error(`public-boundary workstation path in ${name}`);
}

const { stdout } = await execFileAsync("superbee", ["status", "--dir", resolve(root, ".superbee"), "--json"], { maxBuffer: 4 * 1024 * 1024 });
const status = JSON.parse(stdout);
for (const field of ["malformed", "unresolved_links", "registry_warnings", "dangling_view_entries", "invalid_view_registrations"]) {
  if ((status[field] ?? 0) !== 0) throw new Error(`bundle ${field} must be zero (observed ${status[field]})`);
}
console.log(`public_bundle: valid\ndocs: ${status.docs}\nmalformed: ${status.malformed}\nunresolved_links: ${status.unresolved_links}`);
