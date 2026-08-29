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

test("built site preserves documentation, View, and presentation agreement", async () => {
  const [config, manifest, home, registeredView] = await Promise.all([
    json("portal.config.json"),
    json("dist/data/portal-manifest.json"),
    readFile("dist/index.html", "utf8"),
    readFile(".superbee/views/superbee-system-context.html"),
  ]);
  const paths = new Set(manifest.files.map((row) => row.path));
  for (const required of [
    "index.html",
    "docs/learn/start-here/index.html",
    "assets/docs-search.json",
    "sitemap.xml",
    "bundle/views/superbee-system-context.html",
  ]) assert.ok(paths.has(required), required);
  assert.equal(paths.has("explore/index.html"), false);
  assert.equal(manifest.presentation.contract, "https://getsuperbee.com/schemas/portal-presentation-contribution/v1");
  assert.equal(manifest.presentation.id, "documentation");
  assert.equal(manifest.presentation.producer.name, "superbee-portal-docs");
  assert.match(home, /Superbee/);
  assert.doesNotMatch(home, /href="\/explore\/"/);
  assert.equal(config.portal.views[0].entrySha256, sha256(registeredView));
});
