import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  compileCodebaseDocumentationV0,
  createCodebaseDocumentationRecipeArtifactV0,
  createCodebaseDocumentationSolutionDescriptorV0,
} from "@superbee/recipe-studio/codebase-documentation/v0";
import { readPortalWebMcpBrowserAssetV0 } from "@superbee/portal-webmcp/asset/v0";
import { readPortalClientBrowserAssetV2 } from "@superbee/portal/client/v2/asset";
import { checkPublishedAgreement } from "@superbee/docs-tooling";
import { deriveGitDocumentationFreshnessV1 } from "@superbee/docs-tooling/freshness/v1";
import {
  composeDocumentationSiteV3,
  readDocumentationSiteConfigV3,
  startDocumentationSitePreviewV3,
} from "@superbee/docs-tooling/site";
import {
  authorizePortalWrite,
} from "@superbee/portal";

import { validateDocumentationGuidance } from "./documentation-guidance.mjs";
import { assertSnapshotReleaseVersionLabel } from "./release-version-label.mjs";

export const DOCUMENTATION_OUTPUTS_RESULT_V1 =
  "https://getsuperbee.com/schemas/superbee-docs/documentation-outputs-result/v1";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

async function json(file, subject) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) { throw new Error(`${subject} must be readable JSON`, { cause: error }); }
}

/**
 * The four files that make the documentation agent-callable, contributed to this site's own
 * presentation so their bytes enter the Portal artifact digest like any other published file.
 *
 * Only the bootstrap is linked from pages. The other three are published because the bootstrap
 * imports them by URL, and linking them separately would run library code that registers nothing.
 * Ordering is irrelevant for the same reason: the module graph decides load order, not the page.
 */
async function agentToolAssets() {
  const [client, tools, routes, bootstrap] = await Promise.all([
    readPortalClientBrowserAssetV2(),
    readPortalWebMcpBrowserAssetV0(),
    readFile(new URL("../assets/superbee-webmcp-routes.js", import.meta.url)),
    readFile(new URL("../assets/superbee-webmcp.js", import.meta.url)),
  ]);
  return [
    { path: client.path, bytes: client.bytes },
    { path: tools.path, bytes: tools.bytes },
    { path: "assets/superbee-webmcp-routes.js", bytes: new Uint8Array(routes) },
    { path: "assets/superbee-webmcp.js", bytes: new Uint8Array(bootstrap), loadAsModule: true },
  ];
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

async function projectionOverlay({ root, config, snapshot, diagramAgreement, freshness = [] }) {
  const diagramManifest = await json(config.diagrams.manifest, "static diagram manifest");
  const diagrams = exactDiagramRows(diagramManifest, diagramAgreement.bindings);
  let brandMark;
  if (config.documentation.brandMark) {
    const blob = snapshot.manifest.blobs.find((row) => row.key === config.documentation.brandMark.blob);
    if (!blob) throw new Error(`brand blob '${config.documentation.brandMark.blob}' is absent from the publication snapshot`);
    brandMark = { blob: blob.key, digest: blob.object.digest };
  }
  return {
    ...(freshness.length ? { freshness } : {}),
    ...(brandMark ? { brandMark } : {}),
    diagrams,
  };
}

async function documentationCompositionOptions({
  root = ".",
  configFile = "portal.config.json",
  mkdocsOutput,
  writePortal = false,
} = {}) {
  const realRoot = await realpath(path.resolve(root));
  const config = await readDocumentationSiteConfigV3(path.resolve(realRoot, configFile));
  if (!config.diagrams) throw new Error("dual documentation outputs require verified static diagram configuration");
  const authority = writePortal ? await authorizePortalWrite(config.bundle, config.output) : undefined;
  return {
    config,
    sourceDirectory: authority?.sourceDirectory ?? config.bundle,
    mkdocsOutput: path.resolve(mkdocsOutput),
    ...(authority ? { portalAuthority: authority } : {}),
    compileProjection: async ({ snapshot }) => {
      const [guidance, diagramAgreement, runtimePackage, portalAssets] = await Promise.all([
        validateDocumentationGuidance(config.documentation, realRoot),
        checkPublishedAgreement({ root: realRoot, configPath: config.file }),
        json(new URL("../node_modules/superbee/package.json", import.meta.url), "Superbee runtime package"),
        agentToolAssets(),
      ]);
      const recipeArtifact = createCodebaseDocumentationRecipeArtifactV0();
      try {
        const solution = createCodebaseDocumentationSolutionDescriptorV0(recipeArtifact);
        const overlay = await projectionOverlay({ root: realRoot, config, snapshot, diagramAgreement });
        const provisional = await compileCodebaseDocumentationV0({
          snapshot,
          recipeArtifact,
          solution,
          recipeRuntimeVersion: runtimePackage.version,
          publicationId: config.documentation.publicationId,
          overlay,
        });
        let freshness;
        try {
          assertSnapshotReleaseVersionLabel(provisional.config, snapshot);
          freshness = await deriveGitDocumentationFreshnessV1({
            root: realRoot,
            bundle: config.bundle,
            snapshot,
            documentIds: [
              ...provisional.config.navigation.flatMap((section) => section.documents),
              ...provisional.config.supportingDocuments,
            ],
          });
        } finally {
          await provisional.projection.close();
        }
        const compiled = await compileCodebaseDocumentationV0({
          snapshot,
          recipeArtifact,
          solution,
          recipeRuntimeVersion: runtimePackage.version,
          publicationId: config.documentation.publicationId,
          overlay: { ...overlay, ...(freshness.length ? { freshness } : {}) },
        });
        return {
          projection: compiled.projection,
          portalAssets,
          metadata: { guidance, compilation: compiled.receipt },
        };
      } finally {
        await recipeArtifact.close();
      }
    },
  };
}

function documentationOutputsResult(composition) {
  const {
    artifact,
    portalReceipt,
    projectionManifest,
    mkdocsManifest,
    mkdocsOutput,
    metadata,
  } = composition;
  const result = {
    schema: DOCUMENTATION_OUTPUTS_RESULT_V1,
    ok: true,
    snapshotDigest: projectionManifest.snapshotDigest,
    projectionDigest: projectionManifest.projectionDigest,
    selectedDocuments: projectionManifest.selectedDocuments.length,
    navigatedDocuments: projectionManifest.navigation.reduce((total, section) => total + section.documents.length, 0),
    supportingDocuments: projectionManifest.supportingDocuments.length,
    ...(metadata?.guidance
      ? { agentGuidance: { documentId: metadata.guidance.documentId, heading: metadata.guidance.heading } }
      : {}),
    relationships: projectionManifest.relationships.length,
    diagrams: projectionManifest.assets.diagrams.map((row) => ({ id: row.id, digest: row.object.digest })),
    ...(projectionManifest.assets.brandMark ? { brandDigest: projectionManifest.assets.brandMark.object.digest } : {}),
    portal: {
      artifactDigest: artifact.manifest.artifactDigest,
      snapshotDigest: artifact.manifest.snapshotDigest,
      files: artifact.files.size,
      ...(portalReceipt ? { output: portalReceipt.output } : {}),
    },
    mkdocs: {
      output: mkdocsOutput,
      projectionDigest: mkdocsManifest.projectionDigest,
      materializationDigest: mkdocsManifest.materializationDigest,
      documents: mkdocsManifest.documents.length,
      diagrams: mkdocsManifest.diagrams.map((row) => ({ id: row.id, digest: row.sourceDigest })),
      ...(mkdocsManifest.brandMark ? { brandDigest: mkdocsManifest.brandMark.sourceDigest } : {}),
    },
  };
  return { result, artifact, projectionManifest, mkdocsManifest };
}

/** Compose both outputs through the package-owned one-snapshot, one-projection lifecycle. */
export async function composeDocumentationOutputs(options = {}) {
  const composition = await composeDocumentationSiteV3(await documentationCompositionOptions(options));
  return documentationOutputsResult(composition);
}

export async function startDocumentationOutputsPreview(options = {}, previewOptions = {}) {
  const preview = await startDocumentationSitePreviewV3(
    await documentationCompositionOptions({ ...options, writePortal: true }),
    previewOptions,
  );
  return {
    ...documentationOutputsResult(preview.composition),
    preview: preview.result,
    close: preview.close,
  };
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
    const input = { root: ".", configFile: "portal.config.json", mkdocsOutput };
    const composed = command === "preview"
      ? await startDocumentationOutputsPreview(input, { port: options.port })
      : await composeDocumentationOutputs({ ...input, writePortal: command === "build" });
    if (command !== "preview") {
      console.log(JSON.stringify({ command: `documentation ${command}`, ...composed.result }));
      return;
    }
    console.log(JSON.stringify({ command: "documentation preview", ...composed.result, preview: composed.preview }));
    await new Promise((resolve) => {
      const stop = () => void composed.close().finally(resolve);
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
