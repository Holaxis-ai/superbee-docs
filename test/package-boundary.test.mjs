import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RENDERER_IDENTITY } from "@superbee/docs-tooling";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

test("consumer uses only public packed package surfaces and nested versioned config", async () => {
  const [consumer, config, diagram, wrangler] = await Promise.all([
    json("package.json"),
    json("portal.config.json"),
    json("diagrams/manifest.json"),
    json("wrangler.jsonc"),
  ]);
  assert.equal(consumer.workspaces, undefined);
  assert.equal(config.schema, "https://getsuperbee.com/schemas/docs-site/v1");
  assert.equal(config.portal.schema, "https://getsuperbee.com/schemas/portal-config/v1");
  assert.equal(config.documentation.schema, "https://getsuperbee.com/schemas/portal-docs/v1");
  assert.equal(config.presentation, undefined);
  assert.equal(config.views, undefined);
  assert.equal(diagram.renderer, RENDERER_IDENTITY);
  assert.match(import.meta.resolve("@superbee/docs-projection"), /\/node_modules\/@superbee\/docs-projection\//);
  assert.match(import.meta.resolve("@superbee/docs-mkdocs"), /\/node_modules\/@superbee\/docs-mkdocs\//);
  assert.match(import.meta.resolve("@superbee/docs-tooling"), /\/node_modules\/@superbee\/docs-tooling\//);
  assert.match(import.meta.resolve("@superbee/portal-docs"), /\/node_modules\/@superbee\/portal-docs\//);
  assert.match(import.meta.resolve("superbee-portal"), /\/node_modules\/superbee-portal\//);
  assert.equal(consumer.scripts["diagram:build"], "superbee-docs diagram apply --root . --config portal.config.json");
  assert.equal(consumer.scripts["portal:build"], "node scripts/documentation-outputs.mjs build");
  assert.equal(consumer.scripts["mkdocs:build"], "node scripts/mkdocs-runtime.mjs build");
  assert.deepEqual(wrangler.routes, [{
    pattern: "docs.getsuperbee.com",
    custom_domain: true,
  }]);
  await assert.rejects(readFile("scripts/apply-diagrams.mjs"), (error) => error.code === "ENOENT");
  await assert.rejects(readFile("spikes/mkdocs/materialize.mjs"), (error) => error.code === "ENOENT");
});

test("built site preserves documentation, View, diagram, discovery, and presentation agreement", async () => {
  const [config, manifest, home, llms, portalRobots, mkdocsLlms, mkdocsRobots, homeSource, domainModelSource, privacySource, sharingSource, search, architectureGlancePage, systemContextPage, mutationLifecyclePage, viewLifecyclePage, architectureGlanceView, systemContextView, mutationLifecycleView, viewLifecycleView] = await Promise.all([
    json("portal.config.json"),
    json("dist/data/portal-manifest.json"),
    readFile("dist/index.html", "utf8"),
    readFile("dist/llms.txt", "utf8"),
    readFile("dist/robots.txt", "utf8"),
    readFile(".tmp/mkdocs/site/llms.txt", "utf8"),
    readFile(".tmp/mkdocs/site/robots.txt", "utf8"),
    readFile(".superbee/learn/start-here.md"),
    readFile(".superbee/guides/model-recurring-domain-concepts.md"),
    readFile(".superbee/guides/choose-privacy-and-bundle-boundaries.md"),
    readFile(".superbee/guides/share-and-synchronize-git-bundle.md"),
    json("dist/assets/docs-search.json"),
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
  const paths = new Set(manifest.files.map((row) => row.path));
  for (const required of [
    "index.html",
    "docs/learn/start-here/index.html",
    "docs/guides/model-recurring-domain-concepts/index.html",
    "docs/guides/choose-privacy-and-bundle-boundaries/index.html",
    "docs/guides/share-and-synchronize-git-bundle/index.html",
    "assets/docs-search.json",
    "llms.txt",
    "robots.txt",
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
  assert.match(home, /In a supported host with the Superbee Skill/);
  assert.match(home, /<link rel="alternate" type="text\/markdown" href="\/bundle\/learn\/start-here\.md">/);
  assert.match(home, /<link rel="describedby" href="\/llms\.txt">/);
  assert.match(llms, /^# Superbee\n/m);
  assert.match(llms, /## Get started\n/);
  assert.match(llms, /\]\(https:\/\/docs\.getsuperbee\.com\/bundle\/learn\/start-here\.md\)/);
  assert.match(llms, /## Optional\n/);
  assert.doesNotMatch(llms, /maintenance\/documentation-triggers|Documentation Trigger/);
  assert.equal(Buffer.compare(await readFile("dist/bundle/learn/start-here.md"), homeSource), 0);
  assert.equal(
    Buffer.compare(await readFile("dist/bundle/guides/model-recurring-domain-concepts.md"), domainModelSource),
    0,
  );
  assert.equal(
    Buffer.compare(await readFile("dist/bundle/guides/choose-privacy-and-bundle-boundaries.md"), privacySource),
    0,
  );
  assert.equal(
    Buffer.compare(await readFile("dist/bundle/guides/share-and-synchronize-git-bundle.md"), sharingSource),
    0,
  );
  const searchById = new Map(search.documents.map((document) => [document.id, document]));
  assert.match(searchById.get("learn/start-here")?.body ?? "", /In a supported host with the Superbee Skill/);
  assert.match(searchById.get("guides/model-recurring-domain-concepts")?.body ?? "", /Experiment Model recipe/);
  assert.match(searchById.get("guides/choose-privacy-and-bundle-boundaries")?.body ?? "", /An agent can help inspect existing bundle locations/);
  assert.match(searchById.get("guides/share-and-synchronize-git-bundle")?.body ?? "", /Ask an agent to inspect the repository/);
  const expectedRobots = "User-agent: *\nAllow: /\nSitemap: https://docs.getsuperbee.com/sitemap.xml\n";
  assert.equal(portalRobots, expectedRobots);
  assert.equal(mkdocsRobots, expectedRobots);
  assert.match(mkdocsLlms, /^# Superbee\n/m);
  const mkdocsHomeUrl = mkdocsLlms.match(/\]\((https:\/\/docs\.getsuperbee\.com\/assets\/source\/learn\/start-here\.[0-9a-f]{64}\.md\.txt)\)/)?.[1];
  assert.ok(mkdocsHomeUrl);
  assert.equal(Buffer.compare(await readFile(`.tmp/mkdocs/site${new URL(mkdocsHomeUrl).pathname}`), homeSource), 0);
  assert.doesNotMatch(mkdocsLlms, /maintenance\/documentation-triggers|Documentation Trigger/);
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
  const views = new Map(config.portal.views.map((view) => [view.id, view]));
  assert.equal(views.get("views-registry/architecture-at-a-glance").entrySha256, sha256(architectureGlanceView));
  assert.equal(views.get("views-registry/superbee-system-context").entrySha256, sha256(systemContextView));
  assert.equal(views.get("views-registry/document-mutation-lifecycle").entrySha256, sha256(mutationLifecycleView));
  assert.equal(views.get("views-registry/view-lifecycle-and-trust").entrySha256, sha256(viewLifecycleView));
});
