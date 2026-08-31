import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import puppeteer from "puppeteer";

import { composeDocumentationOutputs } from "../scripts/documentation-outputs.mjs";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

test("one owned projection drives exact Portal and MkDocs documentation outputs", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "superbee-docs-dual-output-"));
  try {
    const [composed, config, publication] = await Promise.all([
      composeDocumentationOutputs({ mkdocsOutput: temporary }),
      json("portal.config.json"),
      json("diagrams/publications.json"),
    ]);
    const { result, artifact, projectionManifest, mkdocsManifest } = composed;
    const navigated = config.documentation.navigation.flatMap((section) => section.documents);
    const selected = [...new Set([...navigated, ...config.documentation.supportingDocuments])].sort();

    assert.equal(result.selectedDocuments, 52);
    assert.equal(result.navigatedDocuments, 40);
    assert.equal(result.supportingDocuments, 12);
    assert.deepEqual(projectionManifest.selectedDocuments, selected);
    assert.deepEqual(projectionManifest.supportingDocuments, config.documentation.supportingDocuments);
    for (const id of [
      "get-started/verify-host-setup",
      "guides/choose-privacy-and-bundle-boundaries",
      "guides/assigned-work-lifecycle",
      "guides/artifacts-and-byte-channels",
      "guides/create-a-bundle-view",
      "guides/evolve-installed-recipes",
      "guides/query-links-and-backlinks",
      "guides/share-and-synchronize-git-bundle",
      "contributing/quickstart",
      "architecture/bundle-engine-and-storage-seam",
      "examples/claims-and-evidence",
      "reference/cli-commands",
      "reference/cli-errors-and-exit-codes",
      "reference/configuration-and-bundle-resolution",
      "reference/okf-compatibility",
      "reference/kind-conventions-and-recipes",
      "reference/view-contract-and-access",
      "reference/host-and-platform-support",
      "reference/publication-snapshot-api",
      "reference/security-and-trust-boundaries",
      "reference/wire-protocol-and-reference-server",
      "releases/release-notes",
      "releases/0.1.3",
      "releases/0.1.4",
    ]) {
      assert.equal(projectionManifest.selectedDocuments.includes(id), true, id);
    }
    assert.equal(mkdocsManifest.documents.length, 52);
    const startHere = projectionManifest.documents.find((document) => document.id === "learn/start-here");
    assert.ok(startHere?.freshness?.updatedAt);
    assert.match(startHere.freshness.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(startHere.freshness.verifiedAt, undefined);
    assert.deepEqual(
      mkdocsManifest.documents.find((document) => document.id === "learn/start-here").freshness,
      startHere.freshness,
    );
    const startHerePage = Buffer.from(artifact.files.get("docs/learn/start-here/index.html")).toString("utf8");
    assert.match(startHerePage, /Last updated <time datetime="[^"]+">[^<]+<\/time>/);
    assert.doesNotMatch(startHerePage, /Last verified/);
    const bundleMarkdown = (await readdir(".superbee", { recursive: true })).filter((file) => file.endsWith(".md"));
    assert.equal(artifact.manifest.counts.documents, bundleMarkdown.length - 1, "the root index is reserved rather than a publication document");
    for (const omitted of ["index", ...config.portal.views.map((row) => row.id)]) {
      assert.equal(projectionManifest.selectedDocuments.includes(omitted), false, omitted);
      assert.ok(artifact.files.has(`bundle/${omitted}.md`), omitted);
    }
    const operational = (await readdir(".superbee/maintenance/documentation-triggers"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => `maintenance/documentation-triggers/${file.slice(0, -3)}`);
    assert.equal(operational.length, 38);
    for (const id of operational) {
      assert.equal(projectionManifest.selectedDocuments.includes(id), false, id);
      assert.ok(artifact.files.has(`bundle/${id}.md`), id);
      assert.equal(mkdocsManifest.documents.some((document) => document.id === id), false, id);
    }

    assert.equal(result.snapshotDigest, projectionManifest.snapshotDigest);
    assert.equal(result.snapshotDigest, artifact.manifest.snapshotDigest);
    assert.equal(result.portal.snapshotDigest, artifact.manifest.snapshotDigest);
    assert.equal(result.projectionDigest, mkdocsManifest.projectionDigest);
    assert.equal(result.projectionDigest, projectionManifest.projectionDigest);
    assert.equal(projectionManifest.assets.brandMark.object.digest, result.brandDigest);
    assert.equal(mkdocsManifest.brandMark.sourceDigest, result.brandDigest);
    assert.equal(artifact.manifest.files.find((row) => row.path === "assets/brand-mark.png").digest, result.brandDigest);

    assert.ok(projectionManifest.relationships.length > 0);
    assert.deepEqual([...new Set(projectionManifest.relationships.map((row) => row.targetStatus))], ["selected"]);
    assert.equal(projectionManifest.relationships.some((row) => !selected.includes(row.from) || !selected.includes(row.to)), false);

    const publishedById = new Map(publication.diagrams.map((row) => [row.id, row]));
    assert.equal(projectionManifest.assets.diagrams.length, 8);
    assert.deepEqual(result.diagrams, result.mkdocs.diagrams);
    for (const diagram of projectionManifest.assets.diagrams) {
      const published = publishedById.get(diagram.id);
      assert.ok(published, diagram.id);
      assert.equal(diagram.object.digest, published.svgSha256);
      assert.equal(mkdocsManifest.diagrams.find((row) => row.id === diagram.id).sourceDigest, published.svgSha256);
      const bytes = await readFile(path.join(".superbee", published.publishedSvg));
      assert.equal(sha256(bytes), published.svgSha256);
      const presentationPath = `assets/diagrams/${diagram.id}.${published.svgSha256.slice("sha256:".length)}.svg`;
      assert.equal(sha256(artifact.files.get(presentationPath)), published.svgSha256);
    }

    assert.ok(artifact.files.has("bundle/views/architecture-at-a-glance.html"));
    assert.equal(mkdocsManifest.files.some((row) => /(?:^|\/)views(?:-registry)?\//.test(row.path)), false);
    assert.equal(mkdocsManifest.schema, "https://getsuperbee.com/schemas/mkdocs-documentation-output/v1");
    assert.equal(mkdocsManifest.target.indexing, "public");
    assert.equal(
      Buffer.from(artifact.files.get("robots.txt")).toString("utf8"),
      "User-agent: *\nAllow: /\nSitemap: https://docs.getsuperbee.com/sitemap.xml\n",
    );
    assert.equal(
      await readFile(path.join(temporary, "input", "docs", "robots.txt"), "utf8"),
      "User-agent: *\nAllow: /\nSitemap: https://docs.getsuperbee.com/sitemap.xml\n",
    );
    assert.equal(mkdocsManifest.files.some((row) => row.path.startsWith("bundle/") || row.path === "wrangler.jsonc"), false);
    const wrangler = await json("wrangler.jsonc");
    // Cloudflare uploads the assembled deployment, never the inventory-exact artifact directly.
    assert.equal(wrangler.assets.directory, "./deploy");
    // Cloudflare selects the artifact's own 404.html only under this exact assets setting.
    assert.equal(wrangler.assets.not_found_handling, "404-page");

    // The agent entry point quotes one exact section of one published page, with every internal
    // link resolved to the exact published Markdown of a selected document.
    const llms = Buffer.from(artifact.files.get("llms.txt")).toString("utf8");
    const bound = await readFile(path.join(".superbee", `${config.documentation.guidance.documentId}.md`), "utf8");
    assert.match(llms, new RegExp(`\n## ${config.documentation.guidance.label}\n\n`));
    const quoted = llms.slice(llms.indexOf(`## ${config.documentation.guidance.label}`)).split("\n## ")[0];
    const boundLines = bound.split("\n");
    const boundStart = boundLines.indexOf(`# ${config.documentation.guidance.heading}`);
    assert.ok(boundStart >= 0, "the bound heading must exist in its source document");
    const boundEnd = boundLines.findIndex((line, index) => index > boundStart && /^#{1}\s/.test(line));
    for (const line of boundLines.slice(boundStart + 1, boundEnd === -1 ? undefined : boundEnd)) {
      if (!line.trim() || line.includes("](")) continue;
      assert.ok(quoted.includes(line), line);
    }
    assert.doesNotMatch(quoted, /\]\(\.\.?\//, "no page-relative link survives into the agent entry point");
    for (const href of [...quoted.matchAll(/\]\((https:\/\/docs\.getsuperbee\.com[^)]+)\)/g)].map((match) => match[1])) {
      const relative = new URL(href).pathname.replace(/^\//, "");
      assert.ok(artifact.files.has(relative), href);
    }
    assert.ok(llms.indexOf(`## ${config.documentation.guidance.label}`) < llms.indexOf("## Get started"));
    assert.match(llms, /## Machine-readable resources\n\n- \[Documentation index\]\(https:\/\/docs\.getsuperbee\.com\/\)/);
    assert.match(llms, /- \[Crawler policy\]\(https:\/\/docs\.getsuperbee\.com\/robots\.txt\)/);
    assert.match(llms, /- \[Source repository\]\(https:\/\/github\.com\/Holaxis-ai\/superbee\)/);
    assert.ok(llms.indexOf("## Machine-readable resources") < llms.indexOf("## Optional"));

    // Both outputs publish a recovery body whose links are absolute, because a recovery response is
    // served from whatever path the reader requested.
    const recovery = Buffer.from(artifact.files.get("404.md")).toString("utf8");
    assert.match(recovery, /^# Page not found\n/);
    for (const href of ["https://docs.getsuperbee.com/", "https://docs.getsuperbee.com/llms.txt", "https://docs.getsuperbee.com/sitemap.xml"]) {
      assert.ok(recovery.includes(`](${href})`), href);
    }
    assert.deepEqual(artifact.hostingRequirements.notFound,
      { path: "/404.html", status: 404, mediaType: "text/html; charset=utf-8" });
    const recoveryShell = Buffer.from(artifact.files.get("404.html")).toString("utf8");
    assert.match(recoveryShell, /rel="alternate" type="text\/markdown" href="\/404\.md"/);
    assert.match(recoveryShell, /<meta name="robots" content="noindex">/);
    const mkdocsRecovery = await readFile(path.join(temporary, "input", "overrides", "404.html"), "utf8");
    assert.match(mkdocsRecovery, /<h1>Page not found<\/h1>/);
    assert.match(mkdocsRecovery, /https:\/\/docs\.getsuperbee\.com\/llms\.txt/);

    // Site metadata asserts only facts the projection already carries.
    const graph = JSON.parse(startHerePage.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.deepEqual(graph["@graph"].map((node) => node["@type"]), ["WebSite", "SoftwareApplication", "TechArticle"]);
    assert.equal(graph["@graph"][1].codeRepository, config.documentation.product.repositoryUrl);
    assert.equal(graph["@graph"][1].softwareVersion, config.documentation.product.versionLabel);
    for (const node of graph["@graph"]) {
      for (const forbidden of ["address", "telephone", "email", "contactPoint", "sameAs", "image", "logo"]) {
        assert.equal(Object.hasOwn(node, forbidden), false, `${node["@type"]}.${forbidden} has no source of record`);
      }
    }
    assert.match(startHerePage, /<meta property="og:site_name" content="Superbee documentation">/);
    assert.match(startHerePage, /<meta name="twitter:card" content="summary">/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("the publication path rejects a release label that disagrees with its captured bundle", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-release-label-"));
  try {
    await mkdir(path.join(root, ".superbee", "releases"), { recursive: true });
    await writeFile(path.join(root, ".superbee", "index.md"), "---\nokf_version: '0.2'\n---\n# Test bundle\n");
    await writeFile(path.join(root, ".superbee", "releases", "current.md"), "---\ntype: Release\nversion: 1.2.3\n---\n# Current release\n");
    const config = await json("portal.config.json");
    config.documentation.product.versionLabel = "v9.9.9";
    await writeFile(path.join(root, "portal.config.json"), JSON.stringify(config));

    await assert.rejects(
      composeDocumentationOutputs({ root, mkdocsOutput: path.join(root, "mkdocs") }),
      /versionLabel must equal v1\.2\.3 from releases\/current/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("static v3 migration preserves exact legacy View and registration predecessor bytes", async () => {
  const [publication, config] = await Promise.all([
    json("diagrams/publications.json"),
    json("portal.config.json"),
  ]);
  assert.equal(publication.schema, "https://getsuperbee.com/schemas/docs-diagram-publications/v3");
  const predecessor = JSON.parse(Buffer.from(publication.predecessor.receipt.bytesBase64, "base64").toString("utf8"));
  assert.equal(predecessor.schema, "https://getsuperbee.com/schemas/docs-diagram-publications/v2");
  const configured = new Map(config.portal.views.map((row) => [row.id, row]));
  for (const row of predecessor.diagrams) {
    const [entry, registration] = await Promise.all([
      readFile(path.join(".superbee", row.entry)),
      readFile(path.join(".superbee", `${row.viewId}.md`)),
    ]);
    assert.equal(sha256(entry), row.entrySha256, row.id);
    assert.equal(sha256(registration), row.registrationSha256, row.id);
    assert.equal(configured.get(row.viewId).entrySha256, row.entrySha256, row.id);
  }
});

test("the real MkDocs site remains readable without JavaScript at mobile width", async () => {
  const pageFile = path.resolve(".tmp/mkdocs/site/documents/architecture/architecture-at-a-glance/index.html");
  const html = await readFile(pageFile, "utf8");
  assert.match(html, /Content-Security-Policy[^>]+default-src 'none'/);
  assert.match(html, /<nav aria-label="Documentation navigation">/);
  assert.match(html, /Open full-size diagram: Architecture at a glance/);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(pathToFileURL(pageFile).href, { waitUntil: "load" });
    const observed = await page.evaluate(() => ({
      titles: [...document.querySelectorAll("h1")].map((heading) => heading.textContent?.trim()),
      questionLevel: [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")]
        .find((heading) => heading.textContent?.trim() === "Question answered")?.tagName,
      questionNavigation: document.querySelector('a[href="#question-answered"]')?.textContent?.trim(),
      navLabel: document.querySelector('nav[aria-label="Documentation navigation"]')?.getAttribute("aria-label"),
      diagramAlt: document.querySelector(".superbee-diagram img")?.getAttribute("alt"),
      diagramWidth: document.querySelector(".superbee-diagram img")?.naturalWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    assert.deepEqual(observed.titles, ["Architecture at a glance"]);
    assert.equal(observed.questionLevel, "H2");
    assert.equal(observed.questionNavigation, "Question answered");
    assert.equal(observed.navLabel, "Documentation navigation");
    assert.match(observed.diagramAlt, /private workspace layers/);
    assert.ok(observed.diagramWidth > 0);
    assert.equal(observed.horizontalOverflow, false);
  } finally {
    await browser.close();
  }
});
