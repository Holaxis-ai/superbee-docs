#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile, readdir, realpath } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { loadDocumentationTriggerRecords } from "./documentation-impact.mjs";

const execFileAsync = promisify(execFile);
const SOURCE_ID = "sources/superbee-codebase-main";
const SOURCE_FILE = ".superbee/sources/superbee-codebase-main.md";
const ARCHITECTURE_DIR = ".superbee/architecture";
const REPOSITORY = "https://github.com/Holaxis-ai/superbee";
const SCHEMA = "https://getsuperbee.com/schemas/architecture-freshness-result/v1";
const FULL_SHA = /^[0-9a-f]{40}$/u;
const SAFE_PATH = /^(?![-!])(?=.{1,240}$)[A-Za-z0-9._/*-]+$/u;
const SUPERBEE_BLOB_URL = /https:\/\/github\.com\/Holaxis-ai\/superbee\/blob\/[^\s)<>"']+/giu;
const CITATION = /https:\/\/github\.com\/Holaxis-ai\/superbee\/blob\/([0-9a-f]{40})\/([A-Za-z0-9._/-]+)#L([1-9][0-9]*)(?:-L([1-9][0-9]*))?(?=[\s)])/gu;

function fail(message) {
  throw new Error(message);
}

async function git(root, args, options = {}) {
  try {
    return (await execFileAsync("git", ["-c", "core.quotepath=false", "-c", "diff.external=", "-C", root, ...args], {
      encoding: options.encoding ?? "utf8",
      maxBuffer: 16 * 1024 * 1024,
    })).stdout;
  } catch (error) {
    fail(`git ${args[0]} failed: ${(error.stderr || error.message).trim()}`);
  }
}

function bodyOf(raw, label) {
  const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/u);
  if (!match) fail(`${label} is not a Superbee Markdown document`);
  return match[1].trimEnd();
}

function exactBodyField(body, name) {
  const matches = [...body.matchAll(new RegExp("^- `" + name + "`: `([^`]+)`$", "gmu"))];
  if (matches.length !== 1) fail(`Source requires exactly one ${name} field`);
  return matches[0][1];
}

export function parseSourceEvidence(raw) {
  const body = bodyOf(raw, "Source evidence");
  const repository = exactBodyField(body, "source_repository");
  const commit = exactBodyField(body, "source_commit");
  if (repository !== REPOSITORY) fail(`unsupported source_repository '${repository}'`);
  if (!FULL_SHA.test(commit)) fail("source_commit must be one full lowercase commit SHA");
  return { id: SOURCE_ID, repository, commit };
}

function validateTrigger(trigger) {
  if (!SAFE_PATH.test(trigger) || trigger.includes("//") || trigger.split("/").some((part) => part === "." || part === "..")) {
    fail(`invalid architecture change trigger '${trigger}'`);
  }
  if (/[*]{3,}|[^*][*]{2}[^*/]/u.test(trigger)) fail(`invalid architecture glob '${trigger}'`);
  return trigger;
}

function globRegex(pattern) {
  let result = "^";
  for (let index = 0; index < pattern.length;) {
    if (pattern[index] === "*" && pattern[index + 1] === "*") {
      result += ".*";
      index += 2;
    } else if (pattern[index] === "*") {
      result += "[^/]*";
      index += 1;
    } else {
      result += pattern[index].replace(/[\\^$+?.()|[\]{}]/gu, "\\$&");
      index += 1;
    }
  }
  return new RegExp(`${result}$`, "u");
}

export function parseArchitecturePage(raw, pageId) {
  const body = bodyOf(raw, pageId);
  const sourceLinks = [...body.matchAll(/\]\(\.\.\/sources\/superbee-codebase-main\.md\)/gu)];
  if (sourceLinks.length !== 1) fail(`${pageId} requires exactly one governing Source link`);
  const blobUrls = [...body.matchAll(SUPERBEE_BLOB_URL)].map((match) => match[0]);
  const citations = [...body.matchAll(CITATION)].map((match) => ({
    sha: match[1],
    path: validateTrigger(match[2]),
    start: Number(match[3]),
    end: Number(match[4] ?? match[3]),
    url: match[0],
  }));
  if (blobUrls.length !== citations.length || blobUrls.some((url, index) => url !== citations[index]?.url)) {
    fail(`${pageId} has a noncanonical or floating Superbee source citation`);
  }
  if (citations.length === 0) fail(`${pageId} requires at least one source citation`);
  return { id: pageId, citations };
}

async function commitExists(sourceRoot, sha) {
  if (!FULL_SHA.test(sha)) fail(`commit '${sha}' must be a full lowercase SHA`);
  await git(sourceRoot, ["cat-file", "-e", `${sha}^{commit}`]);
}

function parseTree(raw) {
  const files = new Map();
  for (const row of raw.split("\0")) {
    if (!row) continue;
    const match = row.match(/^(\d{6}) blob [0-9a-f]{40}\t(.+)$/u);
    if (match) files.set(match[2], { mode: match[1] });
  }
  return files;
}

async function pinnedTree(sourceRoot, sha) {
  return parseTree(await git(sourceRoot, ["ls-tree", "-r", "-z", "--full-tree", sha]));
}

async function blobLineCount(sourceRoot, sha, path) {
  const contents = await git(sourceRoot, ["show", `${sha}:${path}`]);
  return contents === "" ? 0 : contents.replace(/\n$/u, "").split("\n").length;
}

function triggerMatches(trigger, path) {
  return globRegex(trigger).test(path);
}

async function loadPages(root) {
  const directory = resolve(root, ARCHITECTURE_DIR);
  const names = (await readdir(directory)).filter((name) => name.endsWith(".md")).sort();
  const pages = [];
  const triggerRecords = await loadDocumentationTriggerRecords(root);
  for (const name of names) {
    const raw = await readFile(resolve(directory, name), "utf8");
    if (!raw.includes("../sources/superbee-codebase-main.md")) {
      if (SUPERBEE_BLOB_URL.test(raw)) {
        SUPERBEE_BLOB_URL.lastIndex = 0;
        fail(`architecture/${basename(name, ".md")} cites Superbee code without the governing Source link`);
      }
      SUPERBEE_BLOB_URL.lastIndex = 0;
      continue;
    }
    const page = parseArchitecturePage(raw, `architecture/${basename(name, ".md")}`);
    const records = triggerRecords.filter((record) => record.pages.includes(page.id));
    if (records.length === 0) fail(`${page.id} requires at least one Documentation Trigger record`);
    const triggers = [...new Set(records.flatMap((record) => record.sources).map(validateTrigger))];
    if (triggers.length === 0) fail(`${page.id} requires at least one exact source-path trigger`);
    pages.push({ ...page, triggers });
  }
  if (pages.length === 0) fail("no architecture pages are governed by the Superbee codebase Source");
  return pages;
}

async function verifyRepositoryIdentity(sourceRoot, repository) {
  const remote = (await git(sourceRoot, ["remote", "get-url", "origin"])).trim().replace(/\.git$/u, "");
  if (remote !== repository) fail(`source checkout origin '${remote}' does not match '${repository}'`);
}

export async function checkArchitecture({ root = process.cwd(), source }) {
  if (!source) fail("--source is required");
  const docsRoot = await realpath(resolve(root));
  const sourceRoot = await realpath(resolve(source));
  const evidence = parseSourceEvidence(await readFile(resolve(docsRoot, SOURCE_FILE), "utf8"));
  await verifyRepositoryIdentity(sourceRoot, evidence.repository);
  await commitExists(sourceRoot, evidence.commit);
  const tree = await pinnedTree(sourceRoot, evidence.commit);
  const pages = await loadPages(docsRoot);
  for (const page of pages) {
    for (const trigger of page.triggers) {
      const matched = [...tree].some(([path, entry]) => entry.mode.startsWith("100") && triggerMatches(trigger, path));
      if (!matched) fail(`${page.id} trigger '${trigger}' matches no regular file at the source pin`);
    }
    for (const citation of page.citations) {
      if (citation.sha !== evidence.commit) fail(`${page.id} citation uses a different source commit`);
      const entry = tree.get(citation.path);
      if (!entry || !entry.mode.startsWith("100")) fail(`${page.id} citation is not a regular pinned blob: ${citation.path}`);
      if (!page.triggers.some((trigger) => triggerMatches(trigger, citation.path))) {
        fail(`${page.id} citation is not covered by a change trigger: ${citation.path}`);
      }
      const lines = await blobLineCount(sourceRoot, evidence.commit, citation.path);
      if (citation.start > citation.end || citation.end > lines) {
        fail(`${page.id} citation line range is invalid for ${citation.path}`);
      }
    }
  }
  return {
    schema: SCHEMA,
    ok: true,
    command: "architecture check",
    sourceRepository: evidence.repository,
    sourceCommit: evidence.commit,
    pages: pages.map(({ id, triggers, citations }) => ({ id, triggers: triggers.length, citations: citations.length })),
    _internal: { docsRoot, sourceRoot, evidence, pages },
  };
}

function parseChangedPaths(raw) {
  const parts = raw.split("\0").filter(Boolean);
  if (parts.length % 2 !== 0) fail("git diff returned an indeterminate name-status stream");
  const rows = [];
  for (let index = 0; index < parts.length; index += 2) {
    const status = parts[index];
    const path = parts[index + 1];
    if (!/^[AMDTUXB]$/u.test(status) || !SAFE_PATH.test(path)) fail(`unsupported git change '${status}' for '${path}'`);
    rows.push({ status, path });
  }
  return rows;
}

async function diffChanges(sourceRoot, base, head) {
  return parseChangedPaths(await git(sourceRoot, ["diff", "--no-ext-diff", "--name-status", "-z", "--no-renames", `${base}..${head}`, "--"]));
}

export async function architectureImpact({ root = process.cwd(), source, head, change }) {
  if ((head ? 1 : 0) + (change ? 1 : 0) !== 1) fail("impact requires exactly one of --head or --change");
  const checked = await checkArchitecture({ root, source });
  const { sourceRoot, evidence, pages } = checked._internal;
  let base = evidence.commit;
  let target = head ?? change;
  await commitExists(sourceRoot, target);
  let mode = "forward";
  if (head) {
    try {
      await execFileAsync("git", ["-C", sourceRoot, "merge-base", "--is-ancestor", base, target]);
    } catch {
      fail(`head ${target} is not a descendant of source pin ${base}`);
    }
  } else {
    mode = "historical-change";
    const parents = (await git(sourceRoot, ["rev-list", "--parents", "-n", "1", target])).trim().split(" ");
    if (parents.length !== 2) fail("--change requires a non-merge commit with one parent");
    base = parents[1];
  }
  const changes = await diffChanges(sourceRoot, base, target);
  const impacted = pages.map((page) => {
    const matches = changes.filter((changeRow) => page.triggers.some((trigger) => triggerMatches(trigger, changeRow.path)));
    return { id: page.id, matches };
  }).filter((page) => page.matches.length > 0);
  return {
    schema: SCHEMA,
    ok: true,
    command: "architecture impact",
    mode,
    sourceCommit: evidence.commit,
    base,
    head: target,
    status: impacted.length > 0 ? "semantic_review_required" : "no_impact",
    changed: changes,
    pages: impacted,
  };
}

function publicResult(result) {
  const { _internal, ...value } = result;
  return value;
}

function parseArguments(args) {
  const [command, ...rest] = args;
  const options = { command };
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!new Set(["--root", "--source", "--head", "--change"]).has(key) || value === undefined) fail(`unknown or incomplete option '${key}'`);
    options[key.slice(2)] = value;
  }
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = options.command === "check"
      ? await checkArchitecture(options)
      : options.command === "impact"
        ? await architectureImpact(options)
        : fail("usage: architecture-docs.mjs <check|impact> --source <checkout> [--head <sha>|--change <sha>]");
    console.log(JSON.stringify(publicResult(result)));
  } catch (error) {
    console.error(JSON.stringify({ schema: SCHEMA, ok: false, error: { message: error.message } }));
    process.exitCode = 1;
  }
}
