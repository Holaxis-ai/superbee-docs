import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BASELINE_PATH,
  HOSTED_CONTENT,
  checkCounts,
  compareTrees,
  exportHosted,
  listFiles,
  materialize,
  readFreshnessBaseline,
  treeDigest,
  withFreshnessBaseline,
} from "../scripts/hosted-content.mjs";
import { exchange, run as runWithToken } from "../scripts/hosted-workload-token.mjs";

async function folder(files) {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-hosted-test-"));
  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), text);
  }
  return root;
}

test("materialize makes the bundle folder exactly the export and keeps the Git configuration", async () => {
  const exported = await folder({ "index.md": "i", "guides/a.md": "hosted a", "visuals/x.svg": "<svg/>" });
  const bundle = await folder({
    "index.md": "old",
    "guides/a.md": "git a",
    "guides/stale.md": "removed on the host",
    "assistant/instructions.md": "config",
    "assistant/golden-questions.md": "config",
  });
  try {
    const placed = await materialize({ from: exported, bundleDir: bundle });
    assert.deepEqual(await listFiles(bundle), [
      "assistant/golden-questions.md", "assistant/instructions.md", "guides/a.md", "index.md", "visuals/x.svg",
    ]);
    assert.equal(await readFile(path.join(bundle, "guides/a.md"), "utf8"), "hosted a");
    assert.equal(await readFile(path.join(bundle, "assistant/instructions.md"), "utf8"), "config");
    assert.equal(placed.files, 3);
    assert.equal(placed.treeDigest, await treeDigest(exported, await listFiles(exported)));
    assert.deepEqual(await compareTrees(bundle, exported), { identical: 3, differ: [], onlyLeft: [], onlyRight: [] });
  } finally {
    await rm(exported, { recursive: true, force: true });
    await rm(bundle, { recursive: true, force: true });
  }
});

test("materialize refuses an export that carries configuration, dot entries, links or no index", async () => {
  const cases = [
    [{ "index.md": "i", "assistant/instructions.md": "x" }, /assistant\/ is configuration/],
    [{ "index.md": "i", ".superbee/checkout.json": "{}" }, /dot entry/],
    [{ "guides/a.md": "a" }, /no root index\.md/],
  ];
  for (const [files, message] of cases) {
    const exported = await folder(files);
    const bundle = await folder({ "index.md": "keep" });
    try {
      await assert.rejects(materialize({ from: exported, bundleDir: bundle }), message);
      assert.equal(await readFile(path.join(bundle, "index.md"), "utf8"), "keep", "refused before touching the bundle");
    } finally {
      await rm(exported, { recursive: true, force: true });
      await rm(bundle, { recursive: true, force: true });
    }
  }
  const exported = await folder({ "index.md": "i" });
  const bundle = await folder({ "index.md": "keep" });
  try {
    await symlink("/etc/hosts", path.join(exported, "hosts.md"));
    await assert.rejects(materialize({ from: exported, bundleDir: bundle }), /symbolic link/);
  } finally {
    await rm(exported, { recursive: true, force: true });
    await rm(bundle, { recursive: true, force: true });
  }
});

test("export names the qualified hosted bundle, adds the host only for a person's session, and checks the receipt", () => {
  const calls = [];
  const ok = { export: "created", bundle_id: "superbee-docs", host: HOSTED_CONTENT.gateway, revision: 3, documents: 2, reserved: 1, blobs: 0, bytes: 9, root_index: true };
  const fake = (answer, status = 0) => (command, args, options) => {
    calls.push({ args: args.slice(1), env: options.env });
    return { status, stdout: JSON.stringify(answer), stderr: "" };
  };
  assert.deepEqual(exportHosted({ to: "/x", env: {}, run: fake(ok) }), ok);
  assert.deepEqual(calls.at(-1).args, ["export", HOSTED_CONTENT.bundle, "--host", HOSTED_CONTENT.gateway, "--to", "/x", "--json"]);
  exportHosted({ to: "/x", env: { SUPERBEE_ACCESS_TOKEN: "sbw_x", SUPERBEE_HOST: HOSTED_CONTENT.gateway }, run: fake(ok) });
  assert.deepEqual(calls.at(-1).args, ["export", HOSTED_CONTENT.bundle, "--to", "/x", "--json"]);
  assert.throws(() => exportHosted({ to: "/x", env: {}, run: fake({ ...ok, bundle_id: "other" }) }), /no export of superbee-docs/);
  assert.throws(() => exportHosted({ to: "/x", env: {}, run: fake({ ...ok, documents: 0 }) }), /no documents/);
  assert.throws(() => exportHosted({ to: "/x", env: {}, run: fake({ error: { message: "denied" } }, 4) }), /exit 4\): denied/);
  assert.throws(() => exportHosted({ to: "/x", env: {}, run: fake({ ...ok, root_index: false }) }), /no root index/);
  assert.throws(() => exportHosted({ to: "/x", env: {}, run: fake({ ...ok, host: "https://elsewhere" }) }), /not https:\/\/mcp/);
  assert.throws(() => exportHosted({ to: "/x", env: { SUPERBEE_ACCESS_TOKEN: "sbw_x", SUPERBEE_HOST: "https://elsewhere" }, run: fake(ok) }), /not https:\/\/mcp/);
  checkCounts(ok, ["a", "b", "index.md"]);
  assert.throws(() => checkCounts(ok, ["a", "index.md"]), /holds 2 files, but its receipt counts 3/);
});

const snapshot = (documents) => ({ manifest: { documents } });
const V = (n) => `sha256:${String(n).repeat(64)}`;

test("the freshness baseline fills only documents with no clock whose bytes are unchanged, in Git's order", () => {
  const baseline = new Map([
    ["a", { documentId: "a", sourceVersion: V(1), committedAt: "2026-08-01T00:00:00.000Z" }],
    ["b", { documentId: "b", sourceVersion: V(2), committedAt: "2026-08-02T00:00:00.000Z" }],
    ["c", { documentId: "c", sourceVersion: V(3), committedAt: "2026-08-03T00:00:00.000Z" }],
    ["d", { documentId: "d", sourceVersion: V(4), committedAt: "2026-08-04T00:00:00.000Z" }],
  ]);
  const docs = snapshot([
    { id: "a", version: V(1), frontmatter: { type: "Guide" } },
    { id: "b", version: V(9), frontmatter: { type: "Guide" } },
    { id: "c", version: V(3), frontmatter: { generated: { by: "x", at: "bad" } } },
    { id: "d", version: V(4), frontmatter: { timestamp: "2026-09-01" } },
    { id: "e", version: V(5), frontmatter: {} },
  ]);
  const git = [{ documentId: "e", sourceVersion: V(5), updatedAt: "2026-09-09T00:00:00.000Z" }];
  const facts = withFreshnessBaseline({ facts: git, baseline, snapshot: docs, documentIds: ["e", "d", "c", "b", "a"] });
  assert.deepEqual(facts.map((fact) => [fact.documentId, fact.updatedAt]), [
    ["a", "2026-08-01T00:00:00.000Z"],
    ["e", "2026-09-09T00:00:00.000Z"],
  ]);
  const unchanged = withFreshnessBaseline({ facts: git, baseline: new Map(), snapshot: docs, documentIds: ["e"] });
  assert.deepEqual(unchanged, git);
});

test("the committed freshness baseline is well formed and names the hosted bundle", async () => {
  const rows = await readFreshnessBaseline(BASELINE_PATH);
  assert.ok(rows.size > 100);
  for (const id of rows.keys()) assert.ok(!id.startsWith("assistant/"), `${id} is configuration, not hosted content`);
  const bad = await folder({ "b.json": JSON.stringify({ schema: "x", bundle: HOSTED_CONTENT.bundle, documents: [] }) });
  try {
    await assert.rejects(readFreshnessBaseline(path.join(bad, "b.json")), /not a freshness baseline/);
    assert.equal((await readFreshnessBaseline(path.join(bad, "absent.json"))).size, 0);
  } finally {
    await rm(bad, { recursive: true, force: true });
  }
});

test("the workload token client runs one command with the bearer and without GitHub's token request", async () => {
  const app = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const token = `sbw_${"a".repeat(43)}`;
  const jwt = "aaa.bbb.ccc";
  const request = async (url) => {
    if (new URL(url).hostname === "token.actions.example") return new Response(JSON.stringify({ value: jwt }));
    return new Response(JSON.stringify({
      version: 1, token, expiresAt: Date.now() + 900_000,
      workspace: { origin: "https://holaxis-sites.getsuperbee.com", slug: "holaxis-sites" }, bundles: ["superbee-docs"],
    }));
  };
  let child;
  const out = [];
  const code = await runWithToken(["exec", "--", "node", "x.mjs"], {
    env: { DOCS_HOSTED_APP_ID: app, ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.example/t", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "gh" },
    request, out: (s) => out.push(s), log: () => {}, spawnChild: async (command, env) => { child = { command, env }; return 0; },
  });
  assert.equal(code, 0);
  assert.deepEqual(child.command, ["node", "x.mjs"]);
  assert.equal(child.env.SUPERBEE_ACCESS_TOKEN, token);
  assert.equal(child.env.SUPERBEE_HOST, "https://mcp.getsuperbee.com");
  assert.equal(child.env.ACTIONS_ID_TOKEN_REQUEST_URL, undefined);
  assert.equal(child.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, undefined);
  assert.ok(out.includes(`::add-mask::${token}\n`));
  await assert.rejects(runWithToken(["exec", "--", "x"], { env: {} }), /DOCS_HOSTED_APP_ID/);
  const elsewhere = async () => new Response(JSON.stringify({
    version: 1, token, expiresAt: Date.now() + 900_000, workspace: { origin: "https://other.getsuperbee.com", slug: "other" },
  }));
  await assert.rejects(exchange({ app, oidc: jwt, request: elsewhere }), /not https:\/\/holaxis-sites/);
});

test("only the acquire job can mint an OIDC token, in its environment, with no install scripts", async () => {
  const workflow = await readFile(".github/workflows/verify-production.yml", "utf8");
  const body = workflow.slice(workflow.indexOf("\njobs:\n"));
  const jobs = Object.fromEntries(body.split(/\n(?=  [a-z-]+:\n)/u).slice(1).map((block) => [block.match(/^  ([a-z-]+):/u)[1], block]));
  assert.deepEqual(Object.keys(jobs), ["redispatch", "acquire", "build", "reconcile"]);
  assert.equal(workflow.match(/^ +id-token: write$/gmu).length, 1);
  assert.match(jobs.acquire, /id-token: write/u);
  assert.match(jobs.acquire, /environment: holaxis-sites-docs\n/u);
  assert.match(jobs.acquire, /npm ci --ignore-scripts\n/u);
  assert.match(jobs.acquire, /github\.event_name != 'push'/u);
  assert.match(jobs.acquire, /node scripts\/hosted-workload-token\.mjs exec -- \\\n\s+node scripts\/hosted-content\.mjs export /u);
  assert.match(workflow.slice(0, workflow.indexOf("jobs:")), /permissions:\n  contents: read\n/u);
  assert.doesNotMatch(jobs.build, /hosted-workload-token|id-token:/u);
  const names = (await readdir(".github/workflows")).filter((name) => name !== "verify-production.yml");
  for (const name of names) {
    assert.doesNotMatch(await readFile(path.join(".github/workflows", name), "utf8"), /id-token|DOCS_HOSTED_APP_ID/u, name);
  }
});

test("materialize checks the handed-over digest and leaves the old folder whole when it refuses", async () => {
  const exported = await folder({ "index.md": "i", "guides/a.md": "hosted" });
  const bundle = await folder({ "index.md": "old", "assistant/instructions.md": "config" });
  try {
    for (const expectedDigest of ["", "sha256:abc", `sha256:${"0".repeat(64)}`]) {
      await assert.rejects(materialize({ from: exported, bundleDir: bundle, expectedDigest }), /does not match tree digest/);
    }
    assert.equal(await readFile(path.join(bundle, "index.md"), "utf8"), "old");
    const right = await treeDigest(exported, await listFiles(exported));
    await materialize({ from: exported, bundleDir: bundle, expectedDigest: right });
    assert.deepEqual(await listFiles(bundle), ["assistant/instructions.md", "guides/a.md", "index.md"]);
    const siblings = (await readdir(path.dirname(bundle))).filter((name) => name.startsWith(`${path.basename(bundle)}.`));
    assert.deepEqual(siblings, [], "no staging or retired folder is left behind");
  } finally {
    await rm(exported, { recursive: true, force: true });
    await rm(bundle, { recursive: true, force: true });
  }
});

test("materialize refuses a configuration folder that holds a link", async () => {
  const exported = await folder({ "index.md": "i" });
  const bundle = await folder({ "index.md": "old", "assistant/instructions.md": "config" });
  try {
    await symlink("/etc/hosts", path.join(bundle, "assistant", "hosts.md"));
    await assert.rejects(materialize({ from: exported, bundleDir: bundle }), /symbolic link/);
    assert.equal(await readFile(path.join(bundle, "index.md"), "utf8"), "old");
  } finally {
    await rm(exported, { recursive: true, force: true });
    await rm(bundle, { recursive: true, force: true });
  }
});

test("materialize refuses a linked bundle or configuration folder, a source inside it, and a differently cased config path", async () => {
  const exported = await folder({ "index.md": "i" });
  const victim = await folder({ "precious.txt": "keep" });
  const parent = await folder({});
  try {
    const linked = path.join(parent, "linked");
    await symlink(victim, linked);
    await assert.rejects(materialize({ from: exported, bundleDir: linked }), /not a folder/);
    assert.equal(await readFile(path.join(victim, "precious.txt"), "utf8"), "keep");

    const bundle = path.join(parent, "bundle");
    await mkdir(path.join(bundle, "guides"), { recursive: true });
    await writeFile(path.join(bundle, "index.md"), "old");
    await symlink(victim, path.join(bundle, "assistant"));
    await assert.rejects(materialize({ from: exported, bundleDir: bundle }), /not a folder/);
    await rm(path.join(bundle, "assistant"));
    await writeFile(path.join(bundle, "guides", "index.md"), "nested");
    await assert.rejects(materialize({ from: path.join(bundle, "guides"), bundleDir: bundle }), /is inside/);
    assert.equal(await readFile(path.join(bundle, "index.md"), "utf8"), "old");

    const cased = await folder({ "index.md": "i", "Assistant/instructions.md": "x" });
    await assert.rejects(materialize({ from: cased, bundleDir: bundle }), /is configuration/);
    await rm(cased, { recursive: true, force: true });
  } finally {
    for (const dir of [exported, victim, parent]) await rm(dir, { recursive: true, force: true });
  }
});
