import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assembleDocumentationDeploymentV1,
  DEPLOYMENT_REDIRECTS,
} from "../scripts/deployment-assets.mjs";

test("Docs contributes only its two exact entry redirects to package-owned assembly", async () => {
  assert.deepEqual([...DEPLOYMENT_REDIRECTS], [
    { from: "/docs", to: "/", status: 301 },
    { from: "/docs/", to: "/", status: 301 },
  ]);
  for (const rule of DEPLOYMENT_REDIRECTS) {
    assert.match(rule.from, /^\/[^\s*]*$/u);
    assert.doesNotMatch(rule.from, /:[A-Za-z]/u);
  }

  let observed;
  const receipt = await assembleDocumentationDeploymentV1({
    artifactDirectory: "fixture-dist",
    outputDirectory: "fixture-deploy",
    assemble: async (options) => {
      observed = options;
      return { ok: true };
    },
  });
  assert.deepEqual(observed, {
    artifactDirectory: "fixture-dist",
    outputDirectory: "fixture-deploy",
    redirects: DEPLOYMENT_REDIRECTS,
    generator: "superbee-docs/scripts/deployment-assets.mjs",
  });
  assert.deepEqual(receipt, { ok: true });
});

test("the completed deployment keeps Portal canonical 307 aliases beside Docs entry redirects", async () => {
  const redirects = await readFile("deploy/_redirects", "utf8");
  const requirements = JSON.parse(await readFile("dist/data/hosting-requirements.json", "utf8"));
  const declared = requirements.redirects.map(({ source, destination, status }) => (
    `${source} ${destination} ${status}`
  ));
  const rendered = redirects.split("\n").filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(rendered.slice(0, declared.length), declared);
  assert.ok(declared.length > 0, "the current documentation artifact declares canonical aliases");
  assert.ok(declared.every((line) => line.endsWith(" 307")), "canonical aliases stay temporary 307 redirects");
  assert.deepEqual(rendered.slice(declared.length), ["/docs / 301", "/docs/ / 301"]);
});
