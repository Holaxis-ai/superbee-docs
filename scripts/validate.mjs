import { execFile } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skipped = new Set([".git", ".deps", ".tmp", "dist", "node_modules"]);
const selectionSchema = "https://getsuperbee.com/schemas/superbee-docs-documentation-selection/v1";

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
  if (name.startsWith(`.superbee/`) && name.endsWith(`.md`) && text.startsWith(`---\n`)) {
    const firstEnd = text.indexOf(`\n---\n`, 4);
    const body = firstEnd >= 0 ? text.slice(firstEnd + 5) : ``;
    if (body.startsWith(`---\n`)) {
      const secondEnd = body.indexOf(`\n---\n`, 4);
      const block = secondEnd >= 0 ? body.slice(4, secondEnd) : ``;
      if (/^(?:type|title|description|superbee_updated_by):/m.test(block)) {
        throw new Error(`duplicate frontmatter block in ${name}`);
      }
    }
  }
}

const [selection, portalConfig] = await Promise.all([
  readFile(resolve(root, "documentation-selection.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "portal.config.json"), "utf8").then(JSON.parse),
]);
if (!selection || typeof selection !== "object" || Array.isArray(selection)
  || JSON.stringify(Object.keys(selection).sort()) !== JSON.stringify(["schema", "supportingDocuments"])
  || selection.schema !== selectionSchema
  || !Array.isArray(selection.supportingDocuments)
  || selection.supportingDocuments.length === 0
  || selection.supportingDocuments.length > 2_048) {
  throw new Error("documentation selection must use the exact production v1 contract");
}
const supportingDocuments = selection.supportingDocuments;
const canonicalSupport = [...supportingDocuments].sort();
if (new Set(supportingDocuments).size !== supportingDocuments.length
  || supportingDocuments.some((id, index) => id !== canonicalSupport[index])) {
  throw new Error("documentation supportingDocuments must be unique and canonically ordered");
}
const navigated = new Set(portalConfig.documentation?.navigation?.flatMap((section) => section.documents ?? []) ?? []);
for (const [index, id] of supportingDocuments.entries()) {
  if (typeof id !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(id)) {
    throw new Error(`documentation supportingDocuments[${index}] is not a safe document id`);
  }
  if (navigated.has(id)) throw new Error(`documentation support '${id}' overlaps primary navigation`);
  const document = resolve(root, ".superbee", `${id}.md`);
  const info = await lstat(document).catch((error) => {
    if (error?.code === "ENOENT") throw new Error(`documentation support '${id}' is absent from the public bundle`);
    throw error;
  });
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`documentation support '${id}' must be a regular public bundle document`);
  }
}

const { stdout } = await execFileAsync("superbee", ["status", "--dir", resolve(root, ".superbee"), "--json"], { maxBuffer: 4 * 1024 * 1024 });
const status = JSON.parse(stdout);
for (const field of ["malformed", "unresolved_links", "registry_warnings", "dangling_view_entries", "invalid_view_registrations"]) {
  if ((status[field] ?? 0) !== 0) throw new Error(`bundle ${field} must be zero (observed ${status[field]})`);
}
console.log(`public_bundle: valid\ndocs: ${status.docs}\nsupporting_documents: ${supportingDocuments.length}\nmalformed: ${status.malformed}\nunresolved_links: ${status.unresolved_links}`);
