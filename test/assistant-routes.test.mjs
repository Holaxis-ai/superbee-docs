import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadPortalAssistantRoutesV1,
  PORTAL_ASSISTANT_ROUTES_PATH_V1,
  portalAssistantDocumentationPolicyV1,
  validatePortalAssistantRouteBytesV1,
} from "@superbee/portal/assistant-publication/v1";
import { loadValidatedPortalPublicationV2 } from "@superbee/portal/client/v2";

import { composeDocumentationOutputs } from "../scripts/documentation-outputs.mjs";

/*
 * Agent answers carry a page `url` only for documents listed in assets/assistant-routes.json. The
 * list has to be exactly the pages this build renders: the publication holds more documents than
 * the site has pages, and a guessed link would 404.
 */
test("the artifact lists exactly the rendered pages in its digest-checked routes file", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "superbee-docs-routes-"));
  try {
    const { artifact, projectionManifest } = await composeDocumentationOutputs({ mkdocsOutput: temporary });

    // The routes file is a published file, so it is in the manifest the artifact digest covers.
    const entry = artifact.manifest.files.find((file) => file.path === PORTAL_ASSISTANT_ROUTES_PATH_V1);
    assert.ok(entry, "the manifest lists assets/assistant-routes.json");
    assert.match(entry.digest, /^sha256:[0-9a-f]{64}$/u);

    // Portal's own loader accepts it against the publication and the hosting requirements.
    const fetchFromArtifact = async (requested) => {
      const bytes = artifact.files.get(String(requested).replace(/^\//u, ""));
      return new Response(bytes, { status: bytes ? 200 : 404 });
    };
    const publication = await loadValidatedPortalPublicationV2({ fetch: fetchFromArtifact });
    const routes = await loadPortalAssistantRoutesV1(publication, {
      fetch: fetchFromArtifact,
      policy: portalAssistantDocumentationPolicyV1,
    });
    assert.deepEqual(routes.views, []);

    // A known document maps to its real path.
    const byId = new Map(routes.documents.map((row) => [row.id, row.path]));
    assert.equal(byId.get("get-started/install-and-setup"), "/docs/get-started/install-and-setup/");
    assert.equal(byId.get("learn/start-here"), "/docs/learn/start-here/");

    // Every route is a page the artifact renders, and every rendered document page has a route.
    const pages = [...artifact.files.keys()]
      .filter((file) => /^docs\/.+\/index\.html$/u.test(file))
      .map((file) => file.slice("docs/".length, -"/index.html".length))
      .sort();
    assert.ok(pages.length > 0);
    assert.deepEqual([...byId.keys()].sort(), pages);
    for (const [id, route] of byId) {
      assert.equal(route, `/docs/${id}/`);
      assert.ok(artifact.files.has(`docs/${id}/index.html`), id);
    }

    // The bundle has more documents than pages. Those get no route, never a guessed one.
    const bundleDocuments = [...artifact.files.keys()]
      .filter((file) => file.startsWith("bundle/") && file.endsWith(".md"))
      .map((file) => file.slice("bundle/".length, -".md".length));
    const pageless = bundleDocuments.filter((id) => !byId.has(id));
    assert.ok(pageless.length > 0, "some bundle documents have no page");
    assert.equal(byId.has("conventions/documentation-publication"), false);
    assert.equal(artifact.files.has("docs/conventions/documentation-publication/index.html"), false);
    for (const id of pageless) assert.equal(artifact.files.has(`docs/${id}/index.html`), false, id);
    assert.equal(projectionManifest.selectedDocuments.every((id) => byId.has(id)), true,
      "every selected document renders a page and has its route");

    // Changed bytes are refused: the file's identity is the manifest's.
    const bytes = artifact.files.get(PORTAL_ASSISTANT_ROUTES_PATH_V1).slice();
    bytes[bytes.length - 3] ^= 1;
    await assert.rejects(validatePortalAssistantRouteBytesV1(bytes, publication, {
      hostingRequirementsBytes: artifact.files.get("data/hosting-requirements.json"),
    }), /identity changed/u);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
