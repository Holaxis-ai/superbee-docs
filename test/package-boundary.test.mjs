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
  const [config, manifest, home, architectureGlancePage, systemContextPage, mutationLifecyclePage, viewLifecyclePage, diagramBindings, architectureGlanceView, systemContextView, mutationLifecycleView, viewLifecycleView] = await Promise.all([
    json("portal.config.json"),
    json("dist/data/portal-manifest.json"),
    readFile("dist/index.html", "utf8"),
    readFile("dist/docs/architecture/architecture-at-a-glance/index.html", "utf8"),
    readFile("dist/docs/architecture/superbee-system-context/index.html", "utf8"),
    readFile("dist/docs/architecture/document-mutation-lifecycle/index.html", "utf8"),
    readFile("dist/docs/architecture/view-lifecycle-and-trust/index.html", "utf8"),
    json("dist/assets/docs-diagrams.json"),
    readFile(".superbee/views/architecture-at-a-glance.html"),
    readFile(".superbee/views/superbee-system-context.html"),
    readFile(".superbee/views/document-mutation-lifecycle.html"),
    readFile(".superbee/views/view-lifecycle-and-trust.html"),
  ]);
  const paths = new Set(manifest.files.map((row) => row.path));
  for (const required of [
    "index.html",
    "docs/learn/start-here/index.html",
    "assets/docs-search.json",
    "assets/docs-diagrams.json",
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
  assert.deepEqual(diagramBindings, {
    schema: "https://getsuperbee.com/schemas/portal-docs-diagrams/v1",
    diagrams: [
      {
        diagramId: "architecture-at-a-glance",
        documentId: "architecture/architecture-at-a-glance",
        title: "Architecture at a glance",
        viewId: "views-registry/architecture-at-a-glance",
      },
      {
        diagramId: "document-mutation-lifecycle",
        documentId: "architecture/document-mutation-lifecycle",
        title: "Document mutation lifecycle",
        viewId: "views-registry/document-mutation-lifecycle",
      },
      {
        diagramId: "superbee-system-context",
        documentId: "architecture/superbee-system-context",
        title: "Superbee system context",
        viewId: "views-registry/superbee-system-context",
      },
      {
        diagramId: "view-lifecycle-and-trust",
        documentId: "architecture/view-lifecycle-and-trust",
        title: "View lifecycle and trust",
        viewId: "views-registry/view-lifecycle-and-trust",
      },
    ],
  });
  for (const [page, ownDiagram, otherDiagrams] of [
    [architectureGlancePage, "architecture-at-a-glance", ["superbee-system-context", "document-mutation-lifecycle", "view-lifecycle-and-trust"]],
    [systemContextPage, "superbee-system-context", ["architecture-at-a-glance", "document-mutation-lifecycle", "view-lifecycle-and-trust"]],
    [mutationLifecyclePage, "document-mutation-lifecycle", ["architecture-at-a-glance", "superbee-system-context", "view-lifecycle-and-trust"]],
    [viewLifecyclePage, "view-lifecycle-and-trust", ["architecture-at-a-glance", "superbee-system-context", "document-mutation-lifecycle"]],
  ]) {
    assert.equal((page.match(/data-superbee-diagram-open=/g) ?? []).length, 1);
    assert.match(page, new RegExp(`data-superbee-diagram-open="${ownDiagram}"`));
    for (const otherDiagram of otherDiagrams) {
      assert.doesNotMatch(page, new RegExp(`data-superbee-diagram-open="${otherDiagram}"`));
    }
    assert.match(page, /<dialog id="docs-diagram-stage"/);
    assert.match(page, /<noscript>/);
    assert.doesNotMatch(page, /href="[^"]*(?:views-registry|bundle\/views\/)/);
  }
  const views = new Map(config.portal.views.map((view) => [view.id, view]));
  assert.equal(views.get("views-registry/architecture-at-a-glance").entrySha256, sha256(architectureGlanceView));
  assert.equal(views.get("views-registry/superbee-system-context").entrySha256, sha256(systemContextView));
  assert.equal(views.get("views-registry/document-mutation-lifecycle").entrySha256, sha256(mutationLifecycleView));
  assert.equal(views.get("views-registry/view-lifecycle-and-trust").entrySha256, sha256(viewLifecycleView));
});
