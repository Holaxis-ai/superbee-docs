import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createDocumentationProjectionV1,
  DOCUMENTATION_PROJECTION_CONFIG_V1,
} from "@superbee/docs-projection";
import {
  materializeMkDocsDocumentationV1,
  MKDOCS_DOCUMENTATION_CONFIG_V1,
} from "@superbee/docs-mkdocs";
import {
  createDocumentationPresentationContributionFromProjectionV1,
  DOCUMENTATION_PORTAL_TARGET_V1,
} from "@superbee/portal-docs";
import { checkPublishedAgreement } from "@superbee/docs-tooling";
import { readDocumentationSiteConfigV1 } from "@superbee/docs-tooling/site";
import { capturePublicationSnapshot, PUBLICATION_SNAPSHOT_V1 } from "superbee/publication";
import {
  authorizePortalWrite,
  createPortalArtifact,
  startPortalPreview,
  writePortalArtifact,
} from "superbee-portal";

import { validateDocumentationSelection } from "./documentation-selection.mjs";
import { deriveDocumentationFreshness } from "./documentation-freshness.mjs";

export const DOCUMENTATION_OUTPUTS_RESULT_V1 =
  "https://getsuperbee.com/schemas/superbee-docs/documentation-outputs-result/v1";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

async function json(file, subject) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { throw new Error(`${subject} must be readable JSON`, { cause: error }); }
}

function exactDiagramRows(manifest, bindings) {
  if (!manifest || manifest.schema !== "https://getsuperbee.com/schemas/docs-diagrams/v2"
    || !Array.isArray(manifest.diagrams)) throw new Error("diagram manifest must use the static v2 contract");
  const byId = new Map(manifest.diagrams.map((row) => [row.id, row]));
  if (byId.size !== manifest.diagrams.length || bindings.length !== manifest.diagrams.length) {
    throw new Error("verified diagram bindings must exactly cover the static manifest");
  }
  return [...bindings].sort((left, right) => left.diagramId.localeCompare(right.diagramId)).map((binding) => {
    const row = byId.get(binding.diagramId);
    if (!row || row.documentId !== binding.documentId || row.title !== binding.title
      || row.description !== binding.description
      || row.publishedSvg !== `visuals/diagrams/${binding.diagramId}.svg`
      || sha256(binding.svgBytes) !== binding.svgSha256) {
      throw new Error(`verified diagram '${binding.diagramId}' disagrees with the static manifest`);
    }
    return {
      id: binding.diagramId,
      documentId: binding.documentId,
      title: binding.title,
      description: binding.description,
      blob: row.publishedSvg,
      digest: binding.svgSha256,
    };
  });
}

async function projectionInput({ root, config, snapshot, diagramAgreement }) {
  const selectionFile = path.join(root, "documentation-selection.json");
  const [selection, diagramManifest] = await Promise.all([
    json(selectionFile, "documentation selection"),
    json(config.diagrams.manifest, "static diagram manifest"),
  ]);
  const supportingDocuments = await validateDocumentationSelection(selection, {
    documentation: config.documentation,
  }, root);
  const diagrams = exactDiagramRows(diagramManifest, diagramAgreement.bindings);
  const freshness = await deriveDocumentationFreshness({
    root,
    bundle: config.bundle,
    snapshot,
    documentIds: [...new Set([
      ...config.documentation.navigation.flatMap((section) => section.documents),
      ...supportingDocuments,
    ])],
  });
  let brandMark;
  if (config.documentation.brandMark) {
    const blob = snapshot.manifest.blobs.find((row) => row.key === config.documentation.brandMark.blob);
    if (!blob) throw new Error(`brand blob '${config.documentation.brandMark.blob}' is absent from the publication snapshot`);
    brandMark = { blob: blob.key, digest: blob.object.digest };
  }
  return {
    schema: DOCUMENTATION_PROJECTION_CONFIG_V1,
    product: {
      name: config.documentation.productName,
      ...(config.documentation.versionLabel ? { versionLabel: config.documentation.versionLabel } : {}),
      ...(config.documentation.repositoryUrl ? { repositoryUrl: config.documentation.repositoryUrl } : {}),
    },
    home: config.documentation.home,
    navigation: config.documentation.navigation.map((section) => ({
      label: section.label,
      documents: [...section.documents],
    })),
    supportingDocuments: [...supportingDocuments],
    ...(config.documentation.operationalTypes?.length
      ? { operationalTypes: [...config.documentation.operationalTypes] }
      : {}),
    ...(freshness.length ? { freshness } : {}),
    ...(brandMark ? { brandMark } : {}),
    diagrams,
  };
}

/**
 * Compose both public documentation outputs from one captured snapshot and one owned projection.
 * The source snapshot is closed before the MkDocs adapter reads the projection.
 */
export async function composeDocumentationOutputs({
  root = ".",
  configFile = "portal.config.json",
  mkdocsOutput,
  writePortal = false,
} = {}) {
  const realRoot = await realpath(path.resolve(root));
  const config = await readDocumentationSiteConfigV1(path.resolve(realRoot, configFile));
  if (!config.diagrams) throw new Error("dual documentation outputs require verified static diagram configuration");
  const authority = writePortal ? await authorizePortalWrite(config.bundle, config.output) : undefined;
  const sourceDirectory = authority?.sourceDirectory ?? config.bundle;
  const diagramAgreement = await checkPublishedAgreement({ root: realRoot, configPath: config.file });
  const snapshot = await capturePublicationSnapshot({
    schema: PUBLICATION_SNAPSHOT_V1,
    source: { kind: "filesystem", root: sourceDirectory },
  });
  let projection;
  let contribution;
  let snapshotClosed = false;
  try {
    const input = await projectionInput({ root: realRoot, config, snapshot, diagramAgreement });
    projection = await createDocumentationProjectionV1(snapshot, input);
    contribution = await createDocumentationPresentationContributionFromProjectionV1(projection, {
      schema: DOCUMENTATION_PORTAL_TARGET_V1,
      siteUrl: config.documentation.siteUrl,
      ...(config.portal.title ? { title: config.portal.title } : {}),
      ...(config.portal.description ? { description: config.portal.description } : {}),
      attribution: config.portal.attribution ?? { mode: "superbee" },
    });
    const artifact = await createPortalArtifact(snapshot, config.portal, { presentation: contribution });
    const portalReceipt = authority ? await writePortalArtifact(artifact, authority) : undefined;

    await contribution.close();
    contribution = undefined;
    await snapshot.close();
    snapshotClosed = true;

    const mkdocs = await materializeMkDocsDocumentationV1({
      projection,
      config: {
        schema: MKDOCS_DOCUMENTATION_CONFIG_V1,
        siteUrl: config.documentation.siteUrl,
      },
      output: path.resolve(mkdocsOutput),
    });
    const result = {
      schema: DOCUMENTATION_OUTPUTS_RESULT_V1,
      ok: true,
      snapshotDigest: projection.manifest.snapshotDigest,
      projectionDigest: projection.manifest.projectionDigest,
      selectedDocuments: projection.manifest.selectedDocuments.length,
      navigatedDocuments: projection.manifest.navigation.reduce((total, section) => total + section.documents.length, 0),
      supportingDocuments: projection.manifest.supportingDocuments.length,
      relationships: projection.manifest.relationships.length,
      diagrams: projection.manifest.assets.diagrams.map((row) => ({ id: row.id, digest: row.object.digest })),
      ...(projection.manifest.assets.brandMark ? { brandDigest: projection.manifest.assets.brandMark.object.digest } : {}),
      portal: {
        artifactDigest: artifact.manifest.artifactDigest,
        snapshotDigest: artifact.manifest.snapshotDigest,
        files: artifact.files.size,
        ...(portalReceipt ? { output: portalReceipt.output } : {}),
      },
      mkdocs: {
        output: mkdocs.output,
        projectionDigest: mkdocs.manifest.projectionDigest,
        materializationDigest: mkdocs.manifest.materializationDigest,
        documents: mkdocs.manifest.documents.length,
        diagrams: mkdocs.manifest.diagrams.map((row) => ({ id: row.id, digest: row.sourceDigest })),
        ...(mkdocs.manifest.brandMark ? { brandDigest: mkdocs.manifest.brandMark.sourceDigest } : {}),
      },
    };
    return { result, artifact, projectionManifest: projection.manifest, mkdocsManifest: mkdocs.manifest };
  } finally {
    try {
      if (contribution) await contribution.close();
    } finally {
      try {
        if (!snapshotClosed) await snapshot.close();
      } finally {
        if (projection) await projection.close();
      }
    }
  }
}

async function run(command, options = {}) {
  if (!new Set(["check", "build", "preview"]).has(command)) {
    throw new Error("usage: node scripts/documentation-outputs.mjs <check|build|preview> [--port <number>]");
  }
  let temporary;
  const mkdocsOutput = command === "check"
    ? (temporary = await mkdtemp(path.join(tmpdir(), "superbee-docs-dual-check-")))
    : path.resolve(".tmp/mkdocs");
  try {
    const composed = await composeDocumentationOutputs({
      root: ".",
      configFile: "portal.config.json",
      mkdocsOutput,
      writePortal: command !== "check",
    });
    if (command !== "preview") {
      console.log(JSON.stringify({ command: `documentation ${command}`, ...composed.result }));
      return;
    }
    const preview = await startPortalPreview(composed.result.portal.output, { port: options.port });
    console.log(JSON.stringify({ command: "documentation preview", ...composed.result, preview: { url: preview.url, loopback: true } }));
    await new Promise((resolve) => {
      const stop = () => void preview.close().finally(resolve);
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let port;
  const args = process.argv.slice(3);
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--port" || !Number.isSafeInteger(Number(args[1]))) {
      throw new Error("preview accepts only --port <number>");
    }
    port = Number(args[1]);
  }
  await run(process.argv[2], { port });
}
