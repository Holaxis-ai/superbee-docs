import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const schemaId = "https://getsuperbee.com/schemas/superbee-docs-documentation-selection/v1";
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

const json = async (file) => JSON.parse(await readFile(file, "utf8"));

test("production documentation selection owns the exact support allowlist", async () => {
  const [selection, schema, portal] = await Promise.all([
    json("documentation-selection.json"),
    json("schemas/documentation-selection-v1.schema.json"),
    json("portal.config.json"),
  ]);
  assert.deepEqual(Object.keys(selection).sort(), ["schema", "supportingDocuments"]);
  assert.equal(selection.schema, schemaId);
  assert.equal(schema.$id, schemaId);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["schema", "supportingDocuments"]);
  assert.equal(schema.properties.schema.const, schemaId);
  assert.equal(schema.properties.supportingDocuments.uniqueItems, true);
  assert.equal(schema.properties.supportingDocuments.minItems, 1);
  assert.equal(schema.properties.supportingDocuments.maxItems, 2048);
  assert.deepEqual(selection.supportingDocuments, expectedSupport);
  assert.deepEqual(selection.supportingDocuments, [...selection.supportingDocuments].sort());

  const navigated = new Set(portal.documentation.navigation.flatMap((section) => section.documents));
  for (const id of selection.supportingDocuments) {
    assert.equal(navigated.has(id), false, id);
    const info = await lstat(path.join(".superbee", `${id}.md`));
    assert.equal(info.isFile(), true, id);
    assert.equal(info.isSymbolicLink(), false, id);
  }
});
