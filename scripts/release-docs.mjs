import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { assertStableReleaseVersionLabel, stableReleaseVersionLabel } from "./release-version-label.mjs";

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_INPUT_V1 = "superbee-docs-release-input.v1";
const knownInputFields = new Set([
  "schema", "package", "version", "npmTag", "publishedAt", "summary", "changes", "action",
  "compatibility", "recovery", "packageUrl", "tarballUrl", "npmIntegrity", "sourceUrl",
  "sourceCommit", "sourceTag", "nodeRequirement", "supportedPlatforms", "verification",
]);

function usage() {
  return `Usage:
  npm run docs:release -- --manifest <release.json>
  node scripts/release-docs.mjs archive
  npm run docs:release:check

The JSON input is an ephemeral handoff from the verified release process. It is not committed as a
second documentation authority. The command writes immutable versioned Source/Release documents and
updates the stable sources/current-release and releases/current bundle identities through Superbee.
The archive command reconciles the reader-facing release index, release navigation, and immutable
release selection from the Release and Source records already in the bundle.

Required manifest fields:
  schema, package, version, npmTag, publishedAt, summary, changes[], action, compatibility,
  recovery, packageUrl, tarballUrl, npmIntegrity, sourceUrl, sourceCommit, sourceTag,
  nodeRequirement, supportedPlatforms[], verification[]

Options:
  --root <path>          Repository root (test and automation override)
  --superbee-bin <path> Superbee executable (default: superbee)
  -h, --help             Show this help
`;
}

function parseOptions(args) {
  const options = { root: scriptRoot, superbeeBin: "superbee" };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "-h" || flag === "--help") return { ...options, help: true };
    if (!["--manifest", "--root", "--superbee-bin"].includes(flag)) throw new Error(`unknown option: ${flag}`);
    const value = args[++index];
    if (!value) throw new Error(`${flag} requires a value`);
    if (flag === "--manifest") options.manifest = resolve(value);
    if (flag === "--root") options.root = resolve(value);
    if (flag === "--superbee-bin") options.superbeeBin = value;
  }
  return options;
}

function requireString(input, field, { pattern, url = false } = {}) {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) throw new Error(`manifest ${field} must be a non-empty string`);
  if (pattern && !pattern.test(value)) throw new Error(`manifest ${field} has an invalid value`);
  if (url) {
    let parsed;
    try { parsed = new URL(value); } catch { throw new Error(`manifest ${field} must be an absolute URL`); }
    if (!new Set(["http:", "https:"]).has(parsed.protocol)) throw new Error(`manifest ${field} must use HTTP(S)`);
  }
  return value.trim();
}

function requireStringArray(input, field) {
  const value = input[field];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim() || /[\r\n]/.test(item))) {
    throw new Error(`manifest ${field} must be a non-empty array of single-line strings`);
  }
  return value.map((item) => item.trim());
}

function validateInput(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("release manifest must be a JSON object");
  const unknown = Object.keys(raw).filter((field) => !knownInputFields.has(field));
  if (unknown.length) throw new Error(`unknown release manifest field(s): ${unknown.join(", ")}`);
  const input = {
    schema: requireString(raw, "schema"),
    package: requireString(raw, "package"),
    version: requireString(raw, "version", { pattern: /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/ }),
    npmTag: requireString(raw, "npmTag", { pattern: /^[a-z0-9][a-z0-9._-]*$/i }),
    publishedAt: requireString(raw, "publishedAt", { pattern: /^\d{4}-\d{2}-\d{2}$/ }),
    summary: requireString(raw, "summary"),
    changes: requireStringArray(raw, "changes"),
    action: requireString(raw, "action"),
    compatibility: requireString(raw, "compatibility"),
    recovery: requireString(raw, "recovery"),
    packageUrl: requireString(raw, "packageUrl", { url: true }),
    tarballUrl: requireString(raw, "tarballUrl", { url: true }),
    npmIntegrity: requireString(raw, "npmIntegrity", { pattern: /^sha512-[A-Za-z0-9+/=]+$/ }),
    sourceUrl: requireString(raw, "sourceUrl", { url: true }),
    sourceCommit: requireString(raw, "sourceCommit", { pattern: /^[0-9a-f]{40}$/ }),
    sourceTag: requireString(raw, "sourceTag", { pattern: /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/ }),
    nodeRequirement: requireString(raw, "nodeRequirement"),
    supportedPlatforms: requireStringArray(raw, "supportedPlatforms"),
    verification: requireStringArray(raw, "verification"),
  };
  if (input.schema !== RELEASE_INPUT_V1) throw new Error(`manifest schema must be ${RELEASE_INPUT_V1}`);
  if (input.package !== "superbee") throw new Error("manifest package must be superbee");
  if (input.npmTag !== "latest") throw new Error("manifest npmTag must be latest when advancing the stable current release");
  if (input.sourceTag !== `v${input.version}`) throw new Error("manifest sourceTag must equal v<version>");
  const canonicalUrls = {
    packageUrl: `https://www.npmjs.com/package/superbee/v/${input.version}`,
    tarballUrl: `https://registry.npmjs.org/superbee/-/superbee-${input.version}.tgz`,
    sourceUrl: `https://github.com/Holaxis-ai/superbee/tree/v${input.version}`,
  };
  for (const [field, expected] of Object.entries(canonicalUrls)) {
    if (input[field] !== expected) throw new Error(`manifest ${field} must equal ${expected}`);
  }
  const authored = [input.summary, input.action, input.compatibility, input.recovery, ...input.changes, ...input.verification];
  if (authored.some((value) => /\bTODO\b|REPLACE_WITH|<[^>]+>/i.test(value))) {
    throw new Error("release manifest still contains an authored-content placeholder");
  }
  const published = new Date(`${input.publishedAt}T00:00:00Z`);
  if (Number.isNaN(published.valueOf()) || published.toISOString().slice(0, 10) !== input.publishedAt) {
    throw new Error("manifest publishedAt is not a real date");
  }
  return input;
}

function yaml(value) { return JSON.stringify(value); }
function bullets(values) { return values.map((value) => `- ${value}`).join("\n"); }

function releaseDocument(input) {
  const evidenceId = `superbee-release-${input.version}`;
  return `---
type: Release
title: ${yaml(`Superbee ${input.version}`)}
description: ${yaml(input.summary)}
version: ${yaml(input.version)}
channel: ${yaml(input.npmTag)}
published_at: ${yaml(input.publishedAt)}
resource: ${yaml(input.packageUrl)}
superbee_updated_by: ${yaml("release-docs-automation")}
---
# Superbee ${input.version}

${input.summary}

This release was published on ${input.publishedAt} as \`${input.package}@${input.version}\` under
the npm \`${input.npmTag}\` tag.

# What changed

${bullets(input.changes)}

# What you need to do

${input.action}

# Compatibility

${input.compatibility}

# Recovery

${input.recovery}

# Verified evidence

[Inspect the package, source, and verification evidence](../sources/${evidenceId}.md).
`;
}

function sourceDocument(input) {
  return `---
type: Source
title: ${yaml(`Superbee ${input.version} release evidence`)}
description: ${yaml(`Immutable package, source, compatibility, and verification evidence for Superbee ${input.version}.`)}
resource: ${yaml(input.tarballUrl)}
version: ${yaml(input.version)}
channel: ${yaml(input.npmTag)}
published_at: ${yaml(input.publishedAt)}
superbee_updated_by: ${yaml("release-docs-automation")}
---
# Evidence identity

| Field | Verified value |
| --- | --- |
| npm package | \`${input.package}@${input.version}\` |
| npm tag | \`${input.npmTag}\` |
| npm integrity | \`${input.npmIntegrity}\` |
| npm tarball | \`${input.tarballUrl}\` |
| source tag | \`${input.sourceTag}\` |
| source commit | \`${input.sourceCommit}\` |
| Node requirement | \`${input.nodeRequirement}\` |
| supported platforms | ${input.supportedPlatforms.map((value) => `\`${value}\``).join(", ")} |

# Public authorities

- Package: ${input.packageUrl}
- Source: ${input.sourceUrl}

# Verification performed

${bullets(input.verification)}

# Publication boundary

This document records the verified release handoff consumed by the documentation update. Product
source, package receipts, and executed probes remain authoritative for the claims they establish.
`;
}

function compareStableVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if (leftParts[index] !== rightParts[index]) return rightParts[index] - leftParts[index];
  }
  return 0;
}

function releaseArchiveDocument(current, releases) {
  const previous = releases.filter((release) => release.version !== current.version);
  const prior = previous.length
    ? previous.map((release) => {
      const published = release.publishedAt ? ` Published ${release.publishedAt}.` : "";
      return `## Superbee ${release.version}\n\n${release.description}${published}\n\n[Read the ${release.version} release notes](${release.version}.md).`;
    }).join("\n\n")
    : "There are no previous stable releases yet.";
  const published = current.publishedAt ? ` Published ${current.publishedAt}.` : "";
  return `---
type: Guide
title: ${yaml("Release notes")}
description: ${yaml("What changed in each stable Superbee release, what users need to do, and where to find verified evidence and recovery guidance.")}
superbee_updated_by: ${yaml("release-docs-automation")}
---
# Release notes

Use this page to find the current stable release and the history of earlier stable releases. Each
release note states the reader-facing changes, required action, compatibility, recovery path, and
the exact package and source evidence used to verify it.

# Current stable release

## Superbee ${current.version}

${current.description}${published}

[Read the current ${current.version} release notes](current.md).

# Previous stable releases

${prior}

# Upgrade and recovery guidance

[Migrate or upgrade safely](../guides/migrate-or-upgrade-safely.md) explains how to inspect the
installed version, follow the verified setup path, preserve legacy bundles, and recover by pinning
an earlier release when necessary.
`;
}

function runSuperbee(options, args, { allowFailure = false } = {}) {
  const result = spawnSync(options.superbeeBin, [...args, "--dir", resolve(options.root, ".superbee")], {
    cwd: options.root,
    encoding: null,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = [result.stderr, result.stdout].map((value) => value.toString("utf8").trim()).filter(Boolean).join("\n");
    throw new Error(`superbee ${args.join(" ")} failed (${result.status}): ${detail}`);
  }
  return result;
}

function documentVersion(options, id) {
  const result = runSuperbee(options, ["doc", "read", id, "--field", "head_version"], { allowFailure: true });
  return result.status === 0 ? result.stdout.toString("utf8").trim() : null;
}

function documentBytes(options, id) {
  return runSuperbee(options, ["doc", "read", id, "--out", "-"]).stdout;
}

function documentProjection(options, id) {
  const metadata = JSON.parse(runSuperbee(options, ["doc", "read", id, "--json"]).stdout.toString("utf8"));
  for (const field of ["id", "head_version", "body", "body_truncated", "body_chars", "help"]) delete metadata[field];
  const body = runSuperbee(options, ["doc", "read", id, "--body-out", "-"]).stdout;
  return { metadata, body };
}

async function promote(options, scratch, id, bytes, { immutable }) {
  const version = documentVersion(options, id);
  if (version !== null) {
    const current = documentBytes(options, id);
    if (current.equals(bytes)) return { id, changed: false };
    if (immutable) throw new Error(`refusing to replace immutable release document ${id}`);
  }
  const source = resolve(scratch, `${basename(id)}.md`);
  await writeFile(source, bytes);
  const args = ["promote", source, "--doc-key", `${id}.md`, "--json"];
  if (version !== null) args.push("--expected-version", version);
  runSuperbee(options, args);
  return { id, changed: true };
}

async function normalizeDocument(options, scratch, id, bytes) {
  const normalizationRoot = resolve(scratch, "normalization");
  const bundle = resolve(normalizationRoot, ".superbee");
  await mkdir(bundle, { recursive: true });
  const index = resolve(bundle, "index.md");
  try { await readFile(index); }
  catch { await writeFile(index, "---\nokf_version: '0.2'\n---\n# Release document normalization\n"); }
  const source = resolve(scratch, `${basename(id)}-normalize.md`);
  await writeFile(source, bytes);
  const normalizedOptions = { ...options, root: normalizationRoot };
  runSuperbee(normalizedOptions, ["promote", source, "--doc-key", `${id}.md`, "--json"]);
  return documentBytes(normalizedOptions, id);
}

function updateKindField(options, id, field, values) {
  const current = documentProjection(options, id).metadata[field];
  if (JSON.stringify(current) === JSON.stringify(values)) return { changed: false };
  const version = documentVersion(options, id);
  const list = Array.isArray(values) ? values : [values];
  const args = ["doc", "update", id];
  for (const value of list) args.push(`--${field}`, value);
  args.push("--expected-version", version, "--actor", "release-docs-automation", "--strict", "--json");
  const receipt = JSON.parse(runSuperbee(options, args).stdout.toString("utf8"));
  return { changed: receipt.changed === true };
}

async function updateDocumentationSystemVersionLabel(options, version) {
  const versionLabel = stableReleaseVersionLabel(version);
  const result = updateKindField(options, "documentation-systems/main", "version_label", versionLabel);
  return { ...result, versionLabel };
}

async function releaseRows(options) {
  const directory = resolve(options.root, ".superbee", "releases");
  const ids = (await readdir(directory))
    .filter((name) => /^\d+\.\d+\.\d+\.md$/.test(name))
    .map((name) => `releases/${name.slice(0, -3)}`);
  const releases = ids.map((id) => {
    const metadata = documentProjection(options, id).metadata;
    const version = String(metadata.version ?? "");
    if (!/^\d+\.\d+\.\d+$/.test(version) || id !== `releases/${version}`) {
      throw new Error(`release archive encountered invalid immutable release identity ${id}`);
    }
    return {
      id,
      version,
      description: String(metadata.description ?? "").trim(),
      publishedAt: metadata.published_at ? String(metadata.published_at) : undefined,
    };
  }).sort((left, right) => compareStableVersions(left.version, right.version));
  if (!releases.length) throw new Error("release archive requires at least one immutable stable release");
  const currentMetadata = documentProjection(options, "releases/current").metadata;
  const current = releases.find((release) => release.version === String(currentMetadata.version ?? ""));
  if (!current) throw new Error("releases/current does not identify an immutable stable release");
  return { current, releases };
}

async function immutableReleaseSupport(options) {
  const releases = (await readdir(resolve(options.root, ".superbee", "releases")))
    .filter((name) => /^\d+\.\d+\.\d+\.md$/.test(name))
    .map((name) => `releases/${name.slice(0, -3)}`);
  const sources = (await readdir(resolve(options.root, ".superbee", "sources")))
    .filter((name) => /^superbee-release-\d+\.\d+\.\d+\.md$/.test(name))
    .map((name) => `sources/${name.slice(0, -3)}`);
  return [...releases, ...sources].sort();
}

async function updateDocumentationSelection(options) {
  const publication = documentProjection(options, "documentation-publications/current").metadata;
  const supportingDocuments = publication.supporting_documents ?? [];
  if (!Array.isArray(supportingDocuments)) throw new Error("documentation publication supporting_documents must be a list");
  const expected = [...new Set([...supportingDocuments, ...await immutableReleaseSupport(options)])].sort();
  if (JSON.stringify(supportingDocuments) === JSON.stringify(expected)) return { changed: false, supportingDocuments: expected };
  const result = updateKindField(options, "documentation-publications/current", "supporting_documents", expected);
  return { ...result, supportingDocuments: expected };
}

async function updateReleaseArchive(options, scratch) {
  const { current, releases } = await releaseRows(options);
  const archive = await normalizeDocument(options, scratch, "normalized/release-index", Buffer.from(releaseArchiveDocument(current, releases)));
  return promote(options, scratch, "releases/release-notes", archive, { immutable: false });
}

async function reconcilePresentation(options, scratch) {
  const currentVersion = runSuperbee(options, ["doc", "read", "releases/current", "--field", "version"]).stdout.toString("utf8").trim();
  const archive = await updateReleaseArchive(options, scratch);
  const system = await updateDocumentationSystemVersionLabel(options, currentVersion);
  const selection = await updateDocumentationSelection(options);
  return { currentVersion, archive, system, selection };
}

async function update(options) {
  if (!options.manifest) throw new Error("update requires --manifest <release.json>");
  const input = validateInput(JSON.parse(await readFile(options.manifest, "utf8")));
  const releaseInput = Buffer.from(releaseDocument(input));
  const sourceInput = Buffer.from(sourceDocument(input));
  const scratch = await mkdtemp(resolve(tmpdir(), "superbee-release-docs-"));
  try {
    const release = await normalizeDocument(options, scratch, "normalized/release", releaseInput);
    const source = await normalizeDocument(options, scratch, "normalized/source", sourceInput);
    const results = [];
    results.push(await promote(options, scratch, `sources/superbee-release-${input.version}`, source, { immutable: true }));
    results.push(await promote(options, scratch, `releases/${input.version}`, release, { immutable: true }));
    results.push(await promote(options, scratch, "sources/current-release", source, { immutable: false }));
    results.push(await promote(options, scratch, "releases/current", release, { immutable: false }));
    const presentation = await reconcilePresentation(options, scratch);
    results.push(presentation.archive);
    console.log(JSON.stringify({
      version: input.version,
      versionLabel: presentation.system.versionLabel,
      documentationSystemChanged: presentation.system.changed,
      selectionChanged: presentation.selection.changed,
      changed: results.filter((row) => row.changed).map((row) => row.id),
      results,
    }));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function archive(options) {
  const scratch = await mkdtemp(resolve(tmpdir(), "superbee-release-archive-"));
  try {
    const presentation = await reconcilePresentation(options, scratch);
    console.log(JSON.stringify({
      version: presentation.currentVersion,
      versionLabel: presentation.system.versionLabel,
      archiveChanged: presentation.archive.changed,
      documentationSystemChanged: presentation.system.changed,
      selectionChanged: presentation.selection.changed,
    }));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function markdownFiles(directory, out = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await markdownFiles(path, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(path);
  }
  return out;
}

async function check(options) {
  const currentVersionResult = runSuperbee(options, ["doc", "read", "releases/current", "--field", "version"]);
  const version = currentVersionResult.stdout.toString("utf8").trim();
  stableReleaseVersionLabel(version);
  const pairs = [
    ["releases/current", `releases/${version}`],
    ["sources/current-release", `sources/superbee-release-${version}`],
  ];
  for (const [current, immutable] of pairs) {
    const currentProjection = documentProjection(options, current);
    const immutableProjection = documentProjection(options, immutable);
    if (JSON.stringify(currentProjection.metadata) !== JSON.stringify(immutableProjection.metadata) || !currentProjection.body.equals(immutableProjection.body)) {
      throw new Error(`${current} must be semantically identical to ${immutable}`);
    }
  }
  const releaseIds = documentProjection(options, "documentation-sections/releases-and-migrations").metadata.documents
    .filter((id) => id.startsWith("releases/"));
  if (!releaseIds.includes("releases/current")) throw new Error("Portal navigation must include releases/current");
  if (!releaseIds.includes("releases/release-notes")) throw new Error("Portal navigation must include releases/release-notes");
  if (releaseIds.some((id) => /^releases\/\d+\.\d+\.\d+/.test(id))) throw new Error("Portal navigation must not pin a versioned release document");
  const system = documentProjection(options, "documentation-systems/main").metadata;
  assertStableReleaseVersionLabel({ versionLabel: system.version_label }, version);

  const requiredSupport = await immutableReleaseSupport(options);
  const support = documentProjection(options, "documentation-publications/current").metadata.supporting_documents;
  const missingSupport = requiredSupport.filter((id) => !support?.includes(id));
  if (missingSupport.length) throw new Error(`documentation config omits immutable release history: ${missingSupport.join(", ")}`);

  const scratch = await mkdtemp(resolve(tmpdir(), "superbee-release-check-"));
  try {
    const { current, releases } = await releaseRows(options);
    const expectedArchive = await normalizeDocument(options, scratch, "normalized/release-index", Buffer.from(releaseArchiveDocument(current, releases)));
    if (!documentBytes(options, "releases/release-notes").equals(expectedArchive)) {
      throw new Error("releases/release-notes does not match immutable release history");
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  const bundle = resolve(options.root, ".superbee");
  const allowed = /^(?:releases|sources|migrations|evidence|documentation-publications)\//;
  const volatileVersion = /\b(?:superbee@|Superbee\s+|released\s+)[v]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b|\breleased\s+`?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`?\b|(?:sources\/superbee-release-|releases\/)[v]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\.md)?|(?:npmjs\.com\/package\/superbee\/v\/|registry\.npmjs\.org\/superbee\/-\/superbee-)[v]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/i;
  const stale = [];
  for (const path of await markdownFiles(bundle)) {
    const id = relative(bundle, path).replace(/\.md$/, "");
    if (allowed.test(id)) continue;
    const lines = (await readFile(path, "utf8")).split("\n");
    lines.forEach((line, index) => {
      if (volatileVersion.test(line)) {
        stale.push(`${relative(options.root, path)}:${index + 1}`);
      }
    });
  }
  if (stale.length) throw new Error(`hardcoded Superbee package version outside release/evidence records:\n${stale.join("\n")}`);
  console.log(`release_docs: valid\ncurrent_version: ${version}\nstable_documents: ${pairs.length * 2}\nvolatile_version_references: 0`);
}

const command = process.argv[2];
try {
  if (!command || !new Set(["update", "archive", "check"]).has(command)) throw new Error("expected update, archive, or check");
  const options = parseOptions(process.argv.slice(3));
  if (options.help) console.log(usage());
  else if (command === "update") await update(options);
  else if (command === "archive") await archive(options);
  else await check(options);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("\n" + usage());
  process.exitCode = 1;
}
