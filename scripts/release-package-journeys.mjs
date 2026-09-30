import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scripts = path.dirname(fileURLToPath(import.meta.url));

export async function currentPackageFacts(root) {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const evidence = await readFile(path.join(root, ".superbee/sources/current-release.md"), "utf8");
  const sourceCommit = evidence.match(/^\| source commit \| `([a-f0-9]{40})` \|$/m)?.[1];
  const version = evidence.match(/^version: ['"]?(\d+\.\d+\.\d+)['"]?$/m)?.[1];
  assert.equal(pkg.dependencies?.superbee, version, "installed-package journey requires the current exact package pin");
  assert.ok(sourceCommit, "installed-package journey requires current source evidence");
  return { version, sourceCommit };
}

export async function packageJourneys({ bin, facts }) {
  // Outside the repository: init must never adopt the enclosing docs bundle. Closed child env
  // prevents real private state, credential, Node preload, and hosted environment inheritance.
  const workspace = await realpath(await mkdtemp(path.join(tmpdir(), "superbee-release-journey-")));
  const local = path.join(workspace, "local");
  const hosted = path.join(workspace, "checkout");
  let commands = 0;
  const env = { PATH: process.env.PATH, HOME: workspace, TMPDIR: workspace, XDG_CONFIG_HOME: workspace,
    XDG_STATE_HOME: workspace, LOCALAPPDATA: workspace, CI: "1", SUPERBEE_NO_AUTOPULL: "1",
    SUPERBEE_NO_UPDATE_CHECK: "1", SUPERBEE_NO_TURN_SYNC: "1" };
  function run(args, { expected = 0, fixture = false } = {}) {
    const preload = path.join(scripts, "release-journey-fixtures", fixture ? "host-fixture.mjs" : "no-network.mjs");
    const result = spawnSync(process.execPath, ["--import", preload, bin, ...args], {
      env: { ...env, ...(fixture ? { SUPERBEE_HOST: "https://hosted.example", SUPERBEE_ACCESS_TOKEN: "fabricated-fixture-value" } : {}) },
      cwd: workspace, encoding: "utf8", timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
    });
    commands++;
    // Raw subprocess output and temporary paths never enter handoff receipts or CI diagnostics.
    if (result.error || result.signal || result.status !== expected) throw new Error(`Package journey ${args.slice(0, 2).join(" ")} failed: expected exit ${expected}`);
    return result.stdout;
  }
  const json = (args, options) => JSON.parse(run([...args, "--json"], options));
  // CLI failures retain their structured TOON envelope even with --json. Read only the stable
  // machine code; failure text can contain paths and must not escape this isolated process.
  const refusal = (args, options) => {
    const output = run([...args, "--json"], options);
    return output.match(/^  code: ([A-Z_]+)$/m)?.[1];
  };
  try {
    const { identity } = json(["version"]);
    assert.equal(identity.package?.name, "superbee");
    assert.equal(identity.package?.version, facts.version);
    assert.equal(identity.source?.commit, facts.sourceCommit);
    assert.equal(identity.source?.dirty, false);
    assert.equal(identity.artifact?.channel, "npm-package");
    assert.match(identity.artifact?.sha256 ?? "", /^sha256:[a-f0-9]{64}$/);
    if (facts.artifact) assert.equal(identity.artifact.sha256, facts.artifact.sha256);
    json(["init", "--dir", local, "--create-only", "--recipe", "none"]);
    json(["doc", "write", "notes/one", "--type", "Note", "--title", "Original", "--body", "Full original body.", "--actor", "process:release-journey", "--dir", local]);
    const bodyFile = path.join(workspace, "body.md");
    const read = json(["doc", "read", "notes/one", "--body-out", bodyFile, "--dir", local]);
    assert.equal((await readFile(bodyFile, "utf8")).trim(), "Full original body.");
    await writeFile(bodyFile, "Reviewed complete replacement body.\n");
    json(["doc", "update", "notes/one", "--body-file", bodyFile, "--expected-version", read.version, "--dir", local]);
    const stale = refusal(["doc", "update", "notes/one", "--title", "Stale overwrite", "--expected-version", read.version, "--dir", local], { expected: 5 });
    assert.equal(stale, "STALE_HEAD");
    const final = json(["doc", "read", "notes/one", "--dir", local]);
    assert.equal(final.title, "Original");
    assert.equal(final.body.trim(), "Reviewed complete replacement body.");
    for (const [id, governs, order] of [["z-first", "Zulu", 10], ["a-second", "Alpha", 20], ["m-last", "Middle", undefined]]) {
      const source = path.join(workspace, `${id}.md`);
      await writeFile(source, `---\ntype: Convention\ngoverns: ${governs}\n${order === undefined ? "" : `order: ${order}\n`}---\n# Purpose\nFixture only.\n`);
      json(["promote", source, "--doc-key", `conventions/${id}.md`, "--dir", local]);
    }
    const kinds = json(["kinds", "--dir", local]);
    assert.deepEqual(kinds.kinds.map((kind) => kind.governs), ["Zulu", "Alpha", "Middle"]);
    assert.deepEqual(kinds.kinds.map((kind) => kind.order), [10, 20, undefined]);
    for (const args of [["login"], ["whoami"], ["logout"], ["checkout"], ["op"], ["publish"], ["export"], ["setup", "hosted"], ["sync"], ["hook"]]) run([...args, "--help"]);
    assert.deepEqual(json(["op", "list", "--dir", local]).operations, []);
    const refused = refusal(["op", "run", "documents.history.v1", "--dir", local], { expected: 2 });
    assert.equal(refused, "NOT_IMPLEMENTED");
    json(["checkout", "team.knowledge", "--host", "https://hosted.example", "--dir", hosted], { fixture: true });
    assert.equal(json(["doc", "read", "notes/alpha", "--dir", hosted], { fixture: true }).body, "Alpha body é.\n");
    json(["doc", "update", "notes/alpha", "--title", "Unsent fixture title", "--dir", hosted], { fixture: true });
    assert.equal(json(["doc", "read", "notes/alpha", "--dir", hosted], { fixture: true }).title, "Unsent fixture title");
    assert.ok(json(["op", "list", "--dir", hosted], { fixture: true }).operations.some((op) => op.id === "documents.history.v1"));
    const folder = refusal(["op", "run", "documents.read.v1", "--dir", hosted], { expected: 2, fixture: true });
    assert.equal(folder, "USAGE");
    return { schema: "superbee-docs-package-journeys.v1", status: "passed", commands, platform: process.platform,
      node: process.version, identity: { package: identity.package, source: identity.source, artifact: identity.artifact },
      checks: ["local document CAS and stale refusal", "Kind reading order", "hosted command help",
        "local operation refusal", "fixture checkout hydration and unsent reads", "fixture operation discovery and folder read refusal"],
      limits: "No production credentials or calls; no live OAuth, hosted sync write, conflict/deletion/transfer or live AI-host acceptance." };
  } catch {
    throw new Error("Installed-package journeys failed; inspect the isolated fixture or package contract locally. Raw subprocess output and temporary state are not published.");
  } finally { await rm(workspace, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const root = process.cwd();
    console.log(JSON.stringify(await packageJourneys({ bin: path.join(root, "node_modules/.bin/superbee"), facts: await currentPackageFacts(root) })));
  } catch (error) { console.error(JSON.stringify({ status: "blocked", reason: error.message })); process.exitCode = 1; }
}
