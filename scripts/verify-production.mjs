/*
 * Mechanical post-deploy comparison between one built artifact and one live origin.
 *
 * Every check compares the deployed response against the exact bytes this repository built, or
 * against the exact route configuration it declares, so a pass means "the origin serves what we
 * published", not "the origin looks healthy". The script is read-only: GET only, no mutation of
 * anything local or remote.
 *
 * Media type is reported, not gated. This site deploys as Cloudflare static assets with no Worker,
 * so the edge derives Content-Type from the file extension rather than from the artifact's declared
 * inventory. That drift is real and pre-existing; it is surfaced as `mediaTypeDrift` so a reviewer
 * sees it, and it is deliberately not conflated with a byte or status regression.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { DEPLOYMENT_REDIRECTS } from "./deployment-assets.mjs";

export const DOCUMENTATION_DEPLOYMENT_VERIFICATION_V1 =
  "https://getsuperbee.com/schemas/superbee-docs/deployment-verification/v1";

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const mediaTypeOf = (value) => (value ?? "").split(";")[0].trim().toLowerCase();

async function probe(fetchImpl, url, headers = {}) {
  const response = await fetchImpl(url, { method: "GET", headers, redirect: "manual" });
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    location: response.headers.get("location"),
    vary: response.headers.get("vary"),
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}

function record(rows, row, expectations, observed) {
  const failures = [];
  for (const [field, expected] of Object.entries(expectations)) {
    const actual = observed[field];
    if (expected instanceof RegExp ? !expected.test(actual ?? "") : actual !== expected) {
      failures.push({ field, expected: String(expected), actual: actual === undefined ? null : actual });
    }
  }
  rows.push({ ...row, ok: failures.length === 0, ...(failures.length ? { failures } : {}) });
  return failures.length === 0;
}

/**
 * Compare one live origin against the exact artifact directory this repository built.
 *
 * @param {{ baseUrl: string, dist: string, fetchImpl?: typeof fetch }} options
 */
export async function verifyDocumentationDeploymentV1({ baseUrl, dist, fetchImpl = fetch }) {
  const origin = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const local = async (relative) => new Uint8Array(await readFile(path.join(dist, ...relative.split("/"))));
  const at = (relative) => new URL(relative, origin).href;
  const rows = [];
  const mediaTypeDrift = [];

  const manifest = JSON.parse(new TextDecoder().decode(await local("data/portal-manifest.json")));
  const declared = new Map(manifest.files.map((file) => [file.path, mediaTypeOf(file.mediaType)]));

  const compare = async (name, relative, url, observed, extra = {}, expectedStatus = 200) => {
    const expected = await local(relative);
    const observedMediaType = mediaTypeOf(observed.contentType);
    const declaredMediaType = declared.get(relative);
    /*
     * Only a response that actually reached its expected status with a Content-Type of its own can
     * drift. An unexpected status carries whatever type that error path used, and a bodyless
     * response carries none at all; reporting either as media-type drift would bury the real
     * regression the digest check already names under a second, invented one.
     */
    if (declaredMediaType && observedMediaType && observed.status === expectedStatus
      && declaredMediaType !== observedMediaType) {
      mediaTypeDrift.push({ path: `/${relative}`, declared: declaredMediaType, observed: observedMediaType });
    }
    return record(rows, {
      name,
      url,
      status: observed.status,
      declaredMediaType: declaredMediaType ?? null,
      observedMediaType: observedMediaType || null,
    }, {
      status: expectedStatus,
      digest: sha256(expected),
      ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, value.expected])),
    }, {
      status: observed.status,
      digest: sha256(observed.bytes),
      ...Object.fromEntries(Object.entries(extra).map(([key, value]) => [key, value.actual])),
    });
  };

  // 1. Every machine-readable artifact must be byte-identical to the build.
  for (const [name, relative] of [
    ["agent entry point", "llms.txt"],
    ["crawler policy", "robots.txt"],
    ["sitemap", "sitemap.xml"],
    ["recovery body (markdown)", "404.md"],
  ]) {
    await compare(name, relative, at(relative), await probe(fetchImpl, at(relative)));
  }

  // 2. The documentation index must still serve its exact bytes and its agent-facing head links.
  const home = await probe(fetchImpl, origin.href);
  const homeText = new TextDecoder().decode(home.bytes);
  await compare("documentation index", "index.html", origin.href, home, {
    canonical: { expected: true, actual: /<link rel="canonical" href="[^"]+">/.test(homeText) },
    markdownAlternate: { expected: true, actual: /<link rel="alternate" type="text\/markdown" href="[^"]+">/.test(homeText) },
    describedBy: { expected: true, actual: /<link rel="describedby" href="\/llms\.txt">/.test(homeText) },
    openGraph: { expected: true, actual: /<meta property="og:url" content="[^"]+">/.test(homeText) },
    twitterCard: { expected: true, actual: /<meta name="twitter:card" content="summary">/.test(homeText) },
    jsonLd: { expected: true, actual: /<script type="application\/ld\+json">/.test(homeText) },
  });

  // 3. An unknown route must return a real 404 carrying the published recovery bytes.
  const unknownPath = "superbee-deployment-verification/unknown-route";
  await compare("unknown route recovery", "404.html", at(unknownPath), await probe(fetchImpl, at(unknownPath)), {}, 404);

  // 4. The Markdown alternate a page advertises must resolve to that page's exact source bytes.
  const alternate = homeText.match(/<link rel="alternate" type="text\/markdown" href="([^"]+)">/)?.[1];
  if (alternate) {
    const relative = alternate.replace(/^\//, "");
    await compare("markdown alternate", relative, at(relative), await probe(fetchImpl, at(relative)));
  } else {
    rows.push({
      name: "markdown alternate", url: origin.href, status: home.status, ok: false,
      failures: [{ field: "href", expected: "a rel=alternate Markdown link", actual: null }],
    });
  }

  /*
   * 5. The Markdown access contract is explicit URLs, not content negotiation. Assert the absence
   * of Vary: Accept: advertising a negotiation this origin does not perform would fragment or
   * poison every shared cache in front of it while changing nothing an agent receives.
   */
  const negotiated = await probe(fetchImpl, origin.href, { Accept: "text/markdown" });
  record(rows, {
    name: "no unadvertised content negotiation",
    url: origin.href,
    status: negotiated.status,
    observedMediaType: mediaTypeOf(negotiated.contentType) || null,
  }, {
    status: 200,
    mediaType: "text/html",
    varyAcceptAbsent: true,
  }, {
    status: negotiated.status,
    mediaType: mediaTypeOf(negotiated.contentType),
    varyAcceptAbsent: !/\baccept\b/i.test(negotiated.vary ?? ""),
  });

  /*
   * 6. Every declared entry route must answer with the intentional redirect the deployment
   * configures, and with nothing wider. Check 3 above independently proves that an undeclared
   * missing path still reaches the real recovery body, so the two together separate a deliberate
   * redirect from a rule that quietly swallows unrelated missing routes.
   */
  for (const rule of DEPLOYMENT_REDIRECTS) {
    const url = at(rule.from.replace(/^\//, ""));
    const observed = await probe(fetchImpl, url);
    let destination = null;
    if (observed.location) {
      try { destination = new URL(observed.location, url).href; } catch { destination = observed.location; }
    }
    record(rows, {
      name: `entry redirect ${rule.from}`,
      url,
      status: observed.status,
      location: observed.location ?? null,
    }, {
      status: rule.status,
      destination: new URL(rule.to, origin).href,
    }, {
      status: observed.status,
      destination,
    });
  }

  const failed = rows.filter((row) => !row.ok);
  return {
    schema: DOCUMENTATION_DEPLOYMENT_VERIFICATION_V1,
    ok: failed.length === 0,
    origin: origin.href,
    artifactDigest: manifest.artifactDigest,
    checks: rows.length,
    failed: failed.length,
    mediaTypeDrift,
    results: rows,
  };
}

async function main(argv) {
  const options = { baseUrl: "https://docs.getsuperbee.com", dist: "dist" };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--base" && value) options.baseUrl = value;
    else if (flag === "--dist" && value) options.dist = value;
    else throw new Error("usage: node scripts/verify-production.mjs [--base <origin>] [--dist <directory>]");
  }
  const result = await verifyDocumentationDeploymentV1(options);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
