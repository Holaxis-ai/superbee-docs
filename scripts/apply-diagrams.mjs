import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { compileAll, expectedViewMarkdown } from "../tooling/diagram-pipeline/src/index.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = resolve(root, ".superbee");
const publicationStatePath = resolve(root, "diagrams/publications.json");

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

async function exists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

function bundleTarget(key) {
  const target = resolve(bundle, key);
  const rel = relative(bundle, target);
  if (rel === "" || rel.startsWith("..") || resolve(bundle, rel) !== target) {
    throw new Error(`managed publication key '${key}' must resolve beneath the bundle`);
  }
  return target;
}

function publicationRecord(row) {
  return {
    id: row.id,
    publishedSource: row.publishedSource,
    viewId: row.viewId,
    entry: row.entry,
  };
}

function publicationKeys(row) {
  return [row.publishedSource, `${row.viewId}.md`, row.entry];
}

async function readPublicationState() {
  const state = JSON.parse(await readFile(publicationStatePath, "utf8"));
  if (state.schema !== "https://getsuperbee.com/schemas/docs-diagram-publications/v1" || !Array.isArray(state.diagrams)) {
    throw new Error("diagram publication state must use docs-diagram-publications/v1");
  }
  for (const [index, row] of state.diagrams.entries()) {
    for (const field of ["id", "publishedSource", "viewId", "entry"]) {
      if (typeof row?.[field] !== "string" || row[field].trim() === "") {
        throw new Error(`publication state diagrams[${index}].${field} must be a non-empty string`);
      }
    }
    for (const key of publicationKeys(row)) bundleTarget(key);
  }
  return state;
}

async function writeJson(path, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  const current = await readFile(path).catch(() => undefined);
  if (current?.equals(Buffer.from(bytes))) return false;
  const temp = `${path}.tmp-${process.pid}`;
  await writeFile(temp, bytes, { encoding: "utf8", mode: 0o600 });
  await rename(temp, path);
  return true;
}

async function promote(file, key, contentType) {
  const target = bundleTarget(key);
  const incoming = await readFile(file);
  let current;
  if (await exists(target)) {
    current = await readFile(target);
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
  return { key, changed: !current?.equals(written), version: sha256(written) };
}

async function removeManaged(key) {
  const target = bundleTarget(key);
  if (!(await exists(target))) return { key, changed: false };
  const current = await readFile(target);
  await execFileAsync("superbee", [
    "delete", "--doc-key", key, "--expected-version", sha256(current), "--dir", bundle, "--json",
  ]);
  if (await exists(target)) throw new Error(`managed publication '${key}' was not deleted`);
  return { key, changed: true };
}

async function writePortalConfig(rows, previousRows) {
  const path = resolve(root, "portal.config.json");
  const config = JSON.parse(await readFile(path, "utf8"));
  const managed = new Set([...previousRows, ...rows].map((row) => row.viewId));
  config.views = [
    ...(config.views ?? []).filter((row) => !managed.has(row.id)),
    ...rows.map((row) => ({ id: row.viewId, entry: row.entry, access: row.access, entrySha256: row.entrySha256 })),
  ].sort((a, b) => a.id.localeCompare(b.id));
  await writeJson(path, config);
}

const output = await mkdtemp(resolve(tmpdir(), "superbee-docs-diagram-apply-"));
try {
  const previous = await readPublicationState();
  const built = await compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: output });
  const changes = [];
  for (const row of built.rows) {
    changes.push(await promote(row.sourcePath, row.publishedSource, "text/plain; charset=utf-8"));
    changes.push(await promote(row.htmlPath, row.entry, "text/html; charset=utf-8"));
    const registration = resolve(output, `${row.id}.md`);
    await writeFile(registration, expectedViewMarkdown(row), "utf8");
    changes.push(await promote(registration, `${row.viewId}.md`));
  }
  const currentRecords = built.rows.map(publicationRecord).sort((a, b) => a.id.localeCompare(b.id));
  const currentKeys = new Set(currentRecords.flatMap(publicationKeys));
  const staleKeys = new Set(previous.diagrams.flatMap(publicationKeys).filter((key) => !currentKeys.has(key)));
  for (const key of staleKeys) changes.push(await removeManaged(key));
  await writePortalConfig(built.rows, previous.diagrams);
  await writeJson(publicationStatePath, {
    schema: "https://getsuperbee.com/schemas/docs-diagram-publications/v1",
    diagrams: currentRecords,
  });
  console.log(`diagram_apply: complete\ndiagrams: ${built.rows.length}\nchanged: ${changes.filter((row) => row.changed).length}`);
  for (const row of built.rows) console.log(`- ${row.id}: ${row.entrySha256}`);
} finally {
  await rm(output, { recursive: true, force: true });
}
