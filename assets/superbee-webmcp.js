/**
 * Activates the Portal WebMCP tools on Superbee Docs.
 *
 * This is the only file that decides the tools load at all. Portal publishes the two fixed browser
 * assets it imports below and neither discovers nor activates the other; a client site wires them
 * together, which is this file. All three enter the ordinary presentation contribution and
 * therefore the Portal artifact digest, so what a visitor executes is covered by the digest their
 * publication advertises.
 *
 * Origin injection only. The bytes are published with the site rather than injected by a host or
 * an edge worker, so there is exactly one activation point and nothing to keep in step.
 */
import { loadValidatedPortalPublicationV2 } from "/assets/portal-client-v2.js";
import {
  createPortalWebMcpToolsV0,
  registerPortalWebMcpV0,
  resolveWebMcpHost,
} from "/assets/portal-webmcp-v0.js";

/** Binds every emitted presentation URL to this site's route shape. */
const PRESENTATION_URL_POLICY_ID = "superbee-docs/routes/v1";

/**
 * Emits a page URL for exactly the documents that have a page, and nothing for the rest.
 *
 * The naive resolver - map every document id to `/docs/<id>/` - is wrong here, because the read
 * model carries the complete public bundle and is strictly larger than the set rendered as pages:
 * 94 documents against 52 pages, so it would 404 on 42 of them. A confident wrong link is worse
 * than no link, since an agent would follow it instead of using `rawPath`.
 *
 * The artifact manifest settles which is which. It is the build's own inventory of published
 * files, it arrives with the publication in the same load so consulting it costs no extra request,
 * and it is covered by the artifact digest - so it cannot drift from what is actually deployed.
 */
function presentationUrlResolverFor(publication) {
  const published = new Set(publication.manifest.files.map((file) => file.path));
  return ({ kind, id }) => {
    // This site publishes no page for a View, and the tools already report a View's raw entry
    // identity, so inventing a route for one would be a claim the site cannot keep.
    if (kind !== "document") return undefined;
    const route = `docs/${id.split("/").map(encodeURIComponent).join("/")}/`;
    return published.has(`${route}index.html`) ? `/${route}` : undefined;
  };
}

async function activate() {
  // Resolve the host before fetching the PUBLICATION. That is the expensive part: the read model
  // is close to a megabyte, and a browser with no WebMCP surface would download all of it and use
  // none of it. The two module imports above are static, so their bytes (~100 KB uncompressed) do
  // load unconditionally - deferring the tools asset is not possible without duplicating
  // `resolveWebMcpHost` here, and a second copy of that predicate is worse than the bytes.
  //
  // Using the package's own exported predicate rather than a check written here keeps the
  // subtlety it already encodes: a present-but-unusable document surface reports unsupported
  // rather than quietly falling back to the deprecated navigator one.
  if (!resolveWebMcpHost()) return;

  const publication = await loadValidatedPortalPublicationV2();
  const toolSet = createPortalWebMcpToolsV0({
    publication,
    presentationUrlFor: presentationUrlResolverFor(publication),
    presentationUrlPolicyId: PRESENTATION_URL_POLICY_ID,
  });
  await registerPortalWebMcpV0({
    owner: "superbee-docs-presentation",
    activation: "presentation",
    toolSet,
  });
}

activate().catch((error) => {
  // The tools are an enhancement to a site that is already complete without them: every page
  // renders, navigates and serves its Markdown alternate with no JavaScript at all. A failure here
  // must therefore leave the page exactly as it was, so it is reported and never rethrown.
  console.warn("Superbee documentation agent tools did not activate:", error);
});
