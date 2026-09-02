/* The host-neutral runtime stays package-owned; this file only gives Wrangler a stable entry. */

import { createCloudflarePortalHandler } from "@superbee/portal-cloudflare";

export default createCloudflarePortalHandler();
