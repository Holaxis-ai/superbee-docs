import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readDocumentationSiteConfigV2 } from "@superbee/docs-tooling/site";

import { validateDocumentationSourceFiles } from "../scripts/documentation-source-files.mjs";

test("production config owns one normalized selection backed by public source files", async () => {
  const config = await readDocumentationSiteConfigV2("portal.config.json");
  const admitted = await validateDocumentationSourceFiles(config.documentation, path.resolve("."));

  assert.deepEqual(admitted.supportingDocuments, config.documentation.supportingDocuments);
  assert.deepEqual(admitted.guidance, config.documentation.guidance);
  assert.deepEqual(config.documentation.supportingDocuments, [...config.documentation.supportingDocuments].sort());
  const navigated = new Set(config.documentation.navigation.flatMap((section) => section.documents));
  for (const id of config.documentation.supportingDocuments) assert.equal(navigated.has(id), false, id);

  const bound = await readFile(path.join(".superbee", `${config.documentation.guidance.documentId}.md`), "utf8");
  assert.equal(
    bound.split("\n").filter((line) => line.trim() === `# ${config.documentation.guidance.heading}`).length,
    1,
  );
});

test("source validation rejects absent, linked, and stale consumer-owned facts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-source-files-"));
  try {
    await mkdir(path.join(root, ".superbee", "support"), { recursive: true });
    await mkdir(path.join(root, ".superbee", "primary"), { recursive: true });
    await writeFile(path.join(root, ".superbee", "support", "one.md"), "# Support\n");
    await writeFile(path.join(root, ".superbee", "primary", "start.md"), "# Start\n\n# Why\n\nUse it.\n");
    const documentation = {
      supportingDocuments: ["support/one"],
      guidance: { documentId: "primary/start", heading: "Why", label: "When to use it" },
    };
    assert.deepEqual(await validateDocumentationSourceFiles(documentation, root), {
      supportingDocuments: ["support/one"],
      guidance: documentation.guidance,
    });
    await assert.rejects(
      validateDocumentationSourceFiles({ ...documentation, supportingDocuments: ["support/missing"] }, root),
      /absent from the public bundle/,
    );
    await symlink("one.md", path.join(root, ".superbee", "support", "linked.md"));
    await assert.rejects(
      validateDocumentationSourceFiles({ ...documentation, supportingDocuments: ["support/linked"] }, root),
      /must be a regular public bundle document/,
    );
    await assert.rejects(
      validateDocumentationSourceFiles({ ...documentation, guidance: { ...documentation.guidance, heading: "Moved" } }, root),
      /must appear exactly once/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
