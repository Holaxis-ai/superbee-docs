import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { parse as parseYaml } from "yaml";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mermaidConfig = resolve(packageRoot, "mermaid.config.json");
const mermaidScript = fileURLToPath(import.meta.resolve("mermaid/dist/mermaid.min.js"));
const pinnedFont = fileURLToPath(import.meta.resolve("@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff2"));
const pinnedFontLicense = resolve(packageRoot, "FONT-LICENSE.txt");
const rendererIdentity = "superbee-docs-mermaid-v1+mermaid@11.17.2+puppeteer@25.9.0+atkinson-hyperlegible@5.3.0";

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function inside(root, candidate, label) {
  const absolute = resolve(root, candidate);
  const rel = relative(root, absolute);
  if (rel === "" || rel.startsWith("..") || resolve(root, rel) !== absolute) {
    throw new Error(`${label} must resolve beneath the repository root`);
  }
  return absolute;
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

export function validatePublicationOwnership(row, label = "publication") {
  const id = requiredString(row?.id, `${label}.id`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`${label}.id '${id}' is not a stable slug`);
  const expected = {
    id,
    publishedSource: `visuals/sources/${id}.mmd`,
    viewId: `views-registry/${id}`,
    entry: `views/${id}.html`,
  };
  for (const field of ["publishedSource", "viewId", "entry"]) {
    const actual = requiredString(row?.[field], `${label}.${field}`);
    if (actual !== expected[field]) throw new Error(`${label}.${field} must be '${expected[field]}'`);
  }
  return expected;
}

function validateDiagram(row, index) {
  const publication = validatePublicationOwnership(row, `diagrams[${index}]`);
  const { id } = publication;
  const access = requiredString(row.access, `diagrams[${index}].access`);
  if (access !== "none") throw new Error(`diagram '${id}' must use access 'none' in v1`);
  return {
    ...publication,
    title: requiredString(row.title, `diagrams[${index}].title`),
    description: requiredString(row.description, `diagrams[${index}].description`),
    source: requiredString(row.source, `diagrams[${index}].source`),
    documentId: requiredString(row.documentId, `diagrams[${index}].documentId`),
    access,
  };
}

export async function loadManifest(root, manifestPath) {
  const path = inside(root, manifestPath, "manifest path");
  const parsed = JSON.parse(await readFile(path, "utf8"));
  if (parsed.schema !== "https://getsuperbee.com/schemas/docs-diagrams/v1") {
    throw new Error("diagram manifest schema must be docs-diagrams/v1");
  }
  const renderer = requiredString(parsed.renderer, "renderer");
  if (renderer !== rendererIdentity) throw new Error(`unsupported pinned renderer '${renderer}'`);
  if (!Array.isArray(parsed.diagrams) || parsed.diagrams.length === 0) throw new Error("manifest requires at least one diagram");
  const diagrams = parsed.diagrams.map(validateDiagram);
  if (new Set(diagrams.map((row) => row.id)).size !== diagrams.length) throw new Error("diagram ids must be unique");
  return { renderer, diagrams };
}

function assertAccessibleMermaid(source, id) {
  if (!/^\s*accTitle:\s*\S.+$/m.test(source)) throw new Error(`diagram '${id}' requires accTitle`);
  if (!/^\s*accDescr(?:\s*:\s*\S.+|\s*\{)/m.test(source)) throw new Error(`diagram '${id}' requires accDescr`);
}

function assertPinnedGlyphCoverage(value, id, label) {
  const expanded = value.replace(/&#(?:x([0-9a-f]+)|([0-9]+));/gi, (entity, hex, decimal) => {
    const codePoint = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
    return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
  });
  const unsupportedEntity = expanded.match(/&([a-z][a-z0-9]+);/i);
  if (unsupportedEntity && !/^&(amp|lt|gt|quot|apos);$/i.test(unsupportedEntity[0])) {
    throw new Error(`diagram '${id}' ${label} contains unsupported character entity '${unsupportedEntity[0]}'`);
  }
  for (const character of expanded) {
    const codePoint = character.codePointAt(0);
    if (character !== "\t" && character !== "\n" && character !== "\r" && (codePoint < 0x20 || codePoint > 0x7e)) {
      throw new Error(`diagram '${id}' ${label} contains unsupported character U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`);
    }
  }
}

function admittedSvg(raw, id) {
  const start = raw.indexOf("<svg");
  const end = raw.lastIndexOf("</svg>");
  if (start < 0 || end < start) throw new Error(`diagram '${id}' renderer did not return SVG`);
  const svg = `${raw.slice(start, end + 6).trim()}\n`;
  // Mermaid may use a bounded foreignObject subtree for wrapped labels even with strict security
  // and htmlLabels disabled. That subtree executes inside the same exact-digest sandboxed View as
  // the wrapper itself; scripts, event handlers, and external resources remain categorically
  // rejected below.
  if (/<script\b|\son[a-z]+\s*=/i.test(svg)) {
    throw new Error(`diagram '${id}' SVG contains executable markup`);
  }
  if (/\b(?:href|src)\s*=\s*["'](?!#)[^"']+/i.test(svg)) {
    throw new Error(`diagram '${id}' SVG contains an external resource`);
  }
  const accessibleText = (tag) => {
    const match = svg.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    if (!match) return "";
    return match[1]
      .replace(/<[^>]*>/g, "")
      .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
      .replace(/&#([0-9]+);/g, (_, value) => String.fromCodePoint(Number.parseInt(value, 10)))
      .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name) => ({
        amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
      })[name.toLowerCase()])
      .replace(/[\s\u00a0\u200b-\u200d\u2060\ufeff]/gu, "");
  };
  if (!accessibleText("title") || !accessibleText("desc")) {
    throw new Error(`diagram '${id}' rendered SVG lacks an accessible title or description`);
  }
  assertPinnedGlyphCoverage(svg, id, "rendered SVG");
  return svg;
}

function fontFace(font) {
  return `@font-face{font-family:'Atkinson Hyperlegible';src:url(data:font/woff2;base64,${font.toString("base64")}) format('woff2');font-style:normal;font-weight:400;font-display:block}`;
}

function wrapView(diagram, svg, font, license) {
  const title = escapeHtml(diagram.title);
  const description = escapeHtml(diagram.description);
  const documentId = escapeHtml(diagram.documentId);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
  <title>${title}</title>
  <style>
    ${fontFace(font)}
    :root{color-scheme:light;--paper:#fffdf7;--ink:#211b00;--muted:#5e635f;--line:#d9d2bd;--accent:#176b53}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 'Atkinson Hyperlegible',sans-serif}
    main{max-width:1200px;margin:auto;padding:clamp(1rem,4vw,3rem)}header{margin-bottom:1.5rem}h1{font-size:clamp(1.7rem,4vw,3rem);line-height:1.05;margin:.2rem 0 .7rem}
    header p{max-width:70ch;color:var(--muted)}.diagram{border:1px solid var(--line);border-radius:1rem;background:#fff;padding:clamp(.5rem,2vw,1.5rem);overflow:auto}
    svg{display:block;min-width:44rem;max-width:none;height:auto;margin:auto}.source,footer{font-size:.82rem;color:var(--muted);overflow-wrap:anywhere}footer{margin-top:1.5rem}footer pre{white-space:pre-wrap}
    @media print{body{background:#fff}.diagram{border:0;padding:0}}
  </style>
</head>
<body>
  <main>
    <header><p class="source">Source document: <code>${documentId}</code></p><h1>${title}</h1><p>${description}</p></header>
    <section class="diagram" aria-label="${title}">${svg}</section>
    <footer><details><summary>Atkinson Hyperlegible font license</summary><pre>${escapeHtml(license)}</pre></details></footer>
  </main>
</body>
</html>
`;
}

async function defaultMermaidRunner({ sourcePath, outputPath, fontCss }) {
  const [source, config] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(mermaidConfig, "utf8").then(JSON.parse),
  ]);
  const browser = await puppeteer.launch({ headless: "shell" });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 1 });
    await page.setContent("<!doctype html><html><head></head><body><main id=container></main></body></html>");
    await page.addStyleTag({ content: fontCss });
    const fontLoaded = await page.evaluate(async () => {
      const faces = await document.fonts.load("16px 'Atkinson Hyperlegible'");
      await document.fonts.ready;
      return faces.length > 0 && document.fonts.check("16px 'Atkinson Hyperlegible'");
    });
    if (!fontLoaded) throw new Error("pinned Atkinson Hyperlegible font did not load");
    await page.addScriptTag({ path: mermaidScript });
    const svg = await page.evaluate(async ({ definition, mermaidConfig: browserConfig }) => {
      globalThis.mermaid.initialize({ startOnLoad: false, ...browserConfig });
      const rendered = await globalThis.mermaid.render("my-svg", definition, document.querySelector("#container"));
      return rendered.svg;
    }, { definition: source, mermaidConfig: config });
    await writeFile(outputPath, svg, "utf8");
  } finally {
    await browser.close();
  }
}

export function expectedViewMarkdown(diagram) {
  return `---
type: View
title: ${JSON.stringify(diagram.title)}
description: ${JSON.stringify(diagram.description)}
entry: ${diagram.entry}
access: none
---
This registered View is the deterministic visual projection of
[the architecture source](../${diagram.documentId}.md).
`;
}

function expectedRegistration(diagram) {
  return {
    fields: {
      type: "View",
      title: diagram.title,
      description: diagram.description,
      entry: diagram.entry,
      access: diagram.access,
    },
    body: `This registered View is the deterministic visual projection of\n[the architecture source](../${diagram.documentId}.md).`,
  };
}

export async function compileAll({ root, manifestPath, outputDir, runner = defaultMermaidRunner }) {
  const absoluteRoot = resolve(root);
  const manifest = await loadManifest(absoluteRoot, manifestPath);
  const absoluteOutput = resolve(outputDir);
  const [font, license] = await Promise.all([readFile(pinnedFont), readFile(pinnedFontLicense, "utf8")]);
  await mkdir(absoluteOutput, { recursive: true });
  const rows = [];
  for (const diagram of manifest.diagrams) {
    const sourcePath = inside(absoluteRoot, diagram.source, `diagram '${diagram.id}' source`);
    const source = await readFile(sourcePath, "utf8");
    assertAccessibleMermaid(source, diagram.id);
    assertPinnedGlyphCoverage(source, diagram.id, "source");
    const work = await mkdtemp(resolve(tmpdir(), "superbee-docs-diagram-"));
    try {
      const svgPath = resolve(work, `${diagram.id}.svg`);
      const fontCss = fontFace(font);
      await runner({ sourcePath, outputPath: svgPath, fontCss, diagram });
      const svg = admittedSvg(await readFile(svgPath, "utf8"), diagram.id);
      const html = wrapView(diagram, svg, font, license);
      const htmlPath = resolve(absoluteOutput, `${diagram.id}.html`);
      await writeFile(htmlPath, html, "utf8");
      rows.push({
        ...diagram,
        sourcePath,
        htmlPath,
        sourceSha256: sha256(source),
        entrySha256: sha256(html),
      });
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  }
  const receipt = { schema: "superbee-docs-diagram-build/v1", renderer: manifest.renderer, diagrams: rows.map(({ sourcePath, htmlPath, ...row }) => row) };
  await writeFile(resolve(absoluteOutput, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return { manifest, rows, receipt };
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { fields: {}, body: raw.trim() };
  const fields = parseYaml(match[1]);
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return { fields: {}, body: raw.slice(match[0].length).trim() };
  return { fields, body: raw.slice(match[0].length).trim() };
}

function sameRecord(actual, expected) {
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return JSON.stringify(actualKeys) === JSON.stringify(expectedKeys)
    && expectedKeys.every((key) => actual[key] === expected[key]);
}

export async function checkAgreement({ root, manifestPath, runner = defaultMermaidRunner }) {
  const absoluteRoot = resolve(root);
  const work = await mkdtemp(resolve(tmpdir(), "superbee-docs-diagram-check-"));
  try {
    const built = await compileAll({ root: absoluteRoot, manifestPath, outputDir: work, runner });
    const portal = JSON.parse(await readFile(resolve(absoluteRoot, "portal.config.json"), "utf8"));
    const publicationState = JSON.parse(await readFile(resolve(absoluteRoot, "diagrams/publications.json"), "utf8"));
    const expectedPublications = built.rows.map(({ id, publishedSource, viewId, entry }) => ({ id, publishedSource, viewId, entry })).sort((a, b) => a.id.localeCompare(b.id));
    if (publicationState.schema !== "https://getsuperbee.com/schemas/docs-diagram-publications/v1"
      || JSON.stringify(publicationState.diagrams) !== JSON.stringify(expectedPublications)) {
      throw new Error("diagram publication state is stale");
    }
    const admissions = new Map((portal.views ?? []).map((row) => [row.id, row]));
    const rows = [];
    for (const diagram of built.rows) {
      const publishedSource = inside(resolve(absoluteRoot, ".superbee"), diagram.publishedSource, `diagram '${diagram.id}' published source`);
      const publishedHtml = inside(resolve(absoluteRoot, ".superbee"), diagram.entry, `diagram '${diagram.id}' published View`);
      const registrationPath = inside(resolve(absoluteRoot, ".superbee"), `${diagram.viewId}.md`, `diagram '${diagram.id}' registration`);
      const [sourceBytes, publishedSourceBytes, builtHtml, publishedHtmlBytes, registrationBytes] = await Promise.all([
        readFile(diagram.sourcePath), readFile(publishedSource), readFile(diagram.htmlPath), readFile(publishedHtml), readFile(registrationPath, "utf8"),
      ]);
      if (!sourceBytes.equals(publishedSourceBytes)) throw new Error(`diagram '${diagram.id}' published source is stale`);
      if (!builtHtml.equals(publishedHtmlBytes)) throw new Error(`diagram '${diagram.id}' generated View is stale`);
      const registration = parseFrontmatter(registrationBytes);
      const expected = expectedRegistration(diagram);
      if (!sameRecord(registration.fields, expected.fields) || registration.body !== expected.body) {
        throw new Error(`diagram '${diagram.id}' registration is stale`);
      }
      const admission = admissions.get(diagram.viewId);
      if (!admission || admission.entry !== diagram.entry || admission.access !== diagram.access || admission.entrySha256 !== diagram.entrySha256) {
        throw new Error(`diagram '${diagram.id}' Portal admission is stale`);
      }
      rows.push({ id: diagram.id, source: diagram.sourceSha256, view: diagram.entrySha256, verified: true });
    }
    return { schema: "superbee-docs-diagram-check/v1", count: rows.length, rows };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
