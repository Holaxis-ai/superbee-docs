import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadCodebaseDocumentationTriggersV0,
  queryCodebaseDocumentationImpactV0,
} from "@superbee/recipe-studio/codebase-documentation/v0";
import { capturePublicationSnapshot, PUBLICATION_SNAPSHOT_V1 } from "superbee/publication";

function fail(message) { throw new Error(message); }
function normalize(value) { return value.replaceAll("\\", "/").replace(/^\.\//, ""); }

/** Repository adapter over the package-owned trigger parser and validator. */
export async function loadDocumentationTriggerRecords(root) {
  const snapshot = await capturePublicationSnapshot({
    schema: PUBLICATION_SNAPSHOT_V1,
    source: { kind: "filesystem", root: path.join(root, ".superbee") },
  });
  try { return await loadCodebaseDocumentationTriggersV0(snapshot); }
  finally { await snapshot.close(); }
}

export const queryDocumentationImpact = queryCodebaseDocumentationImpactV0;

async function main(args) {
  const root = path.resolve(".");
  const command = !args[0] || args[0].startsWith("--") ? "query" : args[0];
  const optionStart = command === args[0] ? 1 : 0;
  const rows = await loadDocumentationTriggerRecords(root);
  if (command === "check") {
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
  const affected = queryCodebaseDocumentationImpactV0(rows, { changed, events });
  console.log(JSON.stringify({ ok: true, command: "documentation impact query", changed, events, affected }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
