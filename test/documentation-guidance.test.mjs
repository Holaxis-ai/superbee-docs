import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readDocumentationSiteConfigV3 } from "@superbee/docs-tooling/site";

import { validateDocumentationGuidance } from "../scripts/documentation-guidance.mjs";

test("production config owns one guidance binding backed by a public source file", async () => {
  const config = await readDocumentationSiteConfigV3("portal.config.json");
  const admitted = await validateDocumentationGuidance(config.documentation, path.resolve("."));

  assert.deepEqual(admitted, config.documentation.guidance);

  const bound = await readFile(path.join(".superbee", `${config.documentation.guidance.documentId}.md`), "utf8");
  assert.equal(
    bound.split("\n").filter((line) => line.trim() === `# ${config.documentation.guidance.heading}`).length,
    1,
  );
});

test("guidance validation rejects absent, linked, and stale consumer-owned facts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-source-files-"));
  try {
    await mkdir(path.join(root, ".superbee", "primary"), { recursive: true });
    await writeFile(path.join(root, ".superbee", "primary", "start.md"), "# Start\n\n# Why\n\nUse it.\n");
    const documentation = {
      guidance: { documentId: "primary/start", heading: "Why", label: "When to use it" },
    };
    assert.deepEqual(await validateDocumentationGuidance(documentation, root), documentation.guidance);
    await assert.rejects(
      validateDocumentationGuidance({ guidance: { ...documentation.guidance, documentId: "primary/missing" } }, root),
      /absent from the public bundle/,
    );
    await symlink("start.md", path.join(root, ".superbee", "primary", "linked.md"));
    await assert.rejects(
      validateDocumentationGuidance({ guidance: { ...documentation.guidance, documentId: "primary/linked" } }, root),
      /must be a regular public bundle document/,
    );
    await assert.rejects(
      validateDocumentationGuidance({ ...documentation, guidance: { ...documentation.guidance, heading: "Moved" } }, root),
      /must appear exactly once/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
