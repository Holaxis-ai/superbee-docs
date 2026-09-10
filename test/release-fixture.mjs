import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

async function document(bundle, id) {
  const body = await readFile(path.join(bundle, `${id}.md`), "utf8");
  const header = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(header, `frontmatter required: ${id}`);
  return { body, fields: yaml.load(header[1]) };
}

// Read the source fixtures independently of the release writer and output projection.
// Archive membership comes from immutable files, so an omitted publication entry still fails.
export async function releaseFixture(root = ".") {
  const bundle = path.join(root, ".superbee");
  const current = await document(bundle, "releases/current");
  const version = String(current.fields.version);
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const versions = (await readdir(path.join(bundle, "releases")))
    .filter((name) => /^\d+\.\d+\.\d+\.md$/.test(name))
    .map((name) => name.slice(0, -3)).sort();
  assert.ok(versions.includes(version), "current release must have an immutable record");
  const archive = versions.flatMap((value) => [`releases/${value}`, `sources/superbee-release-${value}`]);
  for (const value of versions) {
    assert.equal(String((await document(bundle, `releases/${value}`)).fields.version), value);
    await document(bundle, `sources/superbee-release-${value}`);
  }
  const publication = await document(bundle, "documentation-publications/current");
  const sections = [...publication.body.matchAll(/\[contains\]\(\.\.\/(documentation-sections\/[^)]+)\.md\)/g)]
    .map((match) => match[1]);
  assert.ok(sections.length > 0, "publication must select sections");
  const navigated = [...new Set((await Promise.all(sections.map(async (id) =>
    (await document(bundle, id)).fields.documents))).flat())].sort();
  const supporting = [
    "design/docs-operating-model", "design/site-experience-contract", "examples/claims-and-evidence",
    "plans/docs-coverage", "sources/current-release", "sources/superbee-codebase-main",
    "sources/superbee-core", "sources/superbee-portal", ...archive,
  ].sort();
  assert.deepEqual([...publication.fields.supporting_documents].sort(), supporting,
    "publication must preserve supporting pages and every immutable release/evidence pair");
  return { version, versions, archive, navigated, supporting,
    selected: [...new Set([...navigated, ...supporting])].sort() };
}
