import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DOCUMENTATION_SELECTION_V1,
  validateDocumentationSelection,
} from "../scripts/documentation-selection.mjs";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));

test("production documentation selection owns the exact support allowlist", async () => {
  const [selection, schema, portal] = await Promise.all([
    json("documentation-selection.json"),
    json("schemas/documentation-selection-v1.schema.json"),
    json("portal.config.json"),
  ]);
  assert.deepEqual(Object.keys(selection).sort(), ["schema", "supportingDocuments"]);
  assert.equal(selection.schema, DOCUMENTATION_SELECTION_V1);
  assert.equal(schema.$id, DOCUMENTATION_SELECTION_V1);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["schema", "supportingDocuments"]);
  assert.equal(schema.properties.schema.const, DOCUMENTATION_SELECTION_V1);
  assert.equal(schema.properties.supportingDocuments.uniqueItems, true);
  assert.equal("minItems" in schema.properties.supportingDocuments, false);
  assert.equal(schema.properties.supportingDocuments.maxItems, 2048);
  assert.deepEqual(selection.supportingDocuments, [...selection.supportingDocuments].sort());

  const navigated = new Set(portal.documentation.navigation.flatMap((section) => section.documents));
  for (const id of selection.supportingDocuments) {
    assert.equal(navigated.has(id), false, id);
    const info = await lstat(path.join(".superbee", `${id}.md`));
    assert.equal(info.isFile(), true, id);
    assert.equal(info.isSymbolicLink(), false, id);
  }
  assert.deepEqual(await validateDocumentationSelection(selection, portal, path.resolve(".")), selection.supportingDocuments);
});

test("documentation selection admission handles generic temporary fixtures, including empty support", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "superbee-docs-selection-"));
  const portal = { documentation: { navigation: [{ documents: ["primary/start"] }] } };
  const selection = (supportingDocuments) => ({
    schema: DOCUMENTATION_SELECTION_V1,
    supportingDocuments,
  });
  try {
    await mkdir(path.join(temporary, ".superbee", "support"), { recursive: true });
    await writeFile(path.join(temporary, ".superbee", "support", "one.md"), "support\n");
    assert.deepEqual(await validateDocumentationSelection(selection([]), portal, temporary), []);
    assert.deepEqual(await validateDocumentationSelection(selection(["support/one"]), portal, temporary), ["support/one"]);
    await assert.rejects(
      validateDocumentationSelection(selection(["support/one", "support/one"]), portal, temporary),
      /unique and canonically ordered/,
    );
    await assert.rejects(
      validateDocumentationSelection(selection(["primary/start"]), portal, temporary),
      /overlaps primary navigation/,
    );
    await assert.rejects(
      validateDocumentationSelection(selection(["support/missing"]), portal, temporary),
      /absent from the public bundle/,
    );
    await symlink("one.md", path.join(temporary, ".superbee", "support", "linked.md"));
    await assert.rejects(
      validateDocumentationSelection(selection(["support/linked"]), portal, temporary),
      /must be a regular public bundle document/,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
