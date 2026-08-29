import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildProjection, PROJECTION_SCHEMA } from "../spikes/mkdocs/projection.mjs";
import { materializeMkDocs } from "../spikes/mkdocs/materialize.mjs";

const root = path.resolve(".");
const temporaryRoot = await realpath(tmpdir());
const expectedSupport = [
  "design/docs-operating-model",
  "design/site-experience-contract",
  "plans/docs-coverage",
  "sources/current-release",
  "sources/superbee-codebase-main",
  "sources/superbee-core",
  "sources/superbee-portal",
  "sources/superbee-release-0.1.3",
];

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function inventory(directory, relative = "", out = []) {
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await inventory(directory, child, out);
    else if (entry.isFile()) out.push([child, digest(await readFile(path.join(directory, child)))]);
  }
  return out.sort(([left], [right]) => left.localeCompare(right));
}

function structuralKeys(value, out = new Set()) {
  if (Array.isArray(value)) for (const entry of value) structuralKeys(entry, out);
  else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      out.add(key);
      structuralKeys(entry, out);
    }
  }
  return out;
}

test("real bundle projects one explicit target-neutral, deterministic publication set", async () => {
  const temporary = await mkdtemp(path.join(temporaryRoot, "superbee-docs-mkdocs-projection-"));
  try {
    const first = path.join(temporary, "nested", "first");
    const second = path.join(temporary, "separate", "second");
    const [left, right] = await Promise.all([
      buildProjection({ root, output: first }),
      buildProjection({ root, output: second }),
    ]);
    assert.equal(left.manifest.schema, PROJECTION_SCHEMA);
    assert.deepEqual(left.manifest, right.manifest);
    assert.deepEqual(await inventory(first), await inventory(second));
    assert.equal(left.manifest.navigation.flatMap((section) => section.documents).length, 11);
    assert.equal(left.manifest.documents.length, 19);
    assert.equal(left.manifest.diagrams.length, 4);
    assert.deepEqual(left.manifest.supportingDocuments, expectedSupport);

    const documentIds = new Set(left.manifest.documents.map((document) => document.id));
    for (const excluded of [
      "releases/0.1.3",
      "views-registry/architecture-at-a-glance",
      "views-registry/document-mutation-lifecycle",
      "views-registry/superbee-system-context",
      "views-registry/view-lifecycle-and-trust",
    ]) assert.equal(documentIds.has(excluded), false, excluded);

    for (const document of left.manifest.documents) {
      assert.deepEqual(
        await readFile(path.join(first, document.source.path)),
        await readFile(path.join(root, ".superbee", `${document.id}.md`)),
      );
    }
    for (const diagram of left.manifest.diagrams) {
      const bytes = await readFile(path.join(first, diagram.asset.path));
      assert.equal(`sha256:${digest(bytes)}`, diagram.asset.digest);
      assert.match(bytes.toString("utf8"), /^<svg\b/);
      assert.match(bytes.toString("utf8"), /<title\b|aria-label=/);
      assert.match(bytes.toString("utf8"), /<desc\b/);
    }

    const keys = structuralKeys(left.manifest);
    for (const targetSpecific of ["portal", "views", "viewId", "entry", "access", "contribution", "shell", "mkdocs", "theme", "plugins", "route", "cloudflare", "deployment", "siteUrl", "canonicalBase", "host", "baseUrl"]) {
      assert.equal(keys.has(targetSpecific), false, targetSpecific);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("materializer preserves exact sources and emits a strict static MkDocs input", async () => {
  const temporary = await mkdtemp(path.join(temporaryRoot, "superbee-docs-mkdocs-materialize-"));
  try {
    const projection = path.join(temporary, "projection");
    const output = path.join(temporary, "mkdocs");
    const { manifest } = await buildProjection({ root, output: projection });
    const result = await materializeMkDocs({ projection, output });
    assert.deepEqual(result, { output, documents: 19, diagrams: 4 });
    const config = await readFile(path.join(output, "mkdocs.yml"), "utf8");
    assert.match(config, /^site_name: "Superbee documentation"/);
    assert.match(config, /strict: true/);
    assert.match(config, /theme:\n  name: mkdocs/);
    assert.doesNotMatch(config, /^site_url:/m);
    assert.match(config, /hooks:\n  - hook\.py/);
    assert.match(config, /not_in_nav: \|/);
    for (const id of expectedSupport) assert.match(config, new RegExp(`  ${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.md`));
    assert.doesNotMatch(config, /views-registry|bundle\/views|runtime Mermaid/);
    for (const document of manifest.documents) {
      assert.deepEqual(
        await readFile(path.join(output, "docs", `${document.id}.md`)),
        await readFile(path.join(projection, document.source.path)),
      );
    }
    const hook = await readFile(path.join(output, "hook.py"), "utf8");
    assert.match(hook, /on_page_content/);
    assert.match(hook, /Open full-size diagram/);
    assert.doesNotMatch(hook, /mermaid|iframe|dialog/i);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("a selected document linking to an unselected local document fails instead of expanding publication", async () => {
  const temporary = await mkdtemp(path.join(temporaryRoot, "superbee-docs-mkdocs-boundary-"));
  try {
    await Promise.all([
      cp(path.join(root, ".superbee"), path.join(temporary, ".superbee"), { recursive: true }),
      cp(path.join(root, "diagrams"), path.join(temporary, "diagrams"), { recursive: true }),
      cp(path.join(root, "spikes"), path.join(temporary, "spikes"), { recursive: true }),
      cp(path.join(root, "portal.config.json"), path.join(temporary, "portal.config.json")),
    ]);
    const selected = path.join(temporary, ".superbee", "learn", "start-here.md");
    const before = await readFile(selected, "utf8");
    await writeFile(selected, `${before}\n[Unselected historical release](../releases/0.1.3.md)\n`);
    const output = path.join(temporary, "output");
    await assert.rejects(
      buildProjection({ root: temporary, output }),
      /selected document 'learn\/start-here' links to unselected local document 'releases\/0\.1\.3'/,
    );
    await assert.rejects(readFile(path.join(output, "projection.json")), (error) => error.code === "ENOENT");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
