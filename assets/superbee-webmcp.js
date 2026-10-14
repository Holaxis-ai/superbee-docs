/**
 * Activates the Superbee Docs WebMCP tools (version 2: forwarded to the site's own endpoint).
 *
 * This is the only file that decides the tools load at all. Portal publishes the fixed forwarder and
 * the build-emitted tool list and activates neither; a client site wires them together, which is this
 * file. Both enter the ordinary presentation contribution and therefore the Portal artifact digest,
 * so what a visitor executes is covered by the digest their publication advertises.
 *
 * Exactly one WebMCP version is active per page. This file registers version 2 and nothing else:
 * there is no version 0 or 1 activation anywhere on the site, because the two sets do not see each
 * other and both would register.
 *
 * Registration makes no request. Each tool call is one same-origin POST to the endpoint
 * (`/mcp`, served by the Worker), with the input in the body and never in a URL. A browser without
 * WebMCP loads the two small modules, registers nothing and answers `unsupported`.
 *
 * Both modules are imported dynamically inside `activate`, deliberately: a static import is
 * evaluated before this module's own body runs, which would put a fetch, parse or evaluation
 * failure outside the reach of the catch below.
 */

async function activate() {
  const [{ activatePortalWebMcpV2 }, { default: config }] = await Promise.all([
    import("/assets/portal-webmcp-v2.js"),
    import("/assets/portal-webmcp-v2-tools.js"),
  ]);
  activatePortalWebMcpV2(config);
}

activate().catch((error) => {
  // The tools are an enhancement to a site that is already complete without them: every page
  // renders, navigates and serves its Markdown alternate with no JavaScript at all. A failure here
  // must therefore leave the page exactly as it was, so it is reported and never rethrown.
  console.warn("Superbee documentation agent tools did not activate:", error);
});
