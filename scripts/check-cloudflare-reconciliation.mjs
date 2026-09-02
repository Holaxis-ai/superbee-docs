/* Verify the complete local activation unit without credentials or provider access. */

import { execFileSync } from "node:child_process";

import { inspectDocumentationCloudflareDesiredStateV1 } from "./reconcile-cloudflare.mjs";

const desired = await inspectDocumentationCloudflareDesiredStateV1({
  repository: process.env.GITHUB_REPOSITORY ?? "Holaxis-ai/superbee-docs",
  desiredCommit: process.env.GITHUB_SHA
    ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
});
console.log(JSON.stringify({ ok: true, desired }, null, 2));
