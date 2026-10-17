import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { HostedCarrierError } from "@superbee/core/hosted-client";
import { ExportArchiveError, HostedExportError } from "@superbee/core/hosted-client/node";

import {
  BASELINE_PATH,
  BUNDLE_PATH,
  HOSTED_CONTENT,
  checkCounts,
  checkExport,
  checkReceipt,
  compareTrees,
  exportHosted,
  exportPath,
  exportReceipt,
  exportThroughCli,
  libraryFailure,
  listFiles,
  materialize,
  materializeSnapshot,
  selectSnapshot,
  RECEIPT_SCHEMA,
  readFreshnessBaseline,
  treeDigest,
  withFreshnessBaseline,
} from "../scripts/hosted-content.mjs";
import { exchange, run as runWithToken } from "../scripts/hosted-workload-token.mjs";
import { exportArchive, exportHost } from "./hosted-export-fixture.mjs";

async function folder(files) {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-hosted-test-"));
  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), text);
  }
  return root;
}

test("materialize makes a reader folder exactly the hosted export", async () => {
  const exported = await folder({ "index.md": "i", "guides/a.md": "hosted a", "visuals/x.svg": "<svg/>" });
  const bundle = await folder({
    "index.md": "old",
    "guides/a.md": "git a",
    "guides/stale.md": "removed on the host",
  });
  try {
    const placed = await materialize({ from: exported, bundleDir: bundle });
    assert.deepEqual(await listFiles(bundle), [
      "guides/a.md", "index.md", "visuals/x.svg",
    ]);
    assert.equal(await readFile(path.join(bundle, "guides/a.md"), "utf8"), "hosted a");
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

test("without a bearer, export runs the pinned CLI with the person's session and checks its receipt", async () => {
  const calls = [];
  const ok = { export: "created", bundle_id: "superbee-docs", host: HOSTED_CONTENT.gateway, revision: 3, documents: 2, reserved: 1, blobs: 0, bytes: 9, root_index: true };
  const fake = (answer, status = 0) => (command, args, options) => {
    calls.push({ command, args, env: options.env });
    return { status, stdout: JSON.stringify(answer), stderr: "" };
  };
  assert.equal(exportPath({}), "cli");
  assert.equal(exportPath({ SUPERBEE_ACCESS_TOKEN: "" }), "cli");
  assert.deepEqual(await exportHosted({ to: "/x", env: {}, run: fake(ok), fetch: () => assert.fail("no request without a bearer") }), ok);
  assert.deepEqual(calls.at(-1).args.slice(1), ["export", HOSTED_CONTENT.bundle, "--host", HOSTED_CONTENT.gateway, "--to", "/x", "--json"]);
  assert.match(calls.at(-1).args[0], /node_modules\/superbee\/dist\/superbee\.mjs$/u);
  // The override replaces the CLI only on this path.
  await exportHosted({ to: "/x", env: { HOSTED_CONTENT_SUPERBEE: "/local/superbee.mjs" }, run: fake(ok) });
  assert.equal(calls.at(-1).args[0], "/local/superbee.mjs");
  await assert.rejects(exportHosted({ to: "/x", env: {}, run: fake({ ...ok, bundle_id: "other" }) }), /no export of superbee-docs/);
  await assert.rejects(exportHosted({ to: "/x", env: {}, run: fake({ ...ok, documents: 0 }) }), /no documents/);
  await assert.rejects(exportHosted({ to: "/x", env: {}, run: fake({ error: { message: "denied" } }, 4) }), /exit 4\): denied/);
  await assert.rejects(exportHosted({ to: "/x", env: {}, run: fake({ ...ok, root_index: false }) }), /no root index/);
  await assert.rejects(exportHosted({ to: "/x", env: {}, run: fake({ ...ok, host: "https://elsewhere" }) }), /not https:\/\/mcp/);
  await assert.rejects(exportHosted({ to: "", env: {}, run: fake(ok) }), /needs --to/);
  checkCounts(ok, ["a", "b", "index.md"]);
  assert.throws(() => checkCounts(ok, ["a", "index.md"]), /holds 2 files, but its receipt counts 3/);
});

test("the library path's receipt invariants refuse what the CLI path's refuse", () => {
  const ok = { export: "created", bundle_id: "superbee-docs", host: HOSTED_CONTENT.gateway, revision: 3, documents: 2, reserved: 1, blobs: 0, bytes: 9, root_index: true };
  assert.equal(checkReceipt(ok), ok);
  for (const [change, message] of [
    [{ bundle_id: "other" }, /no export of superbee-docs/],
    [{ export: undefined }, /no export of superbee-docs/],
    [{ documents: 0 }, /no documents/],
    [{ root_index: false }, /no root index/],
    [{ reserved: 0 }, /no root index/],
    [{ revision: -1 }, /no revision/],
    [{ bytes: 1.5 }, /no bytes/],
    [{ host: "https://elsewhere" }, /not https:\/\/mcp/],
  ]) assert.throws(() => checkReceipt({ ...ok, ...change }), message, JSON.stringify(change));
  assert.equal(HOSTED_CONTENT.bundle, `${HOSTED_CONTENT.workspace}/${HOSTED_CONTENT.bundleId}`);
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
    assert.deepEqual(await listFiles(bundle), ["guides/a.md", "index.md"]);
    const siblings = (await readdir(path.dirname(bundle))).filter((name) => name.startsWith(`${path.basename(bundle)}.`));
    assert.deepEqual(siblings, [], "no staging or retired folder is left behind");
  } finally {
    await rm(exported, { recursive: true, force: true });
    await rm(bundle, { recursive: true, force: true });
  }
});

test("materialize cannot overwrite a bound or copied writer checkout", async () => {
  const exported = await folder({ "index.md": "i" });
  const bundle = await folder({ "index.md": "unsent edit", ".superbee/checkout.json": "{}" });
  try {
    await assert.rejects(materialize({ from: exported, bundleDir: bundle }), /writer checkout/);
    assert.equal(await readFile(path.join(bundle, "index.md"), "utf8"), "unsent edit");
  } finally { for (const dir of [exported, bundle]) await rm(dir, { recursive: true, force: true }); }
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

test("materialize refuses a linked source export and leaves it untouched", async () => {
  const exported = await folder({ "index.md": "i" });
  const parent = await folder({});
  const bundle = await folder({ "index.md": "old", "assistant/instructions.md": "config" });
  try {
    const linked = path.join(parent, "export");
    await symlink(exported, linked);
    await assert.rejects(materialize({ from: linked, bundleDir: bundle }), /not a folder/);
    assert.deepEqual(await listFiles(exported), ["index.md"], "the source gains no assistant/");
    assert.equal(await readFile(path.join(bundle, "index.md"), "utf8"), "old");
  } finally {
    for (const dir of [exported, parent, bundle]) await rm(dir, { recursive: true, force: true });
  }
});


const TOKEN = `sbw_${"t".repeat(43)}`;
const WORKLOAD = { SUPERBEE_ACCESS_TOKEN: TOKEN, SUPERBEE_HOST: HOSTED_CONTENT.gateway };
const SITE = { "index.md": "# Docs\n", "guides/a.md": "---\ntype: Guide\n---\n# A\n", "guides/index.md": "# Guides\n", "visuals/x.svg": "<svg/>" };

/** The export folder and receipt.json the library path writes for `archive`, or its refusal. */
async function libraryExport(archive, { env = WORKLOAD, answer } = {}) {
  const parent = await folder({});
  const host = exportHost(archive, { answer });
  const to = path.join(parent, "export");
  try {
    const receipt = await exportReceipt(await exportHosted({ to, env, fetch: host.fetch, run: () => assert.fail("no CLI with a bearer") }), to);
    return { parent, to, receipt, requests: host.requests };
  } catch (error) {
    return { parent, to, error, requests: host.requests };
  }
}

test("with a bearer, export downloads through the library from the gateway constant only", async () => {
  assert.equal(exportPath(WORKLOAD), "library");
  const { parent, to, receipt, requests, error } = await libraryExport(exportArchive(SITE));
  try {
    assert.equal(error, undefined);
    assert.ok(requests.length >= 1);
    for (const request of requests) {
      assert.equal(new URL(request.url).origin, HOSTED_CONTENT.gateway);
      assert.equal(new URL(request.url).pathname, "/sync/v1/export");
      assert.equal(request.authorization, `Bearer ${TOKEN}`);
      assert.equal(request.body.bundleId, HOSTED_CONTENT.bundle, "the bundle is qualified by its workspace");
    }
    assert.deepEqual(await listFiles(to), ["guides/a.md", "guides/index.md", "index.md", "visuals/x.svg"]);
    assert.equal(await readFile(path.join(to, "guides/a.md"), "utf8"), SITE["guides/a.md"]);
    assert.deepEqual(receipt, {
      schema: RECEIPT_SCHEMA, bundle: HOSTED_CONTENT.bundle, host: HOSTED_CONTENT.gateway, revision: 7,
      exportedAt: "2026-10-17T12:00:00.000Z", documents: 1, reserved: 2, blobs: 1,
      bytes: Object.values(SITE).reduce((sum, text) => sum + Buffer.byteLength(text), 0), files: 4,
      treeDigest: await treeDigest(to, await listFiles(to)),
    });
    assert.deepEqual((await readdir(parent)).sort(), ["export"], "no staging folder is left beside the export");
    // The snapshot consumer accepts exactly this receipt and tree.
    await writeFile(path.join(parent, "receipt.json"), JSON.stringify(receipt));
    const bundle = await folder({ "index.md": "old" });
    try {
      const placed = await materializeSnapshot({ directory: parent, bundleDir: bundle });
      assert.equal(placed.treeDigest, receipt.treeDigest);
    } finally { await rm(bundle, { recursive: true, force: true }); }
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test("the library and the pinned CLI write the same tree, tree digest and receipt for the same hosted export", async () => {
  const archive = exportArchive(SITE);
  const library = await libraryExport(archive);
  const root = await folder({});
  const preload = path.join(root, "transport.mjs");
  try {
    assert.equal(library.error, undefined);
    // The pinned CLI as CI ran it before (a workload bearer), against the same synthetic host.
    await writeFile(preload, `
      import os from "node:os";
      import { syncBuiltinESMExports } from "node:module";
      import { exportArchive, exportHost } from ${JSON.stringify(pathToFileURL(path.resolve("test/hosted-export-fixture.mjs")).href)};
      os.homedir = () => ${JSON.stringify(path.join(root, "home"))};
      syncBuiltinESMExports();
      globalThis.fetch = exportHost(exportArchive(${JSON.stringify(SITE)})).fetch;
    `);
    const to = path.join(root, "export");
    const cli = exportThroughCli({
      to, env: { ...process.env, ...WORKLOAD },
      run: (command, args, options) => spawnSync(command, ["--import", pathToFileURL(preload).href, ...args], options),
    });
    const fromCli = await exportReceipt(checkReceipt(cli), to);
    assert.deepEqual(library.receipt, fromCli);
    assert.deepEqual(await compareTrees(library.to, to), { identical: 4, differ: [], onlyLeft: [], onlyRight: [] });
  } finally { for (const dir of [library.parent, root]) await rm(dir, { recursive: true, force: true }); }
});

test("a SUPERBEE_HOST other than the gateway constant is refused before the bearer is sent", async () => {
  for (const host of ["https://elsewhere.example", "https://mcp.getsuperbee.com.evil.example", "http://mcp.getsuperbee.com", undefined]) {
    const { parent, error, requests } = await libraryExport(exportArchive(SITE), { env: { SUPERBEE_ACCESS_TOKEN: TOKEN, SUPERBEE_HOST: host } });
    try {
      assert.match(error?.message ?? "", /not https:\/\/mcp\.getsuperbee\.com; the workload bearer is sent only to/);
      assert.deepEqual(requests, [], `no request for ${host}`);
      assert.deepEqual(await readdir(parent), []);
    } finally { await rm(parent, { recursive: true, force: true }); }
  }
});

test("the library path refuses each receipt invariant and the configuration and dot entries", async () => {
  const cases = [
    [exportArchive(SITE, { bundleId: "other" }), /verification: wrong_bundle/],
    [exportArchive({ "index.md": "# Docs\n", "visuals/x.svg": "<svg/>" }), /no documents/],
    [exportArchive({ "guides/a.md": "# A\n", "guides/index.md": "# G\n" }), /no root index/],
    [exportArchive({ "guides/a.md": "# A\n" }), /no root index/],
    [exportArchive({ ...SITE, "assistant/instructions.md": "# x\n" }), /assistant\/ is configuration/],
    [exportArchive({ ...SITE, ".superbee/checkout.json": "{}" }), /verification: unsafe_path/],
    [exportArchive({ ...SITE, "guides/.hidden.md": "# h\n" }), /verification: unsafe_path/],
    [exportArchive(SITE, { tamper: "guides/a.md" }), /verification: manifest_mismatch/],
  ];
  for (const [archive, message] of cases) {
    const { parent, error } = await libraryExport(archive);
    try {
      assert.match(error?.message ?? "", message);
      if (!/configuration/.test(message.source)) assert.deepEqual(await readdir(parent), [], "nothing is written for a refused export");
    } finally { await rm(parent, { recursive: true, force: true }); }
  }
  // A dot entry that reached the folder is refused by the folder check as well.
  const dotted = await folder({ "index.md": "i", "guides/.x.md": "x" });
  try { await assert.rejects(checkExport(dotted), /dot entry/); } finally { await rm(dotted, { recursive: true, force: true }); }
  // A non-empty folder or one inside the bundle is refused before any request.
  const full = await folder({ "keep.md": "k" });
  try {
    const host = exportHost(exportArchive(SITE));
    await assert.rejects(exportHosted({ to: full, env: WORKLOAD, fetch: host.fetch }), /exists; export needs a new folder/);
    await assert.rejects(exportHosted({ to: path.join(BUNDLE_PATH, "x"), env: WORKLOAD, fetch: host.fetch }), /is inside/);
    assert.deepEqual(host.requests, []);
  } finally { await rm(full, { recursive: true, force: true }); }
});

test("the library's typed failures become the existing user-facing failures, never with the bearer", async () => {
  const refused = (code, status) => () => Response.json({ error: { code, message: `refused ${TOKEN}`, retryable: false } }, { status });
  const timeout = () => { throw Object.assign(new Error(`timed out ${TOKEN}`), { name: "AbortError" }); };
  const cases = [
    [refused("unauthenticated", 401), /\(auth\): the host refused the workload bearer \(401 unauthenticated\)/],
    [refused("PERMISSION_DENIED", 403), /\(auth\): the workload bearer may not export/],
    [refused("bundle_not_found", 404), /\(not found\): no hosted bundle holaxis-sites\/superbee-docs/],
    [() => Response.json({ error: "not_found" }, { status: 404 }), /\(route not served\): the host does not serve \/sync\/v1\/export/],
    [timeout, /\(deadline\): no answer within 60 s/],
    [() => { throw new TypeError(`fetch failed ${TOKEN}`); }, /\(unavailable\)/],
    [refused("RUNTIME", 500), /\(refused\): the host answered 500 RUNTIME/],
  ];
  for (const [answer, message] of cases) {
    const { parent, error } = await libraryExport(exportArchive(SITE), { answer });
    try {
      assert.match(error?.message ?? "", message);
      assert.match(error.message, /^hosted export of holaxis-sites\/superbee-docs from https:\/\/mcp\.getsuperbee\.com failed/);
      assert.equal(error.message.includes(TOKEN), false);
      assert.equal(error.cause, undefined, "no transport error rides along to a log");
      assert.equal(error.exit, 1);
      assert.deepEqual(await readdir(parent), []);
    } finally { await rm(parent, { recursive: true, force: true }); }
  }
  // Every typed failure maps, and a message that names the bearer is redacted.
  assert.match(libraryFailure(new HostedExportError("stopped", "superbee-docs", "x")), /\(deadline\): the export stopped part way/);
  assert.match(libraryFailure(new HostedExportError("too_large", "superbee-docs", "x", { maximum: 5 })), /\(verification\): the export is larger than 5 bytes/);
  assert.match(libraryFailure(new HostedExportError("source_changed", "superbee-docs", "x")), /\(source changed\)/);
  assert.match(libraryFailure(new ExportArchiveError("incomplete", "cut")), /\(verification: incomplete\): cut/);
  assert.match(libraryFailure(new HostedCarrierError("denied")), /\(auth\): no credential/);
  const { parent, error } = await libraryExport(exportArchive(SITE), { answer: () => { throw Object.assign(new Error("x"), { name: "Oops" }); } });
  try { assert.equal(error.message.includes(TOKEN), false); } finally { await rm(parent, { recursive: true, force: true }); }
  // A verifier message naming a path that carries the bearer's text is redacted.
  const leaky = `guides/${TOKEN}.md`;
  const tampered = await libraryExport(exportArchive({ ...SITE, [leaky]: "# t\n" }, { tamper: leaky }));
  try {
    assert.match(tampered.error.message, /verification: manifest_mismatch\): guides\/\[redacted\]\.md does not match/);
    assert.equal(tampered.error.message.includes(TOKEN), false);
  } finally { await rm(tampered.parent, { recursive: true, force: true }); }
});

const trustedRun = {
  id: 42, status: "completed", conclusion: "success", head_branch: "main", event: "workflow_dispatch",
  path: ".github/workflows/verify-production.yml", head_sha: "a".repeat(40),
  repository: { id: 1349797123 }, head_repository: { id: 1349797123 },
};
const retainedArtifact = { id: 123, name: "superbee-docs-hosted-content-42", expired: false, expires_at: "2099-01-01T00:00:00Z" };

test("CI snapshot selects only a retained export from a successful trusted main production run", async () => {
  const select = (run = trustedRun, artifact = retainedArtifact, ancestor = true) => selectSnapshot({
    api: async (endpoint) => endpoint.includes("/artifacts?") ? { artifacts: [artifact] } : { workflow_runs: [run] },
    isMainAncestor: async () => ancestor,
  });
  assert.deepEqual(await select(), { runId: 42, sourceCommit: "a".repeat(40), artifactId: 123, name: retainedArtifact.name });
  for (const change of [{ event: "pull_request" }, { conclusion: "failure" }, { status: "in_progress" },
    { head_branch: "feature" }, { path: ".github/workflows/other.yml" }, { head_repository: { id: 99 } },
    { repository: { id: 99 } }]) await assert.rejects(select({ ...trustedRun, ...change }), /no retained verified main/);
  for (const change of [{ expired: true }, { expires_at: "2000-01-01T00:00:00Z" }, { name: "other" }]) {
    await assert.rejects(select(trustedRun, { ...retainedArtifact, ...change }), /no retained verified main/);
  }
  await assert.rejects(select(trustedRun, retainedArtifact, false), /no retained verified main/);
});

test("snapshot receipt and complete content bytes are checked before replacing the reader tree", async () => {
  const root = await folder({ "export/index.md": "i", "export/guides/a.md": "page" });
  const bundle = await folder({ "index.md": "keep" });
  const receipt = {
    schema: RECEIPT_SCHEMA, bundle: HOSTED_CONTENT.bundle, host: HOSTED_CONTENT.gateway,
    revision: 3, exportedAt: "2026-10-16T00:00:00.000Z", documents: 1, reserved: 1, blobs: 0,
    bytes: 5, files: 2, treeDigest: await treeDigest(path.join(root, "export"), ["guides/a.md", "index.md"]),
  };
  try {
    for (const change of [{ host: "https://elsewhere" }, { bundle: "other" }, { files: 3 }, { bytes: 6 }, { treeDigest: V(0) }]) {
      await writeFile(path.join(root, "receipt.json"), JSON.stringify({ ...receipt, ...change }));
      await assert.rejects(materializeSnapshot({ directory: root, bundleDir: bundle }));
      assert.equal(await readFile(path.join(bundle, "index.md"), "utf8"), "keep");
    }
    await writeFile(path.join(root, "receipt.json"), JSON.stringify(receipt));
    const placed = await materializeSnapshot({ directory: root, bundleDir: bundle });
    assert.equal(placed.revision, 3);
    assert.deepEqual(await listFiles(bundle), ["guides/a.md", "index.md"]);
  } finally { for (const dir of [root, bundle]) await rm(dir, { recursive: true, force: true }); }
});
