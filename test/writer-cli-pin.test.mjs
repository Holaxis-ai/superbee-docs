import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(".github/workflows/writer-cli-pin.yml", "utf8");
const body = workflow.slice(workflow.indexOf("\njobs:\n"));
const jobs = Object.fromEntries(body.split(/\n(?=  [a-z-]+:\n)/u).slice(1).map((block) => [block.match(/^  ([a-z-]+):/u)[1], block]));

test("the writer pin workflow runs only on dispatch, with read-only defaults", () => {
  const header = workflow.slice(0, workflow.indexOf("\njobs:\n"));
  assert.match(header, /\non:\n  workflow_dispatch:\n/u);
  assert.doesNotMatch(header, /pull_request|push:|schedule:/u);
  assert.match(header, /\npermissions:\n  contents: read\n/u);
  assert.deepEqual(Object.keys(jobs), ["resolve", "open-pull-request"]);
});

test("package code runs only in the read-only job", () => {
  assert.match(jobs.resolve, /permissions:\n      contents: read\n    outputs:/u);
  assert.match(jobs.resolve, /npm install --ignore-scripts --save-exact /u);
  assert.match(jobs.resolve, /persist-credentials: false/u);
  assert.match(jobs.resolve, /test "\$changed" = "package-lock\.json package\.json "/u);
});

test("the write job holds no package secret and runs no npm or node", () => {
  const write = jobs["open-pull-request"];
  assert.match(write, /permissions:\n      contents: write\n      pull-requests: write\n      actions: write\n/u);
  assert.doesNotMatch(write, /secrets\.|setup-node|^\s*(?:run: )?(?:npm|npx|node) /mu);
  assert.match(write, /test "\$changed" = "package-lock\.json package\.json "/u);
  // A pull request opened with GITHUB_TOKEN triggers no workflow, so the check must be dispatched.
  assert.match(write, /gh workflow run check\.yml --ref "\$branch"/u);
});

test("check.yml accepts the dispatch the writer pin workflow sends", async () => {
  assert.match(await readFile(".github/workflows/check.yml", "utf8"), /\n  workflow_dispatch:\n/u);
});
