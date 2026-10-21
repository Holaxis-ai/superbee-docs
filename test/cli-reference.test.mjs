import { execFileSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { commandRows } from "../scripts/cli-reference.mjs";

const help = execFileSync("node_modules/.bin/superbee", ["--help"], { encoding: "utf8" });

// Every indented line under a command group must become a row, so a help format change cannot
// silently shorten the generated table that cli-reference:check then compares against.
function indentedCommandLines(text) {
  const groups = new Set(["Bundle", "Documents & links", "Artifacts", "Kinds", "Remote", "Session", "Hosted"]);
  let group = null;
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^([^:]+):$/)?.[1];
    if (heading) group = heading;
    else if (groups.has(group) && /^  \S/.test(line)) count += 1;
  }
  return count;
}

test("CLI inventory parses every indented command line of every group", () => {
  assert.equal(commandRows(help).length, indentedCommandLines(help));
  const separatorless = help.replace(/^  (login\b)[^\n]*/m, "  $1");
  assert.notEqual(separatorless, help);
  assert.notEqual(commandRows(separatorless).length, indentedCommandLines(separatorless));
});

test("CLI inventory refuses unknown command groups instead of omitting them", () => {
  assert.throws(() => commandRows(`${help}\nNew commands:\n  surprise — A new command\n`),
    /unrecognized executable command section: New commands/);
});
