import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TYPE = "Documentation Trigger";
const PREFIX = "maintenance/documentation-triggers/";
const HEADINGS = ["Affected pages", "Source paths", "Product events", "Review action", "Evidence"];
const SAFE_SOURCE = /^(?![-!])(?=.{1,240}$)[A-Za-z0-9._/*-]+$/;
const SAFE_EVENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) { throw new Error(message); }
function normalize(value) { return value.replaceAll("\\", "/").replace(/^\.\//, ""); }
function regexEscape(value) { return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&"); }
function globRegex(pattern) {
  const escaped = regexEscape(normalize(pattern)).replaceAll("**", "\0").replaceAll("*", "[^/]*").replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`);
}

function sections(body, id) {
  const found = [...body.matchAll(/^# (.+)$/gm)].map((match) => ({ name: match[1], index: match.index }));
  if (JSON.stringify(found.map((row) => row.name)) !== JSON.stringify(HEADINGS)) {
    fail(`${id} must contain the exact ordered headings: ${HEADINGS.join(", ")}`);
  }
  return Object.fromEntries(found.map((row, index) => [row.name, body.slice(row.index + row.name.length + 3, found[index + 1]?.index ?? body.length).trim()]));
}

function bulletValues(value, section, id) {
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0] === "None.") return [];
  return lines.map((line) => {
    const match = line.match(/^- `([^`]+)`$/);
    if (!match) fail(`${id} has an invalid ${section} entry '${line}'`);
    return match[1];
  });
}

export async function loadDocumentationTriggerRecords(root) {
  const directory = path.join(root, ".superbee", PREFIX);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort();
  const rows = [];
  for (const file of files) {
    const id = `${PREFIX}${file.slice(0, -3)}`;
    const recordPath = path.join(directory, file);
    const recordInfo = await lstat(recordPath);
    if (!recordInfo.isFile() || recordInfo.isSymbolicLink()) fail(`${id} must be a regular bundle document`);
    const markdown = await readFile(recordPath, "utf8");
    const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/);
    if (!frontmatter || !new RegExp(`^type: ${TYPE}$`, "m").test(frontmatter[1])) fail(`${id} must use type: ${TYPE}`);
    const body = markdown.slice(frontmatter[0].length);
    const parts = sections(body, id);
    const pages = [...parts["Affected pages"].matchAll(/\[[^\]]+\]\((\.\.\/(?:\.\.\/)+[^)]+\.md)\)/g)]
      .map((match) => normalize(path.posix.normalize(path.posix.join(path.posix.dirname(id), match[1]))).replace(/\.md$/, ""));
    if (!pages.length) fail(`${id} must link at least one affected page`);
    if (new Set(pages).size !== pages.length) fail(`${id} has duplicate affected pages`);
    for (const page of pages) {
      const filePath = path.join(root, ".superbee", `${page}.md`);
      const info = await lstat(filePath).catch(() => undefined);
      if (!info?.isFile() || info.isSymbolicLink()) fail(`${id} references absent or unsafe page '${page}'`);
    }
    const sources = bulletValues(parts["Source paths"], "Source paths", id);
    const events = bulletValues(parts["Product events"], "Product events", id);
    if (!sources.length && !events.length) fail(`${id} must declare a source path or product event`);
    if (new Set(sources).size !== sources.length || new Set(events).size !== events.length) fail(`${id} contains duplicate triggers`);
    for (const source of sources) {
      if (!SAFE_SOURCE.test(source) || source.includes("//") || source.split("/").some((part) => part === "." || part === "..")
        || /[*]{3,}|[^*][*]{2}[^*/]/.test(source)) fail(`${id} has an invalid source path '${source}'`);
    }
    for (const event of events) if (!SAFE_EVENT.test(event)) fail(`${id} has an invalid product event '${event}'`);
    if (!parts["Review action"] || !/\[[^\]]+\]\([^)]+\)/.test(parts.Evidence)) {
      fail(`${id} must declare a review action and linked evidence`);
    }
    rows.push({ id, pages, sources, events });
  }
  if (!rows.length) fail("no documentation trigger records found");
  return rows;
}

export function queryDocumentationImpact(rows, { changed = [], events = [] }) {
  return rows.filter((row) => row.sources.some((pattern) => changed.some((file) => globRegex(pattern).test(normalize(file))))
    || row.events.some((event) => events.includes(event)));
}

async function main(args) {
  const root = path.resolve(".");
  const command = !args[0] || args[0].startsWith("--") ? "query" : args[0];
  const optionStart = command === args[0] ? 1 : 0;
  const rows = await loadDocumentationTriggerRecords(root);
  if (command === "check") {
    const config = JSON.parse(await readFile(path.join(root, "portal.config.json"), "utf8"));
    if (!config.documentation?.operationalTypes?.includes(TYPE)) fail(`${TYPE} must be declared in documentation.operationalTypes`);
    const selected = new Set(config.documentation.navigation.flatMap((section) => section.documents));
    const support = JSON.parse(await readFile(path.join(root, "documentation-selection.json"), "utf8")).supportingDocuments;
    for (const id of [...selected, ...support]) if (id.startsWith(PREFIX)) fail(`operational record '${id}' is selected for human presentation`);
    console.log(JSON.stringify({ ok: true, command: "documentation impact check", records: rows.length }));
    return;
  }
  if (command !== "query") fail("usage: npm run docs:impact -- [query] [--changed <path>]... [--event <name>]...");
  const changed = [];
  const events = [];
  for (let index = optionStart; index < args.length; index += 2) {
    const flag = args[index]; const value = args[index + 1];
    if (!value || !new Set(["--changed", "--changed-list", "--event"]).has(flag)) {
      fail("query accepts repeatable --changed <path>, --changed-list <nul-delimited-file>, and --event <name>");
    }
    if (flag === "--changed-list") {
      const listed = (await readFile(path.resolve(value))).toString("utf8").split("\0").filter(Boolean).map(normalize);
      changed.push(...listed);
    } else {
      (flag === "--changed" ? changed : events).push(normalize(value));
    }
  }
  if (!changed.length && !events.length) fail("query requires at least one --changed or --event value");
  const affected = queryDocumentationImpact(rows, { changed, events });
  console.log(JSON.stringify({ ok: true, command: "documentation impact query", changed, events, affected }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
