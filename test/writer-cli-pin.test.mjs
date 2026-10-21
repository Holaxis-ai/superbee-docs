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

test("both jobs run only from main, the base of the pull request", () => {
  assert.ok(jobs.resolve.includes(`run: test "$GITHUB_REF" = refs/heads/main || { echo "::error::dispatch this workflow from main"; exit 1; }`), "resolve refuses other refs");
  assert.ok(jobs.resolve.indexOf("refs/heads/main") < jobs.resolve.indexOf("actions/checkout"), "before checkout");
  assert.match(jobs["open-pull-request"], /\n    if: github\.ref == 'refs\/heads\/main' && needs\.resolve\.outputs\.changed == 'true'\n/u);
});

test("the version is exact and published before any use", () => {
  assert.ok(jobs.resolve.includes(String.raw`[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]`), "exact-version regex");
  assert.ok(jobs.resolve.includes(`test "$(npm view "superbee@$V" version)" = "$V"`), "published check");
  assert.ok(jobs.resolve.indexOf("=~") < jobs.resolve.indexOf("GITHUB_OUTPUT"), "validated before it becomes an output");
});

test("package code runs only in the read-only job", () => {
  assert.match(jobs.resolve, /permissions:\n      contents: read\n    outputs:/u);
  assert.match(jobs.resolve, /npm install --ignore-scripts --save-exact /u);
  assert.match(jobs.resolve, /persist-credentials: false/u);
  assert.match(jobs.resolve, /test "\$changed" = "package-lock\.json package\.json "/u);
  assert.ok(jobs.resolve.includes("git diff --numstat package.json"), "one-line package.json change");
  assert.match(jobs.resolve, /run: npm run ci:dependencies\n/u);
});

test("the write job holds no package secret and runs no npm or node", () => {
  const write = jobs["open-pull-request"];
  assert.match(write, /permissions:\n      contents: write\n      pull-requests: write\n      actions: write\n/u);
  assert.doesNotMatch(write, /secrets\.|setup-node|(?:^|[\s;&|(])(?:npm|npx|node)\s/mu);
  assert.doesNotMatch(write.slice(write.indexOf("download-artifact")), /^\s+path:/mu, "the artifact lands in the checkout root only");
  assert.ok(write.includes("git diff --numstat package.json"), "one-line package.json change");
  assert.match(write, /test "\$changed" = "package-lock\.json package\.json "/u);
  // A pull request opened with GITHUB_TOKEN triggers no workflow, so the check must be dispatched.
  assert.match(write, /gh workflow run check\.yml --ref "\$branch"/u);
});

test("a second dispatch or a refused pull request leaves no stray branch", () => {
  const write = jobs["open-pull-request"];
  assert.ok(write.includes("git ls-remote --exit-code --heads origin"), "existing branch refused");
  assert.ok(write.indexOf("git ls-remote --exit-code --heads origin") < write.indexOf("git push -q origin \"$branch\""), "existing branch refused before push");
  assert.match(write, /if ! gh pr create [^\n]+; then\n\s+git push -q origin --delete "\$branch"\n/u);
});

test("check.yml accepts the dispatch the writer pin workflow sends", async () => {
  assert.match(await readFile(".github/workflows/check.yml", "utf8"), /\n  workflow_dispatch:\n/u);
});
