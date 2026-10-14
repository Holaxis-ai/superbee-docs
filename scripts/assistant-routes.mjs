import {
  createPortalArtifact,
} from "@superbee/portal";
import {
  createPortalAssistantRoutesV1,
  portalAssistantDocumentationPolicyV1,
  portalAssistantRouteBytesV1,
  PORTAL_ASSISTANT_ROUTES_PATH_V1,
} from "@superbee/portal/assistant-publication/v1";
import { loadValidatedPortalPublicationV2 } from "@superbee/portal/client/v2";
import { createDocumentationPresentationContributionFromProjectionV1 } from "@superbee/portal-docs";

const HOSTING_PATH = "data/hosting-requirements.json";
const DOCS_PREFIX = "/docs/";

/**
 * Page links for agent answers.
 *
 * `@superbee/portal-cloudflare`'s agent endpoint adds a `url` to an answer only for documents listed
 * in `assets/assistant-routes.json`, Portal's digest-checked route inventory. The inventory has to
 * list the pages this build renders and nothing else: the publication carries the whole public bundle,
 * which is larger than the set of rendered pages, and a guessed `/docs/<id>/` would 404 for the rest.
 *
 * The rendered pages are read from the artifact's own hosting requirements (the HTML shell routes the
 * host will serve). A provisional artifact is built from the same snapshot, projection and assets,
 * because the routes file must itself be a published file that enters the digest of the final one.
 * It sits under `assets/`, so adding it cannot change which pages exist.
 */
export function documentRouteRowsV1(hostingRequirements, publication) {
  const rows = [];
  const files = new Map(publication.manifest.files.map((file) => [file.path, file]));
  for (const route of hostingRequirements.routes) {
    // The same filter Portal applies when it checks each row against the declared shells.
    if (route.disposition !== "shell" || route.methods.join(",") !== "GET,HEAD" || route.pattern.includes("*")) continue;
    if (!route.pattern.startsWith(DOCS_PREFIX) || !route.pattern.endsWith("/")) continue;
    let id;
    try { id = decodeURIComponent(route.pattern.slice(DOCS_PREFIX.length, -1)); }
    catch { continue; }
    const target = files.get(route.artifactPath ?? `${decodeURIComponent(route.pattern.slice(1))}index.html`);
    if (target?.mediaType !== "text/html; charset=utf-8") continue;
    // A shell that is not a bundle document (a section index, say) gets no row.
    if (!id || !publication.getDocument(id)) continue;
    rows.push({ id, path: route.pattern });
  }
  return rows;
}

export async function assistantRoutesAssetV1({ snapshot, projection, config, portalAssets }) {
  const contribution = await createDocumentationPresentationContributionFromProjectionV1(
    projection,
    config.targets.portal,
    { assets: portalAssets },
  );
  let artifact;
  try { artifact = await createPortalArtifact(snapshot, config.portal, { presentation: contribution }); }
  finally { await contribution.close(); }
  const publication = await loadValidatedPortalPublicationV2({
    fetch: async (requested) => {
      const bytes = artifact.files.get(String(requested).replace(/^\//u, ""));
      return new Response(bytes, { status: bytes ? 200 : 404 });
    },
  });
  const hostingRequirementsBytes = artifact.files.get(HOSTING_PATH);
  const documents = documentRouteRowsV1(JSON.parse(new TextDecoder().decode(hostingRequirementsBytes)), publication);
  const routes = await createPortalAssistantRoutesV1({
    publication,
    hostingRequirementsBytes,
    documents,
    views: [],
    policy: portalAssistantDocumentationPolicyV1,
  });
  return { path: PORTAL_ASSISTANT_ROUTES_PATH_V1, bytes: portalAssistantRouteBytesV1(routes) };
}
