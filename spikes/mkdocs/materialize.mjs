import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PROJECTION_SCHEMA } from "./projection.mjs";

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function exactKeys(value, expected, subject) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${subject} must be an object`);
  const unknown = Object.keys(value).filter((key) => !expected.includes(key));
  if (unknown.length) throw new Error(`${subject} contains unknown fields: ${unknown.join(", ")}`);
}

async function requireAbsent(directory, subject) {
  try {
    await lstat(directory);
    throw new Error(`${subject} must be absent`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function safeRelative(value, subject) {
  if (typeof value !== "string" || !value || path.posix.isAbsolute(value)
    || value.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`${subject} must be a safe relative path`);
  }
  return value;
}

async function verifiedFile(root, ref, subject) {
  exactKeys(ref, ["path", "digest", "size", "mediaType"], subject);
  const relative = safeRelative(ref.path, `${subject}.path`);
  if (!/^sha256:[0-9a-f]{64}$/.test(ref.digest) || !Number.isInteger(ref.size) || ref.size < 0) {
    throw new Error(`${subject} has an invalid immutable reference`);
  }
  const bytes = await readFile(path.join(root, ...relative.split("/")));
  if (bytes.byteLength !== ref.size || sha256(bytes) !== ref.digest) throw new Error(`${subject} bytes do not match the projection manifest`);
  return { relative, bytes };
}

function quote(value) {
  return JSON.stringify(String(value));
}

function mkdocsConfig(manifest) {
  const byId = new Map(manifest.documents.map((document) => [document.id, document]));
  const lines = [
    `site_name: ${quote(`${manifest.product.name} documentation`)}`,
    ...(manifest.product.repositoryUrl ? [`repo_url: ${quote(manifest.product.repositoryUrl)}`] : []),
    "docs_dir: docs",
    "site_dir: site",
    "use_directory_urls: true",
    "strict: true",
    "theme:",
    "  name: mkdocs",
    ...(manifest.brandMark ? [`  logo: ${quote(manifest.brandMark.path)}`] : []),
    "markdown_extensions:",
    "  - meta",
    "  - tables",
    "  - fenced_code",
    "  - toc:",
    "      permalink: true",
    "hooks:",
    "  - hook.py",
    "extra_css:",
    "  - assets/spike.css",
    "validation:",
    "  nav:",
    "    omitted_files: warn",
    "    not_found: warn",
    "    absolute_links: warn",
    "  links:",
    "    not_found: warn",
    "    anchors: warn",
    "    absolute_links: relative_to_docs",
    "    unrecognized_links: warn",
    "not_in_nav: |",
    ...manifest.supportingDocuments.map((id) => `  ${id}.md`),
    "nav:",
    `  - Home: index.md`,
    ...manifest.navigation.flatMap((section) => [
      `  - ${quote(section.label)}:`,
      ...section.documents.map((id) => `      - ${quote(byId.get(id).title)}: ${id}.md`),
    ]),
    "",
  ];
  return Buffer.from(lines.join("\n"));
}

function gateway(manifest) {
  const home = manifest.documents.find((document) => document.id === manifest.home);
  return Buffer.from(`# ${manifest.product.name} documentation\n\n${home.description ?? "Source-grounded product documentation."}\n\n[Start here](${manifest.home}.md)\n`);
}

function validateManifest(manifest) {
  exactKeys(manifest, ["schema", "snapshotDigest", "product", "home", "navigation", "supportingDocuments", "documents", "relationships", "diagrams", "brandMark"], "projection manifest");
  if (manifest.schema !== PROJECTION_SCHEMA || !Array.isArray(manifest.documents) || !Array.isArray(manifest.navigation)
    || !Array.isArray(manifest.supportingDocuments) || !Array.isArray(manifest.relationships) || !Array.isArray(manifest.diagrams)) {
    throw new Error("projection manifest is not the spike v0 shape");
  }
  exactKeys(manifest.product, ["name", "versionLabel", "repositoryUrl"], "projection product");
  const ids = new Set(manifest.documents.map((document) => document.id));
  if (!ids.has(manifest.home)) throw new Error("projection home is absent");
  for (const section of manifest.navigation) {
    exactKeys(section, ["label", "documents"], "projection navigation section");
    for (const id of section.documents) if (!ids.has(id)) throw new Error(`navigation document '${id}' is absent`);
  }
  for (const id of manifest.supportingDocuments) if (!ids.has(id)) throw new Error(`supporting document '${id}' is absent`);
  return manifest;
}

export async function materializeMkDocs({ projection, output }) {
  if (!projection || !output) throw new Error("projection and output are required");
  const projectionRoot = path.resolve(projection);
  const manifest = validateManifest(JSON.parse(await readFile(path.join(projectionRoot, "projection.json"), "utf8")));
  const outputRoot = path.resolve(output);
  await requireAbsent(outputRoot, "MkDocs spike output");
  await mkdir(path.join(outputRoot, "docs"), { recursive: true });

  for (const document of manifest.documents) {
    exactKeys(document, ["id", "type", "title", "description", "source"], `document '${document.id}'`);
    const source = await verifiedFile(projectionRoot, document.source, `document '${document.id}' source`);
    const target = path.join(outputRoot, "docs", ...`${document.id}.md`.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source.bytes, { flag: "wx" });
  }
  for (const diagram of manifest.diagrams) {
    exactKeys(diagram, ["id", "documentId", "title", "description", "asset"], `diagram '${diagram.id}'`);
    const asset = await verifiedFile(projectionRoot, diagram.asset, `diagram '${diagram.id}' asset`);
    const target = path.join(outputRoot, "docs", ...asset.relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, asset.bytes, { flag: "wx" });
  }
  if (manifest.brandMark) {
    const asset = await verifiedFile(projectionRoot, manifest.brandMark, "brand mark");
    const target = path.join(outputRoot, "docs", ...asset.relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, asset.bytes, { flag: "wx" });
  }

  const templates = new URL("./", import.meta.url);
  const [hook, css, projectionBytes] = await Promise.all([
    readFile(new URL("hook.py", templates)),
    readFile(new URL("spike.css", templates)),
    readFile(path.join(projectionRoot, "projection.json")),
  ]);
  await mkdir(path.join(outputRoot, "docs", "assets"), { recursive: true });
  await writeFile(path.join(outputRoot, "docs", "index.md"), gateway(manifest), { flag: "wx" });
  await writeFile(path.join(outputRoot, "docs", "assets", "spike.css"), css, { flag: "wx" });
  await writeFile(path.join(outputRoot, "hook.py"), hook, { flag: "wx" });
  await writeFile(path.join(outputRoot, "projection.json"), projectionBytes, { flag: "wx" });
  await writeFile(path.join(outputRoot, "mkdocs.yml"), mkdocsConfig(manifest), { flag: "wx" });
  return { output: outputRoot, documents: manifest.documents.length, diagrams: manifest.diagrams.length };
}

function options(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !new Set(["--projection", "--output"]).has(flag)) {
      throw new Error("usage: node spikes/mkdocs/materialize.mjs --projection <dir> --output <dir>");
    }
    parsed[flag.slice(2)] = value;
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await materializeMkDocs(options(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
