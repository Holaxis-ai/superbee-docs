/**
 * Activates the Portal WebMCP tools on Superbee Docs.
 *
 * This is the only file that decides the tools load at all. Portal publishes the fixed browser
 * assets loaded below and neither discovers nor activates the other; a client site wires them
 * together, which is this file. All four enter the ordinary presentation contribution and
 * therefore the Portal artifact digest, so what a visitor executes is covered by the digest their
 * publication advertises.
 *
 * Origin injection only. The bytes are published with the site rather than injected by a host or
 * an edge worker, so there is exactly one activation point and nothing to keep in step.
 *
 * Every dependency is loaded dynamically inside `activate`, deliberately. A static import is
 * evaluated before this module's own body runs, which put two failures outside the reach of the
 * catch below: a fetch, parse, or evaluation failure in either fixed asset produced an unhandled
 * rejection and no warning at all. A browser with no WebMCP surface loads only the tools asset
 * needed for the support check; it does not load the Portal client, routes module, or read model.
 */

/** Binds every emitted presentation URL to this site's route shape. */
const PRESENTATION_URL_POLICY_ID = "superbee-docs/routes/v1";

async function activate() {
  // The tools module loads first because it owns the support predicate. Using the package's own
  // exported `resolveWebMcpHost` rather than a check written here keeps the subtlety it already
  // encodes: a present-but-unusable document surface reports unsupported rather than quietly
  // falling back to the deprecated navigator one.
  const { createPortalWebMcpToolsV0, registerPortalWebMcpV0, resolveWebMcpHost } =
    await import("/assets/portal-webmcp-v0.js");
  if (!resolveWebMcpHost()) return;

  // Only past the host check does the expensive part load: the read model is close to a megabyte,
  // and a browser that cannot use it should never pay for it.
  const [{ loadValidatedPortalPublicationV2 }, { presentationUrlResolverFor }] = await Promise.all([
    import("/assets/portal-client-v2.js"),
    import("/assets/superbee-webmcp-routes.js"),
  ]);

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
