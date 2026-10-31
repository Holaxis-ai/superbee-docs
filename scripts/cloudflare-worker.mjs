/* The host-neutral runtime stays package-owned; this file only gives Wrangler a stable entry. */

import { createCloudflarePortalHandler, SuperbeeAssistant } from "@superbee/portal-cloudflare";

import { AGENT_RATE_LIMIT, AGENT_RATE_LIMIT_BINDING, AGENT_SECRET_BINDING } from "./agent-access-config.mjs";
import { ASSISTANT } from "./assistant-config.mjs";
import { HOSTED_ASK_BINDING, HOSTED_ASK_PREFIX } from "./hosted-ask-config.mjs";

export { SuperbeeAssistant };

/*
 * Remote agent access: a read-only MCP endpoint at /mcp and the same tools as a GET/POST API under
 * /api/v1, answered from the published artifact. Pages, styles and fonts stay asset-first. The
 * endpoint needs the Wrangler pieces in wrangler.jsonc (nodejs_compat, the AGENT_LIMITER rate-limit
 * binding, run_worker_first) and the AGENT_IP_HASH_SECRET Worker secret; without the binding it
 * switches itself off with one warning, so a missing piece never breaks a page.
 */
const portal = createCloudflarePortalHandler({
  agentAccess: {
    bundleId: "superbee-docs",
    server: {
      name: "superbee-docs",
      title: "Superbee Docs",
      version: "1.0.0",
      websiteUrl: "https://docs.getsuperbee.com",
    },
    rateLimitBinding: AGENT_RATE_LIMIT_BINDING,
    secretBinding: AGENT_SECRET_BINDING,
    rateLimit: AGENT_RATE_LIMIT,
  },
  assistant: ASSISTANT,
});

/*
 * Ask Superbee is answered by hosted (board design one-ask-public-mode): with the SUPERBEE_ASK
 * service binding, every assistant route goes to hosted's PublicSiteAsk entrypoint unchanged, so the
 * page, the panel and the visitor cookie stay same-origin. Without it the local assistant answers,
 * as before; it stays registered until its Durable Object class is deleted, so existing
 * conversations still expire on their own alarms.
 */
export default {
  fetch(request, env, ctx) {
    const hosted = env?.[HOSTED_ASK_BINDING];
    if (hosted && typeof hosted.fetch === "function" && new URL(request.url).pathname.startsWith(HOSTED_ASK_PREFIX))
      return hosted.fetch(request);
    return portal.fetch(request, env, ctx);
  },
};
