/*
 * The one place the agent endpoint's binding names and rate limit are written down. The Worker
 * (scripts/cloudflare-worker.mjs) reads it, and test/agent-access.test.mjs checks wrangler.jsonc
 * against it, so the Worker and the Wrangler binding cannot drift apart unnoticed.
 */
export const AGENT_RATE_LIMIT_BINDING = "AGENT_LIMITER";
export const AGENT_SECRET_BINDING = "AGENT_IP_HASH_SECRET";
export const AGENT_RATE_LIMIT = Object.freeze({ requests: 60, seconds: 60 });
