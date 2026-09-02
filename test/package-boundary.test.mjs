import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { RENDERER_IDENTITY } from "@superbee/docs-tooling";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

test("consumer uses only public published package surfaces and nested versioned config", async () => {
  const [consumer, config, diagram, wrangler, composition] = await Promise.all([
    json("package.json"),
    json("portal.config.json"),
    json("diagrams/manifest.json"),
    json("wrangler.jsonc"),
    readFile("scripts/documentation-outputs.mjs", "utf8"),
  ]);
  assert.equal(consumer.workspaces, undefined);
  assert.deepEqual(consumer.dependencies, {
    "@superbee/docs-mkdocs": "0.2.2",
    "@superbee/docs-projection": "0.2.2",
    "@superbee/docs-tooling": "0.2.2",
    "@superbee/portal": "0.2.3",
    "@superbee/portal-cloudflare": "0.2.4",
    "@superbee/portal-docs": "0.2.2",
    "@superbee/portal-webmcp": "0.2.2",
    superbee: "0.1.4",
  });
  assert.equal(consumer.scripts["tools:bootstrap"], undefined);
  assert.equal(
    consumer.scripts["repository-history:ensure"],
    "node scripts/bootstrap-repository-history.mjs",
  );
  assert.equal(config.schema, "https://getsuperbee.com/schemas/docs-site/v2");
  assert.equal(config.portal.schema, "https://getsuperbee.com/schemas/portal-config/v1");
  assert.equal(config.documentation.schema, "https://getsuperbee.com/schemas/documentation-source-config/v1");
  assert.equal(config.targets.portal.schema, "https://getsuperbee.com/schemas/portal-docs-target/v1");
  assert.equal(config.targets.mkdocs.schema, "https://getsuperbee.com/schemas/mkdocs-documentation-config/v1");
  assert.equal(config.portal.title, undefined);
  assert.equal(config.portal.description, undefined);
  assert.equal(config.presentation, undefined);
  assert.equal(config.views, undefined);
  assert.equal(diagram.renderer, RENDERER_IDENTITY);
  assert.match(import.meta.resolve("@superbee/docs-projection"), /\/node_modules\/@superbee\/docs-projection\//);
  assert.match(import.meta.resolve("@superbee/docs-mkdocs"), /\/node_modules\/@superbee\/docs-mkdocs\//);
  assert.match(import.meta.resolve("@superbee/docs-tooling"), /\/node_modules\/@superbee\/docs-tooling\//);
  assert.match(import.meta.resolve("@superbee/portal-docs"), /\/node_modules\/@superbee\/portal-docs\//);
  assert.match(import.meta.resolve("@superbee/portal-cloudflare"), /\/node_modules\/@superbee\/portal-cloudflare\//);
  assert.match(import.meta.resolve("@superbee/portal-cloudflare/static-assets"), /\/node_modules\/@superbee\/portal-cloudflare\//);
  assert.match(import.meta.resolve("@superbee/portal-cloudflare/reconcile"), /\/node_modules\/@superbee\/portal-cloudflare\//);
  assert.match(import.meta.resolve("@superbee/portal"), /\/node_modules\/@superbee\/portal\//);
  // The two fixed browser assets this site contributes. Resolved through their own subpath exports
  // so a package that stopped publishing either is caught here rather than at deploy time.
  assert.match(import.meta.resolve("@superbee/portal-webmcp/asset/v0"), /\/node_modules\/@superbee\/portal-webmcp\//);
  assert.match(import.meta.resolve("@superbee/portal/client/v2/asset"), /\/node_modules\/@superbee\/portal\//);
  assert.equal(consumer.scripts["diagram:build"], "superbee-docs diagram apply --root . --config portal.config.json");
  assert.equal(
    consumer.scripts["portal:build"],
    "node scripts/documentation-outputs.mjs build && node scripts/deployment-assets.mjs",
  );
  assert.equal(consumer.scripts["mkdocs:sync"], "superbee-docs-mkdocs sync");
  assert.equal(consumer.scripts["mkdocs:build"], "superbee-docs-mkdocs build");
  assert.equal(consumer.scripts["cloudflare:preview"], undefined);
  assert.equal(consumer.scripts["cloudflare:deploy"], undefined);
  assert.equal(consumer.scripts["cloudflare:reconciliation:check"], "node scripts/check-cloudflare-reconciliation.mjs");
  assert.equal(consumer.scripts["cloudflare:reconcile"], "node scripts/reconcile-cloudflare.mjs");
  assert.match(composition, /composeDocumentationSiteV2/);
  assert.match(composition, /startDocumentationSitePreviewV2/);
  assert.match(composition, /authorizePortalWrite/);
  for (const duplicateLifecycle of [
    "capturePublicationSnapshot",
    "createDocumentationProjectionV1",
    "createDocumentationPresentationContributionFromProjectionV1",
    "createPortalArtifact",
    "materializeMkDocsDocumentationV1",
    "startPortalPreview",
    "writePortalArtifact",
  ]) assert.equal(composition.includes(duplicateLifecycle), false, duplicateLifecycle);
  assert.deepEqual(wrangler.routes, [{
    pattern: "docs.getsuperbee.com",
    custom_domain: true,
  }]);
  // Portal keeps owning and replacing the artifact directory; the deployment is assembled beside
  // it, so host configuration never enters the inventory-exact artifact.
  assert.equal(config.output, "dist");
  assert.notEqual(config.output, wrangler.assets.directory.replace(/^\.\//, ""));
  assert.equal(wrangler.main, "./scripts/cloudflare-worker.mjs");
  assert.deepEqual(wrangler.compatibility_flags, ["nodejs_compat"]);
  assert.equal(wrangler.assets.binding, "ASSETS");
  assert.deepEqual(wrangler.assets.run_worker_first, [
    "/data/*",
    "/bundle/*",
    "/__superbee/bridge/*",
  ]);
  await assert.rejects(readFile("scripts/apply-diagrams.mjs"), (error) => error.code === "ENOENT");
  await assert.rejects(readFile("scripts/mkdocs-runtime.mjs"), (error) => error.code === "ENOENT");
  await assert.rejects(readFile("spikes/mkdocs/materialize.mjs"), (error) => error.code === "ENOENT");
});

test("built site preserves documentation, View, diagram, discovery, and presentation agreement", async () => {
  const [config, manifest, home, llms, portalRobots, mkdocsLlms, mkdocsRobots, search, whatSuperbeePage, domainModelPage, privacyPage, sharingPage, handoffPage, releaseNotesPage, currentReleasePage, architectureGlancePage, systemContextPage, mutationLifecyclePage, viewLifecyclePage, architectureGlanceView, systemContextView, mutationLifecycleView, viewLifecycleView] = await Promise.all([
    json("portal.config.json"),
    json("dist/data/portal-manifest.json"),
    readFile("dist/index.html", "utf8"),
    readFile("dist/llms.txt", "utf8"),
    readFile("dist/robots.txt", "utf8"),
    readFile(".tmp/mkdocs/site/llms.txt", "utf8"),
    readFile(".tmp/mkdocs/site/robots.txt", "utf8"),
    json("dist/assets/docs-search.json"),
    readFile("dist/docs/concepts/what-superbee-is/index.html", "utf8"),
    readFile("dist/docs/guides/model-recurring-domain-concepts/index.html", "utf8"),
    readFile("dist/docs/guides/choose-privacy-and-bundle-boundaries/index.html", "utf8"),
    readFile("dist/docs/guides/share-and-synchronize-git-bundle/index.html", "utf8"),
    readFile("dist/docs/guides/preserve-context-between-sessions/index.html", "utf8"),
    readFile("dist/docs/releases/release-notes/index.html", "utf8"),
    readFile("dist/docs/releases/current/index.html", "utf8"),
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
  const coreMentalModelAsset = assetPath(whatSuperbeePage, "core-mental-model");
  const architectureGlanceAsset = assetPath(architectureGlancePage, "architecture-at-a-glance");
  const systemContextAsset = assetPath(systemContextPage, "superbee-system-context");
  const mutationLifecycleAsset = assetPath(mutationLifecyclePage, "document-mutation-lifecycle");
  const viewLifecycleAsset = assetPath(viewLifecyclePage, "view-lifecycle-and-trust");
  for (const asset of [coreMentalModelAsset, architectureGlanceAsset, systemContextAsset, mutationLifecycleAsset, viewLifecycleAsset]) assert.ok(asset);
  const paths = new Set(manifest.files.map((row) => row.path));
  for (const required of [
    "index.html",
    "docs/learn/start-here/index.html",
    "docs/concepts/what-superbee-is/index.html",
    "docs/guides/model-recurring-domain-concepts/index.html",
    "docs/guides/choose-privacy-and-bundle-boundaries/index.html",
    "docs/guides/share-and-synchronize-git-bundle/index.html",
    "docs/releases/release-notes/index.html",
    "docs/releases/current/index.html",
    "assets/docs-search.json",
    "llms.txt",
    "robots.txt",
    coreMentalModelAsset,
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
  assert.match(home, /In Codex or Claude Code with the Superbee Skill installed/);
  assert.match(whatSuperbeePage, /A new session must reconstruct what happened/);
  assert.match(whatSuperbeePage, /roadmap\.md/);
  assert.match(whatSuperbeePage, /depends on/);
  assert.match(domainModelPage, /Create an Experiment Model recipe and an Experiment kind/);
  assert.match(privacyPage, /an agent can help inspect existing bundle\s+locations/);
  assert.match(sharingPage, /ask an agent to inspect the repository/);
  assert.match(handoffPage, /Ask an agent to prepare the handoff/);
  assert.match(releaseNotesPage, /Current stable release/);
  assert.match(releaseNotesPage, /Previous stable releases/);
  assert.match(releaseNotesPage, /Superbee 0\.1\.4/);
  assert.match(releaseNotesPage, /Superbee 0\.1\.3/);
  assert.match(currentReleasePage, /What changed/);
  assert.match(currentReleasePage, /What you need to do/);
  assert.match(currentReleasePage, /Compatibility/);
  assert.match(currentReleasePage, /Recovery/);
  assert.match(home, /<link rel="alternate" type="text\/markdown" href="\/bundle\/learn\/start-here\.md">/);
  assert.match(home, /<link rel="describedby" href="\/llms\.txt">/);
  assert.match(llms, /^# Superbee\n/m);
  assert.match(llms, /## Get started\n/);
  assert.match(llms, /\]\(https:\/\/docs\.getsuperbee\.com\/bundle\/learn\/start-here\.md\)/);
  assert.match(llms, /## Optional\n/);
  assert.doesNotMatch(llms, /maintenance\/documentation-triggers|Documentation Trigger/);
  const searchById = new Map(search.documents.map((document) => [document.id, document]));
  const selectedDocuments = [...new Set([
    ...config.documentation.navigation.flatMap((section) => section.documents),
    ...config.documentation.supportingDocuments,
  ])];
  for (const id of selectedDocuments) {
    const source = await readFile(`.superbee/${id}.md`);
    const digest = sha256(source).slice("sha256:".length);
    const [published, mkdocsSource] = await Promise.all([
      readFile(`dist/bundle/${id}.md`),
      readFile(`.tmp/mkdocs/site/assets/source/${id}.${digest}.md.txt`),
    ]);
    assert.equal(Buffer.compare(published, source), 0, `${id} (Portal)`);
    assert.equal(Buffer.compare(mkdocsSource, source), 0, `${id} (MkDocs)`);
    const searchDocument = searchById.get(id);
    assert.ok(searchDocument, `search is missing ${id}`);
    assert.notEqual(searchDocument.body.trim(), "", `search body is empty for ${id}`);
  }
  const expectedRobots = "User-agent: *\nAllow: /\nSitemap: https://docs.getsuperbee.com/sitemap.xml\n";
  assert.equal(portalRobots, expectedRobots);
  assert.equal(mkdocsRobots, expectedRobots);
  assert.match(mkdocsLlms, /^# Superbee\n/m);
  const mkdocsHomeUrl = mkdocsLlms.match(/\]\((https:\/\/docs\.getsuperbee\.com\/assets\/source\/learn\/start-here\.[0-9a-f]{64}\.md\.txt)\)/)?.[1];
  assert.ok(mkdocsHomeUrl);
  assert.doesNotMatch(mkdocsLlms, /maintenance\/documentation-triggers|Documentation Trigger/);
  assert.doesNotMatch(home, /href="\/explore\/"/);
  assert.equal(paths.has("assets/docs-diagrams.json"), false);
  await assert.rejects(readFile("dist/assets/docs-diagrams.json"), (error) => error.code === "ENOENT");
  for (const [page, ownDiagram, otherDiagrams] of [
    [whatSuperbeePage, "core-mental-model", ["architecture-at-a-glance", "superbee-system-context", "document-mutation-lifecycle", "view-lifecycle-and-trust"]],
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
