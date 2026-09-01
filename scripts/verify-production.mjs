/*
 * Add Superbee Docs presentation assertions to Portal's host-neutral deployment verifier.
 *
 * Portal owns status, byte, media type, response-header, audience, negotiation, fallback, and
 * canonical-route verification. This adapter owns only the facts its documentation projection adds
 * to reader pages, plus the two intentionally site-specific entry redirects. Every request remains
 * a read-only GET through Portal's origin-confined probe.
 */

import path from "node:path";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { verifyPortalDeploymentV1 } from "@superbee/portal";

import { DEPLOYMENT_REDIRECTS } from "./deployment-assets.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
export const DOCUMENTATION_NOT_FOUND_PROBE_ROUTE = "/docs/superbee-portal-verify/unknown-route/";

function attribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "iu"))?.slice(1).find((value) => value !== undefined) ?? null;
}

function tagWith(html, tagName, attributes) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "giu")) ?? [];
  return tags.find((tag) => Object.entries(attributes).every(([name, expected]) => attribute(tag, name) === expected)) ?? null;
}

function extension(id, route, passed, fields, reason) {
  return {
    id,
    kind: "extension",
    route,
    outcome: passed ? "pass" : "fail",
    fields,
    ...(passed || reason === undefined ? {} : { reason }),
  };
}

function publishedArtifact(url, baseUrl, publishedOrigin, context) {
  let resolved;
  try { resolved = new URL(url, baseUrl); } catch { return null; }
  if (resolved.origin !== publishedOrigin || resolved.search || resolved.hash) return null;
  let relative;
  try { relative = decodeURIComponent(resolved.pathname.replace(/^\//u, "")); } catch { return null; }
  const declared = context.declared(relative);
  return declared ? { route: resolved.pathname, relative, declared } : null;
}

/** Documentation-only receipt rows supplied through Portal's public extension boundary. */
export async function documentationVerificationExtensionV1(context, siteUrl) {
  const published = new URL(siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
  const rows = [];
  const pages = context.routes.filter(({ route, disposition }) => (
    disposition === "shell" && route !== "/404" && (route === "/" || route.startsWith("/docs/"))
  ));

  for (const page of pages) {
    const observed = await context.probe(page.route);
    let html = "";
    try { html = decoder.decode(observed.bytes); } catch { /* The presentation row reports invalid UTF-8 below. */ }
    const pageFile = context.declared(page.artifactPath);
    const rootFile = context.declared("index.html");
    const canonicalRoute = page.route !== "/" && pageFile?.digest === rootFile?.digest ? "/" : page.route;
    const pageUrl = new URL(canonicalRoute, published).href;
    const canonical = tagWith(html, "link", { rel: "canonical", href: pageUrl });
    const alternate = tagWith(html, "link", { rel: "alternate", type: "text/markdown" });
    const alternateHref = alternate ? attribute(alternate, "href") : null;
    const alternateArtifact = alternateHref ? publishedArtifact(alternateHref, pageUrl, published.origin, context) : null;
    const describedBy = tagWith(html, "link", { rel: "describedby", href: "/llms.txt" });
    const openGraph = tagWith(html, "meta", { property: "og:url", content: pageUrl });
    const twitter = tagWith(html, "meta", { name: "twitter:card", content: "summary" });
    const jsonLd = tagWith(html, "script", { type: "application/ld+json" });

    const facts = [
      ["canonical", canonical !== null, pageUrl, canonical === null ? null : attribute(canonical, "href")],
      ["markdownAlternate", alternateArtifact !== null, "same-origin inventoried Markdown", alternateHref],
      ["describedBy", describedBy !== null, "/llms.txt", describedBy === null ? null : attribute(describedBy, "href")],
      ["openGraph", openGraph !== null, pageUrl, openGraph === null ? null : attribute(openGraph, "content")],
      ["twitterCard", twitter !== null, "summary", twitter === null ? null : attribute(twitter, "content")],
      ["jsonLd", jsonLd !== null, "application/ld+json", jsonLd === null ? null : attribute(jsonLd, "type")],
    ];
    rows.push(extension(
      `documentation presentation ${page.route}`,
      page.route,
      observed.status === 200 && html !== "" && facts.every(([, passed]) => passed),
      [
        { field: "status", expected: "200", actual: String(observed.status) },
        ...facts.map(([field, , expected, actual]) => ({ field, expected, actual })),
      ],
      "the documentation page omitted or changed an advertised discovery or social metadata fact",
    ));

    if (alternateArtifact) {
      const markdown = await context.probe(alternateArtifact.route);
      const exact = markdown.status === 200
        && markdown.digest === alternateArtifact.declared.digest
        && markdown.bytes.byteLength === alternateArtifact.declared.size;
      rows.push(extension(
        `documentation Markdown alternate ${page.route}`,
        alternateArtifact.route,
        exact,
        [
          { field: "status", expected: "200", actual: String(markdown.status) },
          { field: "digest", expected: alternateArtifact.declared.digest, actual: markdown.digest },
          { field: "size", expected: String(alternateArtifact.declared.size), actual: String(markdown.bytes.byteLength) },
        ],
        "the page's advertised Markdown alternate did not serve its exact inventoried bytes",
      ));
    } else {
      rows.push(extension(
        `documentation Markdown alternate ${page.route}`,
        page.route,
        false,
        [{ field: "href", expected: "same-origin inventoried Markdown", actual: alternateHref }],
        "the page advertised no safe inventoried Markdown alternate",
      ));
    }
  }

  /* `/docs` and `/docs/` are guessed site entry paths, not aliases of an artifact-owned HTML file. */
  for (const rule of DEPLOYMENT_REDIRECTS) {
    const observed = await context.probe(rule.from);
    const location = observed.headers.location ?? null;
    let destination = null;
    if (location !== null) {
      try { destination = new URL(location, new URL(rule.from, context.origin)).href; } catch { /* Report the raw value. */ }
    }
    const expected = new URL(rule.to, context.origin).href;
    rows.push(extension(
      `documentation entry redirect ${rule.from}`,
      rule.from,
      observed.status === rule.status && destination === expected,
      [
        { field: "status", expected: String(rule.status), actual: String(observed.status) },
        { field: "location", expected, actual: destination ?? location },
      ],
      "the site-specific documentation entry route did not redirect to the canonical root",
    ));
  }

  return rows;
}

export async function verifyDocumentationDeploymentV1({
  baseUrl,
  dist,
  siteUrl,
  unenforcedCapabilities = [],
  fetchImpl = fetch,
}) {
  return verifyPortalDeploymentV1({
    baseUrl,
    dist,
    fetchImpl,
    unenforcedCapabilities,
    notFound: { route: DOCUMENTATION_NOT_FOUND_PROBE_ROUTE },
    extend: (context) => documentationVerificationExtensionV1(context, siteUrl),
  });
}

async function main(argv) {
  const options = { baseUrl: "https://docs.getsuperbee.com", dist: "dist", unenforcedCapabilities: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--base" && value) options.baseUrl = value;
    else if (flag === "--dist" && value) options.dist = value;
    else if (flag === "--unenforced" && value) options.unenforcedCapabilities.push(value);
    else throw new Error("usage: node scripts/verify-production.mjs [--base <origin>] [--dist <directory>] [--unenforced <capability>]...");
  }
  const config = JSON.parse(await readFile("portal.config.json", "utf8"));
  const result = await verifyDocumentationDeploymentV1({ ...options, siteUrl: config.targets.portal.siteUrl });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
