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

/*
 * No `presentationUrlFor` is supplied, deliberately.
 *
 * The obvious resolver - map a document id to `/docs/<id>/` - is wrong here. The published read
 * model carries the complete public bundle, which is strictly larger than the set rendered as
 * pages: measured on this site, 94 documents against 52 documentation pages. A resolver would
 * therefore emit a confident URL that 404s for nearly half of them, and the read model carries no
 * field marking which documents have a page, so the browser cannot tell them apart.
 *
 * A wrong link is worse than no link: an agent would follow it instead of using `rawPath`, which
 * every tool result already carries, which is always published, and which serves the document's
 * exact Markdown - more useful to an agent than its HTML rendering. `presentationUrl` is optional
 * in the tool contract precisely so a site that cannot answer this honestly can decline to.
 */

async function activate() {
  // Resolve the host BEFORE fetching anything. The read model is close to a megabyte, and a
  // browser with no WebMCP surface would download all of it and use none of it. This uses the
  // package's own
  // exported predicate rather than a second check here, which could drift from it - it already
  // encodes that a present-but-unusable document surface reports unsupported instead of quietly
  // falling back to the deprecated navigator one.
  if (!resolveWebMcpHost()) return;

  const publication = await loadValidatedPortalPublicationV2();
  const toolSet = createPortalWebMcpToolsV0({ publication });
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
