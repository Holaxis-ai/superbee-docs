/* The host-neutral runtime stays package-owned; this file only gives Wrangler a stable entry. */

import { createCloudflarePortalHandler } from "@superbee/portal-cloudflare";

/*
 * Remote agent access: a read-only MCP endpoint at /mcp and the same tools as a GET/POST API under
 * /api/v1, answered from the published artifact. Pages, styles and fonts stay asset-first. The
 * endpoint needs the Wrangler pieces in wrangler.jsonc (nodejs_compat, the AGENT_LIMITER rate-limit
 * binding, run_worker_first) and the AGENT_IP_HASH_SECRET Worker secret; without the binding it
 * switches itself off with one warning, so a missing piece never breaks a page.
 */
export default createCloudflarePortalHandler({
  agentAccess: {
    bundleId: "superbee-docs",
    server: {
      name: "superbee-docs",
      title: "Superbee Docs",
      version: "1.0.0",
      websiteUrl: "https://docs.getsuperbee.com",
    },
    rateLimitBinding: "AGENT_LIMITER",
    secretBinding: "AGENT_IP_HASH_SECRET",
    rateLimit: { requests: 60, seconds: 60 },
  },
});
