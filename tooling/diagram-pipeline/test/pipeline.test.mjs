import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compileAll } from "../src/index.mjs";

async function fixture(source = "flowchart LR\n  accTitle: Example\n  accDescr: Example flow\n  A --> B\n") {
  const root = await mkdtemp(join(tmpdir(), "diagram-pipeline-test-"));
  await mkdir(join(root, "diagrams"), { recursive: true });
  await writeFile(join(root, "diagrams/example.mmd"), source);
  await writeFile(join(root, "diagrams/manifest.json"), JSON.stringify({
    schema: "https://getsuperbee.com/schemas/docs-diagrams/v1",
    renderer: "@mermaid-js/mermaid-cli@11.16.0",
    diagrams: [{
      id: "example", title: "Example", description: "Example diagram.", source: "diagrams/example.mmd",
      publishedSource: "visuals/sources/example.mmd", documentId: "architecture/example",
      viewId: "views-registry/example", entry: "views/example.html", access: "none",
    }],
  }));
  return root;
}

const accessibleSvg = `<svg xmlns="http://www.w3.org/2000/svg" aria-labelledby="title desc"><title id="title">Example</title><desc id="desc">Example flow</desc><path d="M0 0L1 1"/></svg>`;

test("compiler produces deterministic, self-contained accessible HTML", async () => {
  const root = await fixture();
  const runner = async ({ outputPath }) => writeFile(outputPath, accessibleSvg);
  const first = await compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "first"), runner });
  const second = await compileAll({ root, manifestPath: "diagrams/manifest.json", outputDir: join(root, "second"), runner });
  assert.equal(first.rows[0].entrySha256, second.rows[0].entrySha256);
  const html = await readFile(first.rows[0].htmlPath, "utf8");
  assert.match(html, /Source document: <code>architecture\/example<\/code>/);
  assert.doesNotMatch(html, /<script\b/i);
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

