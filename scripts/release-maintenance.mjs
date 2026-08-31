#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadDocumentationTriggerRecords, queryDocumentationImpact } from "./documentation-impact.mjs";

const SCHEMA = "https://getsuperbee.com/schemas/release-documentation-status/v1";
const STABLE_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const FULL_SHA = /^[0-9a-f]{40}$/u;

function fail(message) { throw new Error(message); }

function parseOptions(args) {
  const options = {
    root: path.resolve("."),
    registry: "https://registry.npmjs.org",
    githubApi: "https://api.github.com/repos/Holaxis-ai/superbee",
    githubToken: process.env.GITHUB_TOKEN,
    failOnUpdate: false,
  };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--fail-on-update") { options.failOnUpdate = true; continue; }
    if (!new Set(["--root", "--registry", "--github-api"]).has(flag)) fail(`unknown option: ${flag}`);
    const value = args[++index];
    if (!value) fail(`${flag} requires a value`);
    if (flag === "--root") options.root = path.resolve(value);
    if (flag === "--registry") options.registry = value.replace(/\/$/u, "");
    if (flag === "--github-api") options.githubApi = value.replace(/\/$/u, "");
  }
  return options;
}

function exactFrontmatterField(markdown, name) {
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/u)?.[1];
  if (!frontmatter) fail("releases/current is not a Superbee Markdown document");
  const matches = [...frontmatter.matchAll(new RegExp(`^${name}: ['\"]?([^'\"\\n]+)['\"]?$`, "gmu"))];
  if (matches.length !== 1) fail(`releases/current requires exactly one ${name} field`);
  return matches[0][1].trim();
}

function compareVersions(left, right) {
  if (!STABLE_VERSION.test(left) || !STABLE_VERSION.test(right)) fail("release status compares stable semantic versions only");
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if (leftParts[index] !== rightParts[index]) return Math.sign(leftParts[index] - rightParts[index]);
  }
  return 0;
}

async function json(url, token) {
  const headers = { accept: "application/json", "user-agent": "superbee-docs-release-maintenance" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) fail(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function taggedCommit(options, version) {
  const ref = await json(`${options.githubApi}/git/ref/tags/v${version}`, options.githubToken);
  let object = ref.object;
  if (object?.type === "tag") object = (await json(`${options.githubApi}/git/tags/${object.sha}`, options.githubToken)).object;
  if (object?.type !== "commit" || !FULL_SHA.test(object.sha ?? "")) fail(`v${version} does not resolve to one full commit SHA`);
  return object.sha;
}

function exactEvidenceValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [...markdown.matchAll(new RegExp("^\\| " + escaped + " \\| `([^`]+)` \\|$", "gmu"))];
  if (matches.length !== 1) fail(`current release evidence requires exactly one ${label} row`);
  return matches[0][1];
}

export async function releaseDocumentationStatus(options) {
  const currentMarkdown = await readFile(path.join(options.root, ".superbee", "releases", "current.md"), "utf8");
  const documentedVersion = exactFrontmatterField(currentMarkdown, "version");
  if (!STABLE_VERSION.test(documentedVersion)) fail("releases/current must identify a stable semantic version");

  const registry = await json(`${options.registry}/superbee/latest`);
  const registryVersion = String(registry.version ?? "");
  if (!STABLE_VERSION.test(registryVersion)) fail("npm latest does not identify a stable Superbee version");
  if (registry.name !== "superbee") fail("npm latest returned a different package");
  const comparison = compareVersions(registryVersion, documentedVersion);
  if (comparison < 0) fail(`npm latest ${registryVersion} is behind documented release ${documentedVersion}`);

  const release = await json(`${options.githubApi}/releases/tags/v${registryVersion}`, options.githubToken);
  if (release.tag_name !== `v${registryVersion}` || release.draft || release.prerelease) {
    fail(`GitHub v${registryVersion} is absent, draft, prerelease, or mismatched`);
  }
  const githubReleaseUrl = `https://github.com/Holaxis-ai/superbee/releases/tag/v${registryVersion}`;
  if (release.html_url !== githubReleaseUrl) fail(`GitHub release URL must equal ${githubReleaseUrl}`);
  const sourceCommit = await taggedCommit(options, registryVersion);
  const publishedAt = String(release.published_at ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(publishedAt)) fail("GitHub release lacks a publication date");
  const npmIntegrity = String(registry.dist?.integrity ?? "");
  const tarballUrl = String(registry.dist?.tarball ?? "");
  if (!/^sha512-[A-Za-z0-9+/=]+$/u.test(npmIntegrity)) fail("npm latest lacks a valid SHA-512 integrity");
  const expectedTarball = `${options.registry}/superbee/-/superbee-${registryVersion}.tgz`;
  if (tarballUrl !== expectedTarball) fail(`npm tarball URL must equal ${expectedTarball}`);

  const status = comparison === 0 ? "current" : "update_required";
  const documentedEvidence = await readFile(
    path.join(options.root, ".superbee", "sources", `superbee-release-${documentedVersion}.md`),
    "utf8",
  );
  const documentedSourceCommit = exactEvidenceValue(documentedEvidence, "source commit");
  if (!FULL_SHA.test(documentedSourceCommit)) fail("documented release evidence has an invalid source commit");
  if (status === "current") {
    if (exactEvidenceValue(documentedEvidence, "npm integrity") !== npmIntegrity) fail("documented npm integrity differs from npm latest");
    if (documentedSourceCommit !== sourceCommit) fail("documented source commit differs from the stable Git tag");
  }

  const impactEvents = status === "update_required"
    ? ["npm-latest", "stable-release-identity", "stable-release-verified"]
    : [];
  const triggerRecords = status === "update_required"
    ? (options.triggerRecords ?? await loadDocumentationTriggerRecords(options.root))
    : [];
  const eventAffectedPages = [...new Set(queryDocumentationImpact(triggerRecords, { events: impactEvents })
    .flatMap((record) => record.pages))].sort();

  return {
    schema: SCHEMA,
    status,
    documentedVersion,
    registryVersion,
    verifiedFacts: {
      schema: "superbee-docs-release-input.v1",
      package: "superbee",
      version: registryVersion,
      npmTag: "latest",
      publishedAt,
      packageUrl: `https://www.npmjs.com/package/superbee/v/${registryVersion}`,
      tarballUrl,
      npmIntegrity,
      sourceUrl: `https://github.com/Holaxis-ai/superbee/tree/v${registryVersion}`,
      sourceCommit,
      sourceTag: `v${registryVersion}`,
      nodeRequirement: String(registry.engines?.node ?? ""),
      githubReleaseUrl,
      githubReleaseNotes: String(release.body ?? ""),
    },
    authoredFieldsRequired: status === "update_required"
      ? ["summary", "changes", "action", "compatibility", "recovery", "supportedPlatforms", "verification"]
      : [],
    impactEvents,
    eventAffectedPages,
    sourceDiff: {
      base: documentedSourceCommit,
      head: sourceCommit,
    },
    next: status === "update_required"
      ? "Review the verified release evidence and product changes, query the declared impact events, author the required reader-facing fields, then run npm run docs:release with the completed ephemeral manifest."
      : "No release-note update is required.",
  };
}

async function main(args) {
  const options = parseOptions(args);
  const result = await releaseDocumentationStatus(options);
  console.log(JSON.stringify(result, null, 2));
  if (options.failOnUpdate && result.status === "update_required") process.exitCode = 3;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
