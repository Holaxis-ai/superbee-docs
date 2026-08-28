import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { compileAll, expectedViewMarkdown } from "../tooling/diagram-pipeline/src/index.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = resolve(root, ".superbee");

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

async function promote(file, key, contentType) {
  const target = resolve(bundle, key);
  const incoming = await readFile(file);
  if (await exists(target)) {
    const current = await readFile(target);
    if (current.equals(incoming)) return { key, changed: false, version: sha256(current) };
    await execFileAsync("superbee", [
      "promote", file, "--doc-key", key, "--expected-version", sha256(current),
      ...(contentType ? ["--content-type", contentType] : []), "--dir", bundle, "--json",
    ]);
  } else {
    await execFileAsync("superbee", [
      "promote", file, "--doc-key", key,
      ...(contentType ? ["--content-type", contentType] : []), "--dir", bundle, "--json",
    ]);
  }
  const written = await readFile(target);
  return { key, changed: true, version: sha256(written) };
}

async function writePortalConfig(rows) {
  const path = resolve(root, "portal.config.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  const managed = new Set(rows.map((row) => row.viewId));
  config.views = [
    ...(config.views ?? []).filter((row) => !managed.has(row.id)),
    ...rows.map((row) => ({ id: row.viewId, entry: row.entry, access: row.access, entrySha256: row.entrySha256 })),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const bytes = `${JSON.stringify(config, null, 2)}\n`;
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, bytes, { encoding: "utf8", mode: 0o600 });
  await rename(temp, path);
}

const output = await mkdtemp(resolve(tmpdir(), "superbee-docs-diagram-apply-"));
const built = await compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: output });
const changes = [];
for (const row of built.rows) {
  changes.push(await promote(row.sourcePath, row.publishedSource, "text/plain; charset=utf-8"));
  changes.push(await promote(row.htmlPath, row.entry, "text/html; charset=utf-8"));
  const registration = resolve(output, `${row.id}.md`);
  await writeFile(registration, expectedViewMarkdown(row), "utf8");
  changes.push(await promote(registration, `${row.viewId}.md`));
}
await writePortalConfig(built.rows);
console.log(`diagram_apply: complete\ndiagrams: ${built.rows.length}\nchanged: ${changes.filter((row) => row.changed).length}`);
for (const row of built.rows) console.log(`- ${row.id}: ${row.entrySha256}`);

