/*
 * Add the two Superbee Docs entry redirects to Portal's package-owned Cloudflare assembly.
 *
 * `dist` remains the immutable, inventory-exact Portal artifact. The Cloudflare package verifies
 * it, derives the host's headers and canonical 307 redirects from its hosting requirements, adds
 * only the two site-owned entry redirects below, and atomically assembles `deploy`.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import { assembleCloudflareStaticAssetsV1 } from "@superbee/portal-cloudflare/static-assets";

export const DEPLOYMENT_REDIRECTS = Object.freeze([
  Object.freeze({ from: "/docs", to: "/", status: 301 }),
  Object.freeze({ from: "/docs/", to: "/", status: 301 }),
]);

export async function assembleDocumentationDeploymentV1({
  artifactDirectory = "dist",
  outputDirectory = "deploy",
  assemble = assembleCloudflareStaticAssetsV1,
} = {}) {
  return assemble({
    artifactDirectory,
    outputDirectory,
    redirects: DEPLOYMENT_REDIRECTS,
    generator: "superbee-docs/scripts/deployment-assets.mjs",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await assembleDocumentationDeploymentV1(), null, 2));
}
