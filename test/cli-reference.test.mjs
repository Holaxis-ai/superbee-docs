import { execFileSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { commandRows } from "../scripts/cli-reference.mjs";

const help = execFileSync("node_modules/.bin/superbee", ["--help"], { encoding: "utf8" });

test("CLI inventory includes every shipped Hosted command", () => {
  const hosted = commandRows(help).filter((row) => row.section === "Hosted");
  assert.deepEqual(hosted.map((row) => row.command.split(" ")[0]),
    ["login", "whoami", "logout", "checkout", "export", "publish", "op"]);
});

test("CLI inventory refuses unknown command groups instead of omitting them", () => {
  assert.throws(() => commandRows(`${help}\nNew commands:\n  surprise — A new command\n`),
    /unrecognized executable command section: New commands/);
});
