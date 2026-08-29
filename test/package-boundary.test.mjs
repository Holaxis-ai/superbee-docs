import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RENDERER_IDENTITY } from "@superbee/docs-tooling";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

test("consumer uses only public packed package surfaces and nested versioned config", async () => {
  const [consumer, config, diagram] = await Promise.all([
    json("package.json"),
    json("portal.config.json"),
    json("diagrams/manifest.json"),
  ]);
  assert.equal(consumer.workspaces, undefined);
  assert.equal(config.schema, "https://getsuperbee.com/schemas/docs-site/v1");
  assert.equal(config.portal.schema, "https://getsuperbee.com/schemas/portal-config/v1");
  assert.equal(config.documentation.schema, "https://getsuperbee.com/schemas/portal-docs/v1");
  assert.equal(config.presentation, undefined);
  assert.equal(config.views, undefined);
  assert.equal(diagram.renderer, RENDERER_IDENTITY);
  assert.match(import.meta.resolve("@superbee/docs-tooling"), /\/node_modules\/@superbee\/docs-tooling\//);
  assert.match(import.meta.resolve("@superbee/portal-docs"), /\/node_modules\/@superbee\/portal-docs\//);
  assert.match(import.meta.resolve("superbee-portal"), /\/node_modules\/superbee-portal\//);
  assert.equal(consumer.scripts["diagram:build"], "superbee-docs diagram apply --root . --config portal.config.json");
  await assert.rejects(readFile("scripts/apply-diagrams.mjs"), (error) => error.code === "ENOENT");
});

test("built site preserves documentation, View, diagram, and presentation agreement", async () => {
  const [config, manifest, home, architectureGlancePage, systemContextPage, mutationLifecyclePage, viewLifecyclePage, architectureGlanceView, systemContextView, mutationLifecycleView, viewLifecycleView] = await Promise.all([
    json("portal.config.json"),
    json("dist/data/portal-manifest.json"),
    readFile("dist/index.html", "utf8"),
    readFile("dist/docs/architecture/architecture-at-a-glance/index.html", "utf8"),
    readFile("dist/docs/architecture/superbee-system-context/index.html", "utf8"),
    readFile("dist/docs/architecture/document-mutation-lifecycle/index.html", "utf8"),
    readFile("dist/docs/architecture/view-lifecycle-and-trust/index.html", "utf8"),
    readFile(".superbee/views/architecture-at-a-glance.html"),
    readFile(".superbee/views/superbee-system-context.html"),
    readFile(".superbee/views/document-mutation-lifecycle.html"),
    readFile(".superbee/views/view-lifecycle-and-trust.html"),
  ]);
  const assetPath = (page, diagramId) => page.match(new RegExp(`src="/(assets/diagrams/${diagramId}\\.[0-9a-f]{64}\\.svg)"`))?.[1];
  const architectureGlanceAsset = assetPath(architectureGlancePage, "architecture-at-a-glance");
  const systemContextAsset = assetPath(systemContextPage, "superbee-system-context");
  const mutationLifecycleAsset = assetPath(mutationLifecyclePage, "document-mutation-lifecycle");
  const viewLifecycleAsset = assetPath(viewLifecyclePage, "view-lifecycle-and-trust");
  for (const asset of [architectureGlanceAsset, systemContextAsset, mutationLifecycleAsset, viewLifecycleAsset]) assert.ok(asset);
  const [architectureGlanceSvg, systemContextSvg, mutationLifecycleSvg, viewLifecycleSvg] = await Promise.all([
    readFile(`dist/${architectureGlanceAsset}`), readFile(`dist/${systemContextAsset}`),
    readFile(`dist/${mutationLifecycleAsset}`), readFile(`dist/${viewLifecycleAsset}`),
  ]);
  const paths = new Set(manifest.files.map((row) => row.path));
  for (const required of [
    "index.html",
    "docs/learn/start-here/index.html",
    "assets/docs-search.json",
    architectureGlanceAsset,
    systemContextAsset,
    mutationLifecycleAsset,
    viewLifecycleAsset,
    "sitemap.xml",
    "docs/architecture/architecture-at-a-glance/index.html",
    "docs/architecture/superbee-system-context/index.html",
    "docs/architecture/document-mutation-lifecycle/index.html",
    "docs/architecture/view-lifecycle-and-trust/index.html",
    "bundle/views/architecture-at-a-glance.html",
    "bundle/views/superbee-system-context.html",
    "bundle/views/document-mutation-lifecycle.html",
    "bundle/views/view-lifecycle-and-trust.html",
  ]) assert.ok(paths.has(required), required);
  assert.equal(paths.has("explore/index.html"), false);
  assert.equal(manifest.presentation.contract, "https://getsuperbee.com/schemas/portal-presentation-contribution/v1");
  assert.equal(manifest.presentation.id, "documentation");
  assert.equal(manifest.presentation.producer.name, "superbee-portal-docs");
  assert.match(home, /Superbee/);
  assert.doesNotMatch(home, /href="\/explore\/"/);
  assert.equal(paths.has("assets/docs-diagrams.json"), false);
  await assert.rejects(readFile("dist/assets/docs-diagrams.json"), (error) => error.code === "ENOENT");
  for (const [page, ownDiagram, otherDiagrams] of [
    [architectureGlancePage, "architecture-at-a-glance", ["superbee-system-context", "document-mutation-lifecycle", "view-lifecycle-and-trust"]],
    [systemContextPage, "superbee-system-context", ["architecture-at-a-glance", "document-mutation-lifecycle", "view-lifecycle-and-trust"]],
    [mutationLifecyclePage, "document-mutation-lifecycle", ["architecture-at-a-glance", "superbee-system-context", "view-lifecycle-and-trust"]],
    [viewLifecyclePage, "view-lifecycle-and-trust", ["architecture-at-a-glance", "superbee-system-context", "document-mutation-lifecycle"]],
  ]) {
    assert.equal((page.match(/class="docs-diagram"/g) ?? []).length, 1);
    assert.match(page, new RegExp(`src="/assets/diagrams/${ownDiagram}\\.[0-9a-f]{64}\\.svg"`));
    assert.match(page, new RegExp(`class="docs-full-diagram" href="/assets/diagrams/${ownDiagram}\\.[0-9a-f]{64}\\.svg"`));
    for (const otherDiagram of otherDiagrams) {
      assert.doesNotMatch(page, new RegExp(`src="/assets/diagrams/${otherDiagram}\\.[0-9a-f]{64}\\.svg"`));
    }
    assert.match(page, /<dialog id="docs-diagram-stage"/);
    assert.doesNotMatch(page, /<noscript>|<iframe|data-superbee-diagram-open|portal-client/);
    assert.doesNotMatch(page, /(?:href|src)="[^"]*(?:views-registry|bundle\/views\/)/);
  }
  const exactSvg = (view) => {
    const text = view.toString("utf8");
    return Buffer.from(`${text.slice(text.indexOf("<svg"), text.lastIndexOf("</svg>") + 6).trim()}\n`);
  };
  assert.equal(architectureGlanceSvg.equals(exactSvg(architectureGlanceView)), true);
  assert.equal(systemContextSvg.equals(exactSvg(systemContextView)), true);
  assert.equal(mutationLifecycleSvg.equals(exactSvg(mutationLifecycleView)), true);
  assert.equal(viewLifecycleSvg.equals(exactSvg(viewLifecycleView)), true);
  const views = new Map(config.portal.views.map((view) => [view.id, view]));
  assert.equal(views.get("views-registry/architecture-at-a-glance").entrySha256, sha256(architectureGlanceView));
  assert.equal(views.get("views-registry/superbee-system-context").entrySha256, sha256(systemContextView));
  assert.equal(views.get("views-registry/document-mutation-lifecycle").entrySha256, sha256(mutationLifecycleView));
  assert.equal(views.get("views-registry/view-lifecycle-and-trust").entrySha256, sha256(viewLifecycleView));
});
