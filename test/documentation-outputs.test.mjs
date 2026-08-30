import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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
    const [composed, config, selection, publication] = await Promise.all([
      composeDocumentationOutputs({ mkdocsOutput: temporary }),
      json("portal.config.json"),
      json("documentation-selection.json"),
      json("diagrams/publications.json"),
    ]);
    const { result, artifact, projectionManifest, mkdocsManifest } = composed;
    const navigated = config.documentation.navigation.flatMap((section) => section.documents);
    const selected = [...new Set([...navigated, ...selection.supportingDocuments])].sort();

    assert.equal(result.selectedDocuments, 26);
    assert.equal(result.navigatedDocuments, 18);
    assert.equal(result.supportingDocuments, 8);
    assert.deepEqual(projectionManifest.selectedDocuments, selected);
    assert.deepEqual(projectionManifest.supportingDocuments, selection.supportingDocuments);
    assert.equal(mkdocsManifest.documents.length, 26);
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
    assert.equal(operational.length, 16);
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
    assert.equal(projectionManifest.assets.diagrams.length, 5);
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
    assert.equal(mkdocsManifest.files.some((row) => row.path.startsWith("bundle/") || row.path === "wrangler.jsonc"), false);
    assert.equal((await json("wrangler.jsonc")).assets.directory, "./dist");
  } finally {
    await rm(temporary, { recursive: true, force: true });
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
      title: document.querySelector("h1")?.textContent?.trim(),
      navLabel: document.querySelector('nav[aria-label="Documentation navigation"]')?.getAttribute("aria-label"),
      diagramAlt: document.querySelector(".superbee-diagram img")?.getAttribute("alt"),
      diagramWidth: document.querySelector(".superbee-diagram img")?.naturalWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    assert.equal(observed.title, "Question answered");
    assert.equal(observed.navLabel, "Documentation navigation");
    assert.match(observed.diagramAlt, /private workspace layers/);
    assert.ok(observed.diagramWidth > 0);
    assert.equal(observed.horizontalOverflow, false);
  } finally {
    await browser.close();
  }
});
