import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { checkPublishedAgreement } from "@superbee/docs-tooling";
import { capturePublicationSnapshot, PUBLICATION_SNAPSHOT_V1 } from "superbee/publication";

export const PROJECTION_SCHEMA = "superbee-docs-documentation-projection-spike/v0";
export const SELECTION_SCHEMA = "superbee-docs-projection-selection-spike/v0";

const encoder = new TextEncoder();

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function exactKeys(value, expected, subject) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${subject} must be an object`);
  const unknown = Object.keys(value).filter((key) => !expected.includes(key));
  if (unknown.length) throw new Error(`${subject} contains unknown fields: ${unknown.join(", ")}`);
}

function documentId(value, subject) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:[a-z0-9/_.-]*[a-z0-9])?$/.test(value)
    || value.includes("//") || value.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error(`${subject} is not a safe document id`);
  }
  return value;
}

async function requireAbsent(directory, subject) {
  try {
    await lstat(directory);
    throw new Error(`${subject} must be absent`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function documentTitle(document) {
  const title = document.frontmatter.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  return document.id.split("/").at(-1).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function documentDescription(document) {
  const description = document.frontmatter.description;
  return typeof description === "string" && description.trim() ? description.trim() : undefined;
}

function manifestBytes(manifest) {
  return encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`);
}

async function readJson(file, subject) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(`${subject} must be readable JSON`, { cause: error });
  }
}

function normalizeSelection(input) {
  exactKeys(input, ["schema", "supportingDocuments"], "projection selection");
  if (input.schema !== SELECTION_SCHEMA || !Array.isArray(input.supportingDocuments)) {
    throw new Error("projection selection must use the spike v0 schema and an explicit supportingDocuments array");
  }
  const supportingDocuments = input.supportingDocuments.map((id, index) => documentId(id, `supportingDocuments[${index}]`));
  if (new Set(supportingDocuments).size !== supportingDocuments.length) {
    throw new Error("projection supportingDocuments must be unique");
  }
  return supportingDocuments;
}

function normalizeDocumentation(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("documentation configuration must be an object");
  const productName = typeof input.productName === "string" && input.productName.trim() ? input.productName.trim() : undefined;
  const home = documentId(input.home, "documentation.home");
  if (!productName || !Array.isArray(input.navigation) || input.navigation.length === 0) {
    throw new Error("documentation configuration requires productName, home, and navigation");
  }
  const seen = new Set();
  const navigation = input.navigation.map((section, sectionIndex) => {
    if (!section || typeof section !== "object" || Array.isArray(section)
      || typeof section.label !== "string" || !section.label.trim()
      || !Array.isArray(section.documents) || section.documents.length === 0) {
      throw new Error(`documentation.navigation[${sectionIndex}] is invalid`);
    }
    const documents = section.documents.map((id, index) => {
      const normalized = documentId(id, `documentation.navigation[${sectionIndex}].documents[${index}]`);
      if (seen.has(normalized)) throw new Error(`navigation repeats document '${normalized}'`);
      seen.add(normalized);
      return normalized;
    });
    return { label: section.label.trim(), documents };
  });
  if (!seen.has(home)) throw new Error("documentation.home must be a navigated document");
  return {
    productName,
    home,
    navigation,
    ...(typeof input.versionLabel === "string" && input.versionLabel ? { versionLabel: input.versionLabel } : {}),
    ...(typeof input.repositoryUrl === "string" && input.repositoryUrl ? { repositoryUrl: input.repositoryUrl } : {}),
    brandBlob: input.brandMark?.blob,
  };
}

function relativeFile(root, value, subject) {
  if (typeof value !== "string" || !value || path.isAbsolute(value) || value.includes("\0")) {
    throw new Error(`${subject} must be a non-empty relative path`);
  }
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
    throw new Error(`${subject} must remain inside the spike root`);
  }
  return resolved;
}

async function writeProjection(output, manifest, files) {
  await requireAbsent(output, "projection output");
  await mkdir(output, { recursive: true });
  for (const [relative, bytes] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    const target = relativeFile(output, relative, "projection file");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
  }
  await writeFile(path.join(output, "projection.json"), manifestBytes(manifest), { flag: "wx" });
}

export async function buildProjection({ root = ".", config = "portal.config.json", selection = "spikes/mkdocs/projection-selection.json", output }) {
  if (!output) throw new Error("projection output is required");
  const absoluteRoot = path.resolve(root);
  const configFile = relativeFile(absoluteRoot, config, "documentation config");
  const selectionFile = relativeFile(absoluteRoot, selection, "projection selection");
  const [siteConfig, selectionConfig] = await Promise.all([
    readJson(configFile, "documentation config"),
    readJson(selectionFile, "projection selection"),
  ]);
  const documentation = normalizeDocumentation(siteConfig.documentation);
  const supportingDocuments = normalizeSelection(selectionConfig);
  const navigatedDocuments = documentation.navigation.flatMap((section) => section.documents);
  const selectedDocuments = [...navigatedDocuments, ...supportingDocuments];
  if (new Set(selectedDocuments).size !== selectedDocuments.length) {
    throw new Error("supportingDocuments must not repeat a navigated document");
  }
  const selected = new Set(selectedDocuments);
  const bundle = relativeFile(path.dirname(configFile), siteConfig.bundle, "bundle");
  const [diagramAgreement, snapshot] = await Promise.all([
    checkPublishedAgreement({ root: absoluteRoot, configPath: configFile }),
    capturePublicationSnapshot({
      schema: PUBLICATION_SNAPSHOT_V1,
      source: { kind: "filesystem", root: bundle },
    }),
  ]);
  try {
    const byId = new Map(snapshot.manifest.documents.map((document) => [document.id, document]));
    for (const id of selectedDocuments) {
      if (!byId.has(id)) throw new Error(`selected document '${id}' is absent from the publication snapshot`);
    }
    const relationships = [];
    for (const relationship of snapshot.manifest.relationships) {
      if (!selected.has(relationship.from)) continue;
      if (!selected.has(relationship.to)) {
        throw new Error(`selected document '${relationship.from}' links to unselected local document '${relationship.to}'`);
      }
      relationships.push({
        from: relationship.from,
        to: relationship.to,
        text: relationship.text,
        href: relationship.href,
      });
    }
    relationships.sort((left, right) => left.from.localeCompare(right.from)
      || left.to.localeCompare(right.to) || left.href.localeCompare(right.href) || left.text.localeCompare(right.text));

    const files = new Map();
    const documents = [];
    for (const id of [...selectedDocuments].sort()) {
      const document = byId.get(id);
      const bytes = await snapshot.readObject(document.source);
      const sourcePath = `documents/${id}.md`;
      files.set(sourcePath, bytes);
      documents.push({
        id,
        type: String(document.frontmatter.type),
        title: documentTitle(document),
        ...(documentDescription(document) ? { description: documentDescription(document) } : {}),
        source: {
          path: sourcePath,
          digest: document.source.digest,
          size: document.source.size,
          mediaType: document.source.mediaType,
        },
      });
    }

    const diagrams = [];
    for (const binding of [...diagramAgreement.bindings].sort((left, right) => left.diagramId.localeCompare(right.diagramId))) {
      if (!selected.has(binding.documentId)) {
        throw new Error(`diagram '${binding.diagramId}' binds to unselected document '${binding.documentId}'`);
      }
      const digest = sha256(binding.svgBytes);
      if (digest !== binding.svgSha256) throw new Error(`diagram '${binding.diagramId}' digest changed after verification`);
      const assetPath = `assets/diagrams/${binding.diagramId}.${digest.slice("sha256:".length)}.svg`;
      files.set(assetPath, binding.svgBytes);
      diagrams.push({
        id: binding.diagramId,
        documentId: binding.documentId,
        title: binding.title,
        description: binding.description,
        asset: { path: assetPath, digest, size: binding.svgBytes.byteLength, mediaType: "image/svg+xml" },
      });
    }

    let brandMark;
    if (documentation.brandBlob !== undefined) {
      if (typeof documentation.brandBlob !== "string" || !documentation.brandBlob) {
        throw new Error("documentation brandMark must name one bundle blob");
      }
      const blob = snapshot.manifest.blobs.find((candidate) => candidate.key === documentation.brandBlob);
      if (!blob) throw new Error(`brand blob '${documentation.brandBlob}' is absent from the publication snapshot`);
      const bytes = await snapshot.readObject(blob.object);
      const extension = blob.contentType === "image/png" ? "png" : undefined;
      if (!extension) throw new Error("projection spike supports only an image/png brand mark");
      const assetPath = `assets/brand/superbee-mark.${blob.object.digest.slice("sha256:".length)}.${extension}`;
      files.set(assetPath, bytes);
      brandMark = {
        path: assetPath,
        digest: blob.object.digest,
        size: blob.object.size,
        mediaType: blob.object.mediaType,
      };
    }

    const manifest = {
      schema: PROJECTION_SCHEMA,
      snapshotDigest: snapshot.manifest.snapshotDigest,
      product: {
        name: documentation.productName,
        ...(documentation.versionLabel ? { versionLabel: documentation.versionLabel } : {}),
        ...(documentation.repositoryUrl ? { repositoryUrl: documentation.repositoryUrl } : {}),
      },
      home: documentation.home,
      navigation: documentation.navigation,
      supportingDocuments: [...supportingDocuments].sort(),
      documents,
      relationships,
      diagrams,
      ...(brandMark ? { brandMark } : {}),
    };
    await writeProjection(path.resolve(output), manifest, files);
    return { manifest, manifestBytes: manifestBytes(manifest), output: path.resolve(output) };
  } finally {
    await snapshot.close();
  }
}

function options(argv) {
  const parsed = { root: ".", config: "portal.config.json", selection: "spikes/mkdocs/projection-selection.json" };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !new Set(["--root", "--config", "--selection", "--output"]).has(flag)) {
      throw new Error("usage: node spikes/mkdocs/projection.mjs [--root <dir>] [--config <file>] [--selection <file>] --output <dir>");
    }
    parsed[flag.slice(2)] = value;
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await buildProjection(options(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify({ ok: true, output: result.output, snapshotDigest: result.manifest.snapshotDigest, documents: result.manifest.documents.length, diagrams: result.manifest.diagrams.length })}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
