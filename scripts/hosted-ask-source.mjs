// hosted-ask-source: keep this site's exact Portal artifact in hosted as Ask Superbee's source.
//
//   node scripts/hosted-workload-token.mjs exec -- node scripts/hosted-ask-source.mjs publish --artifact dist
//
// Ask Superbee is answered by hosted (board design one-ask-public-mode). Hosted reads the site's
// published artifact from its own store, by digest, never from docs.getsuperbee.com, so every
// production deploy also publishes the same artifact to hosted through the site publish routes
// (superbee-hosted docs/hosted-sites.md): `site-release-begin` with the manifest's exact bytes,
// `site-object` for each digest hosted reports missing, then `site-release-complete`. A public
// artifact is never activated: complete makes it the site's Ask source. Every step is idempotent: a
// re-publish of the same artifact is the same release.
//
// The bearer (SUPERBEE_ACCESS_TOKEN, from hosted-workload-token) is sent only to GATEWAY, with
// redirects refused. exit: 0 published; 2 usage or artifact; 3 hosted refused or failed.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { GATEWAY } from "./hosted-workload-token.mjs";

export const ASK_SOURCE_SITE = "superbee-docs";
const MANIFEST = "data/portal-manifest.json";
const BEARER = /^sbw_[A-Za-z0-9_-]{20,200}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const PARALLEL = 4;

const fail = (message, exit = 3) => { throw Object.assign(new Error(message), { exit }); };
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** The artifact's manifest and a reader of its files by digest, each checked against the manifest. */
export async function readArtifact(directory) {
  const manifestBytes = await readFile(path.join(directory, MANIFEST)).catch(() => fail(`no ${MANIFEST} in ${directory}`, 2));
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString("utf8")); } catch { fail(`${MANIFEST} is not JSON`, 2); }
  if (manifest?.audience !== "public" || !DIGEST.test(manifest.artifactDigest ?? "") || !Array.isArray(manifest.files))
    fail(`${MANIFEST} is not a public Portal artifact manifest`, 2);
  const byDigest = new Map();
  for (const file of manifest.files) {
    if (typeof file?.path !== "string" || !DIGEST.test(file.digest ?? "") || file.path.split("/").includes(".."))
      fail("the manifest lists an invalid file", 2);
    if (!byDigest.has(file.digest)) byDigest.set(file.digest, file.path);
  }
  return {
    manifest: manifestBytes,
    artifactDigest: manifest.artifactDigest,
    async object(digest) {
      const relative = byDigest.get(digest);
      if (!relative) fail(`hosted asked for ${digest}, which the manifest does not list`);
      const bytes = await readFile(path.join(directory, relative));
      if (sha256(bytes) !== digest) fail(`${relative} does not match its manifest digest`, 2);
      return bytes;
    },
  };
}

/** One `/sync/v1` site route with the run's bearer: the parsed answer, or a failure naming its code. */
function caller(bearer, request = fetch) {
  return async (route, body, headers, timeoutMs = 60_000) => {
    let response;
    try {
      response = await request(`${GATEWAY}/sync/v1/${route}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json", ...headers },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      fail(`${route}: no answer from hosted`);
    }
    const text = await response.text();
    if (text.length > 64 * 1024) fail(`${route}: an answer larger than 64 KiB`);
    let value = null;
    try { value = JSON.parse(text); } catch {}
    if (!response.ok) {
      const code = typeof value?.error === "string" ? value.error : typeof value?.refused === "string" ? value.refused : "unknown";
      fail(`${route}: ${response.status} ${/^[a-z0-9_]{1,64}$/.test(code) ? code : "unknown"}`);
    }
    return value ?? fail(`${route}: an answer that is not JSON`);
  };
}

/** Publishes the artifact as the site's Ask source: begin, the missing objects, complete. */
export async function publishAskSource({ artifact, bearer, codeCommit, request = fetch, log = console.log }) {
  if (!BEARER.test(bearer ?? "")) fail("SUPERBEE_ACCESS_TOKEN is not a workload bearer (run under hosted-workload-token)", 2);
  const call = caller(bearer, request);
  const begun = await call("site-release-begin", artifact.manifest, {
    "Content-Type": "application/json",
    "X-Superbee-Site": ASK_SOURCE_SITE,
    ...(codeCommit && /^[0-9a-f]{40}$/.test(codeCommit) ? { "X-Superbee-Code-Commit": codeCommit } : {}),
  });
  if (begun.artifactDigest !== artifact.artifactDigest || typeof begun.releaseId !== "string")
    fail("site-release-begin answered another artifact");
  const missing = Array.isArray(begun.missing) ? [...begun.missing] : [];
  const upload = async () => {
    for (let digest = missing.shift(); digest !== undefined; digest = missing.shift()) {
      const bytes = await artifact.object(digest);
      await call("site-object", bytes, {
        "Content-Type": "application/octet-stream",
        "X-Superbee-Site": ASK_SOURCE_SITE,
        "X-Superbee-Release": begun.releaseId,
        "X-Superbee-Object-Digest": digest,
      });
    }
  };
  const uploads = Math.min(PARALLEL, missing.length);
  const count = missing.length;
  await Promise.all(Array.from({ length: uploads }, upload));
  const completed = await call(
    "site-release-complete",
    JSON.stringify({ site: ASK_SOURCE_SITE, releaseId: begun.releaseId }),
    { "Content-Type": "application/json" },
    120_000,
  );
  if (completed.state !== "complete") fail("site-release-complete did not complete the release");
  log(`Ask source: ${artifact.artifactDigest} as release ${begun.releaseId} (${count} objects uploaded)`);
  return { releaseId: begun.releaseId, uploaded: count };
}

async function main(argv) {
  const [command, flag, directory] = argv;
  if (command !== "publish" || flag !== "--artifact" || !directory) fail("usage: hosted-ask-source.mjs publish --artifact <dir>", 2);
  const artifact = await readArtifact(path.resolve(directory));
  if (process.env.SUPERBEE_HOST !== GATEWAY) fail(`SUPERBEE_HOST must be ${GATEWAY}`, 2);
  await publishAskSource({ artifact, bearer: process.env.SUPERBEE_ACCESS_TOKEN, codeCommit: process.env.GITHUB_SHA });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(`hosted-ask-source: ${error.message}`);
    process.exit(error.exit ?? 3);
  });
