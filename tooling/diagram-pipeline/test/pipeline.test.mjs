import assert from "node:assert/strict";
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { checkAgreement, compileAll, expectedViewMarkdown } from "../src/index.mjs";

async function fixture(source = "flowchart LR\n  accTitle: Example\n  accDescr: Example flow\n  A --> B\n") {
  const root = await mkdtemp(join(tmpdir(), "diagram-pipeline-test-"));
  await mkdir(join(root, "diagrams"), { recursive: true });
  await writeFile(join(root, "diagrams/example.mmd"), source);
  await writeFile(join(root, "diagrams/manifest.json"), JSON.stringify({
    schema: "https://getsuperbee.com/schemas/docs-diagrams/v1",
    renderer: "superbee-docs-mermaid-v1+mermaid@11.17.2+puppeteer@25.9.0+atkinson-hyperlegible@5.3.0",
    diagrams: [{
      id: "example", title: "Example", description: "Example diagram.", source: "diagrams/example.mmd",
      publishedSource: "visuals/sources/example.mmd", documentId: "architecture/example",
      viewId: "views-registry/example", entry: "views/example.html", access: "none",
    }],
  }));
  return root;
}

const accessibleSvg = `<svg xmlns="http://www.w3.org/2000/svg" aria-labelledby="title desc"><title id="title">Example</title><desc id="desc">Example flow</desc><path d="M0 0L1 1"/></svg>`;

test("compiler produces source-bound, self-contained accessible HTML", async () => {
  const root = await fixture();
  let rendererCss;
  const runner = async ({ outputPath, fontCss }) => {
    rendererCss = fontCss;
    await writeFile(outputPath, accessibleSvg);
  };
  const first = await compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "first"), runner });
  const second = await compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "second"), runner });
  assert.equal(first.rows[0].entrySha256, second.rows[0].entrySha256);
  const html = await readFile(first.rows[0].htmlPath, "utf8");
  assert.match(html, /Source document: <code>architecture\/example<\/code>/);
  assert.match(html, /<meta name="superbee-diagram-renderer" content="superbee-docs-mermaid-v1/);
  assert.match(html, /<meta name="superbee-diagram-projection" content="sha256:[a-f0-9]{64}">/);
  assert.match(html, /@font-face\{font-family:'Atkinson Hyperlegible';src:url\(data:font\/woff2;base64,/);
  assert.match(html, /svg\{display:block;min-width:44rem;max-width:none/);
  assert.match(rendererCss, /data:font\/woff2;base64,/);
  assert.match(html, /Copyright 2020 Braille Institute of America, Inc\./);
  assert.match(html, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.doesNotMatch(html, /<script\b/i);
});

async function publishFixture(root, runner) {
  const built = await compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "built"), runner });
  const row = built.rows[0];
  await mkdir(join(root, ".superbee/visuals/sources"), { recursive: true });
  await mkdir(join(root, ".superbee/views"), { recursive: true });
  await mkdir(join(root, ".superbee/views-registry"), { recursive: true });
  await copyFile(row.sourcePath, join(root, ".superbee", row.publishedSource));
  await copyFile(row.htmlPath, join(root, ".superbee", row.entry));
  await writeFile(join(root, ".superbee", `${row.viewId}.md`), expectedViewMarkdown(row));
  await writeFile(join(root, "portal.config.json"), JSON.stringify({
    views: [{ id: row.viewId, entry: row.entry, access: row.access, entrySha256: row.entrySha256 }],
  }));
  await writeFile(join(root, "diagrams/publications.json"), JSON.stringify({
    schema: "https://getsuperbee.com/schemas/docs-diagram-publications/v1",
    diagrams: [{ id: row.id, publishedSource: row.publishedSource, viewId: row.viewId, entry: row.entry }],
  }));
  return row;
}

test("agreement accepts platform-specific renderer geometry", async () => {
  const root = await fixture();
  const publishedRunner = async ({ outputPath }) => writeFile(outputPath, accessibleSvg);
  await publishFixture(root, publishedRunner);
  const otherPlatformRunner = async ({ outputPath }) => writeFile(
    outputPath,
    accessibleSvg.replace('d="M0 0L1 1"', 'd="M0 0L1.25 1"'),
  );
  const result = await checkAgreement({ root, manifestPath: "diagrams/manifest.json", runner: otherPlatformRunner });
  assert.equal(result.count, 1);
  assert.equal(result.rows[0].verified, true);
});

test("agreement rejects stale source-bound View provenance", async () => {
  const root = await fixture();
  const runner = async ({ outputPath }) => writeFile(outputPath, accessibleSvg);
  await publishFixture(root, runner);
  const manifestPath = join(root, "diagrams/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.diagrams[0].title = "Changed title";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(
    checkAgreement({ root, manifestPath: "diagrams/manifest.json", runner }),
    /published View provenance is stale/,
  );
});

test("agreement rejects registration metadata and body drift", async () => {
  const root = await fixture();
  const runner = async ({ outputPath }) => writeFile(outputPath, accessibleSvg);
  const row = await publishFixture(root, runner);
  const registrationPath = join(root, ".superbee", `${row.viewId}.md`);
  await writeFile(registrationPath, expectedViewMarkdown({ ...row, title: "Wrong title" }));
  await assert.rejects(
    checkAgreement({ root, manifestPath: "diagrams/manifest.json", runner }),
    /registration is stale/,
  );
  await writeFile(registrationPath, `${expectedViewMarkdown(row)}Unexpected extra body.\n`);
  await assert.rejects(
    checkAgreement({ root, manifestPath: "diagrams/manifest.json", runner }),
    /registration is stale/,
  );
});

test("agreement rejects stale managed publication ownership", async () => {
  const root = await fixture();
  const runner = async ({ outputPath }) => writeFile(outputPath, accessibleSvg);
  await publishFixture(root, runner);
  const statePath = join(root, "diagrams/publications.json");
  const state = JSON.parse(await readFile(statePath, "utf8"));
  state.diagrams[0].entry = "views/previous-example.html";
  await writeFile(statePath, JSON.stringify(state));
  await assert.rejects(
    checkAgreement({ root, manifestPath: "diagrams/manifest.json", runner }),
    /publication state is stale/,
  );
});

test("compiler rejects Mermaid without an accessible description", async () => {
  const root = await fixture("flowchart LR\n  accTitle: Example\n  A --> B\n");
  await assert.rejects(
    compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "out"), runner: async () => {} }),
    /requires accDescr/,
  );
});

test("compiler rejects executable renderer output", async () => {
  const root = await fixture();
  await assert.rejects(
    compileAll({
      root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "out"),
      runner: async ({ outputPath }) => writeFile(outputPath, `<svg><title>x</title><desc>x</desc><script>alert(1)</script></svg>`),
    }),
    /executable markup/,
  );
});

test("compiler rejects empty rendered accessibility text", async () => {
  const root = await fixture("flowchart LR\n  accTitle: Example\n  accDescr {\n  }\n  A --> B\n");
  await assert.rejects(
    compileAll({
      root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "out"),
      runner: async ({ outputPath }) => writeFile(outputPath, `<svg><title>Example</title><desc> &#160; </desc></svg>`),
    }),
    /lacks an accessible title or description/,
  );
});

test("compiler rejects source outside pinned glyph coverage", async () => {
  const root = await fixture("flowchart LR\n  accTitle: Example\n  accDescr: Example flow\n  A[\"日本語\"] --> B\n");
  let rendered = false;
  await assert.rejects(
    compileAll({
      root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "out"),
      runner: async () => { rendered = true; },
    }),
    /source contains unsupported character U\+65E5/,
  );
  assert.equal(rendered, false);
});

test("manifest rejects publication paths outside diagram ownership", async () => {
  const root = await fixture();
  const manifestPath = join(root, "diagrams/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.diagrams[0].viewId = "architecture/example";
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(
    compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "out"), runner: async () => {} }),
    /viewId must be 'views-registry\/example'/,
  );
});

test("compiler rejects nondeterministic Mermaid modes and directives", async (context) => {
  const cases = [
    ["init override", "%%{init: {\"fontFamily\": \"Arial\"}}%%\nflowchart LR\n  accTitle: Example\n  accDescr: Example flow\n  A --> B\n"],
    ["journey defaults", "journey\n  accTitle: Example\n  accDescr: Example journey\n  title Example\n  section Work\n    Review docs: 5: Human\n"],
    ["implicit git commit id", "gitGraph\n  accTitle: Example\n  accDescr: Example history\n  commit\n"],
    ["clock-dependent Gantt marker", "gantt\n  accTitle: Example\n  accDescr: Example schedule\n  title Example\n  section Work\n  Task: 2026-01-01, 1d\n"],
    ["font override", "flowchart LR\n  accTitle: Example\n  accDescr: Example flow\n  A --> B\n  classDef override font-family:Arial\n  class A override\n"],
  ];
  for (const [name, source] of cases) {
    await context.test(name, async () => {
      const root = await fixture(source);
      let rendered = false;
      await assert.rejects(
        compileAll({
          root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "out"),
          runner: async () => { rendered = true; },
        }),
        /must use directive-free flowchart syntax in v1/,
      );
      assert.equal(rendered, false);
    });
  }
});

test("compiler rejects source symlinks before rendering", async () => {
  const root = await fixture();
  const externalRoot = await mkdtemp(join(tmpdir(), "diagram-pipeline-external-"));
  const externalSource = join(externalRoot, "private.mmd");
  await writeFile(externalSource, "flowchart LR\n  accTitle: Private\n  accDescr: Private flow\n  A --> B\n");
  await rm(join(root, "diagrams/example.mmd"));
  await symlink(externalSource, join(root, "diagrams/example.mmd"));
  let rendered = false;
  await assert.rejects(
    compileAll({
      root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "out"),
      runner: async () => { rendered = true; },
    }),
    /must be a regular file beneath the real repository root/,
  );
  assert.equal(rendered, false);
});

test("default renderer uses pinned fonts for flowcharts", { timeout: 30000 }, async () => {
  const root = await fixture();
  const built = await compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "out") });
  assert.match(await readFile(built.rows[0].htmlPath, "utf8"), /svg text,svg tspan,svg foreignObject \*\{font-family:'Atkinson Hyperlegible' !important\}/);
});
