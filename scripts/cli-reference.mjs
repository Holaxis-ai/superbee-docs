import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documentId = "reference/cli-commands";
const beginMarker = "<!-- BEGIN GENERATED CLI INVENTORY -->";
const endMarker = "<!-- END GENERATED CLI INVENTORY -->";
const sectionNames = new Set(["Bundle", "Documents & links", "Artifacts", "Kinds", "Remote", "Session"]);

function usage() {
  return `Usage:
  node scripts/cli-reference.mjs build [--bin <path>]
  node scripts/cli-reference.mjs check [--bin <path>]

The default executable is the exact current stable package installed by npm ci.
The generated inventory is written through Superbee; check mode is read-only and fails on drift.
`;
}

function parseOptions(argv) {
  const mode = argv[0];
  if (mode === "--help" || mode === "-h") return { help: true };
  if (mode !== "build" && mode !== "check") throw new Error("first argument must be build or check");
  let bin = resolve(root, "node_modules/.bin/superbee");
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === "--help" || argv[index] === "-h") return { help: true };
    if (argv[index] !== "--bin") throw new Error(`unknown option: ${argv[index]}`);
    const value = argv[++index];
    if (!value) throw new Error("--bin requires a path");
    bin = resolve(value);
  }
  return { mode, bin };
}

async function run(bin, args) {
  try {
    const result = await execFileAsync(bin, args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
    return result.stdout;
  } catch (error) {
    const detail = error?.stderr?.trim?.() || error?.message || String(error);
    throw new Error(`${bin} ${args.join(" ")} failed: ${detail}`);
  }
}

function commandRows(help) {
  const rows = [];
  let section = null;
  for (const line of help.split(/\r?\n/)) {
    const heading = line.match(/^([^:]+):$/)?.[1];
    if (heading && sectionNames.has(heading)) {
      section = heading;
      continue;
    }
    if (!section) continue;
    if (/^[A-Z][^:]+:$/.test(line)) {
      section = null;
      continue;
    }
    const command = line.match(/^  (\S.*?)(?:\s+—\s+|\s+-\s+).+$/)?.[1];
    if (command) rows.push({ section, command: command.trim() });
  }
  if (rows.length < 25) throw new Error(`executable help yielded only ${rows.length} command rows`);
  return rows;
}

function escapeCell(value) {
  return value.replaceAll("|", "\\|");
}

function generatedBlock(help, version) {
  const rows = commandRows(help);
  const lines = [
    beginMarker,
    "",
    `Generated from the current stable package's executable help. ${rows.length} command entries are present.`,
    "",
    "| Group | Command signature |",
    "| --- | --- |",
    ...rows.map(({ section, command }) => `| ${escapeCell(section)} | \`${escapeCell(command)}\` |`),
    "",
    endMarker,
  ];
  return lines.join("\n");
}

function replaceGenerated(body, block) {
  const start = body.indexOf(beginMarker);
  const end = body.indexOf(endMarker);
  if (start < 0 || end < 0 || end < start) throw new Error(`missing generated markers in ${documentId}`);
  return `${body.slice(0, start)}${block}${body.slice(end + endMarker.length)}`;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  const versionLabel = (await run(options.bin, [
    "doc", "read", "documentation-systems/main", "--field", "version_label", "--dir", resolve(root, ".superbee"),
  ])).trim();
  const version = versionLabel.replace(/^v/, "");
  const identity = JSON.parse(await run(options.bin, ["version", "--json"]));
  if (identity.identity?.package?.version !== version || identity.identity?.artifact?.channel !== "npm-package") {
    throw new Error(`reference binary must be npm-package superbee@${version}`);
  }
  const help = await run(options.bin, ["--help"]);
  const body = await run(options.bin, ["doc", "read", documentId, "--body-out", "-", "--dir", resolve(root, ".superbee")]);
  const expected = replaceGenerated(body, generatedBlock(help, version));
  if (options.mode === "check") {
    if (body !== expected) throw new Error(`${documentId} generated command inventory is stale; run npm run cli-reference:build`);
    process.stdout.write(`cli_reference: current\nversion: ${version}\nrows: ${commandRows(help).length}\n`);
    return;
  }
  if (body === expected) {
    process.stdout.write(`cli_reference: unchanged\nversion: ${version}\n`);
    return;
  }
  const versionToken = (await run(options.bin, ["doc", "read", documentId, "--field", "head_version", "--dir", resolve(root, ".superbee")])).trim();
  const scratch = await mkdtemp(resolve(tmpdir(), "superbee-cli-reference-"));
  try {
    const bodyFile = resolve(scratch, "body.md");
    await writeFile(bodyFile, expected);
    await run(options.bin, [
      "doc", "update", documentId,
      "--body-file", bodyFile,
      "--expected-version", versionToken,
      "--actor", "cli-reference-generator",
      "--dir", resolve(root, ".superbee"),
    ]);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  process.stdout.write(`cli_reference: updated\nversion: ${version}\nrows: ${commandRows(help).length}\n`);
}

main().catch((error) => {
  process.stderr.write(`cli_reference: ${error.message}\n`);
  process.exitCode = 1;
});
