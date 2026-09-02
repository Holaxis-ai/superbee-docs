import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DOCUMENTATION_CLOUDFLARE_TARGET_V1,
  DOCUMENTATION_RECONCILIATION_FAILURE_V1,
  documentationReconciliationProvenanceV1,
  inspectDocumentationCloudflareDesiredStateV1,
  reconcileDocumentationCloudflareV1,
} from "../scripts/reconcile-cloudflare.mjs";

const COMMIT = "a".repeat(40);
const REPOSITORY = "Holaxis-ai/superbee-docs";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-reconciliation-"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({
    dependencies: {
      "@superbee/portal": "0.2.3",
      "@superbee/portal-cloudflare": "0.2.2",
      superbee: "0.1.4",
    },
  }));
  return root;
}

test("Docs binds the exact artifact, host assembly, target, and immutable provenance", async () => {
  const root = await fixture();
  try {
    const provenance = await documentationReconciliationProvenanceV1({ repository: REPOSITORY, commit: COMMIT, root });
    assert.deepEqual(provenance, {
      source: { repository: REPOSITORY, commit: COMMIT, bundlePath: ".superbee" },
      site: { repository: REPOSITORY, commit: COMMIT, configPath: "portal.config.json" },
      toolchain: {
        superbee: "superbee@0.1.4",
        portal: "@superbee/portal@0.2.3",
        action: `@superbee/portal-cloudflare@0.2.2+superbee-docs/scripts/reconcile-cloudflare.mjs@${COMMIT}`,
      },
    });
    assert.deepEqual(DOCUMENTATION_CLOUDFLARE_TARGET_V1, {
      cwd: ".",
      artifactDirectory: "dist",
      staticAssetsDirectory: "deploy",
      liveUrl: "https://docs.getsuperbee.com/",
      targetId: "cloudflare:workers:superbee-docs:production",
      wranglerConfigPath: "wrangler.jsonc",
      wrapperPath: "scripts/cloudflare-worker.mjs",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("successful reconciliation persists the package receipt and exact activation inputs", async () => {
  const root = await fixture();
  const receipt = { schema: "fixture", outcome: "ACTIVATED_VERIFIED" };
  let observed;
  try {
    const actual = await reconcileDocumentationCloudflareV1({
      mode: "deploy",
      repository: REPOSITORY,
      desiredCommit: COMMIT,
      observedCommit: COMMIT,
      receiptPath: "receipts/cloudflare.json",
      cwd: root,
      reconcile: async (options) => {
        observed = options;
        return receipt;
      },
    });
    assert.equal(actual, receipt);
    assert.equal(observed.mode, "deploy");
    assert.equal(observed.target.artifactDirectory, "dist");
    assert.equal(observed.target.staticAssetsDirectory, "deploy");
    assert.equal(observed.expectedDesiredCommit, COMMIT);
    assert.equal(observed.observedDesiredCommit, COMMIT);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, "receipts/cloudflare.json"), "utf8")), receipt);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("offline desired-state inspection verifies the same complete activation target", async () => {
  const root = await fixture();
  let observed;
  try {
    const desired = await inspectDocumentationCloudflareDesiredStateV1({
      repository: REPOSITORY,
      desiredCommit: COMMIT,
      cwd: root,
      inspect: async (target, options) => {
        observed = { target, options };
        return { effect: `sha256:${"f".repeat(64)}` };
      },
    });
    assert.equal(desired.effect, `sha256:${"f".repeat(64)}`);
    assert.equal(observed.target.artifactDirectory, "dist");
    assert.equal(observed.target.staticAssetsDirectory, "deploy");
    assert.equal(observed.options.provenance.source.commit, COMMIT);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("post-activation recovery receipts and bounded preflight failures are always durable", async () => {
  const root = await fixture();
  try {
    const recovery = {
      schema: "https://getsuperbee.com/schemas/cloudflare-reconciliation/v1",
      outcome: "DEGRADED",
      recovery: { status: "RESTORED_VERIFIED" },
      failure: "new activation did not verify",
    };
    await assert.rejects(() => reconcileDocumentationCloudflareV1({
      mode: "deploy",
      repository: REPOSITORY,
      desiredCommit: COMMIT,
      observedCommit: COMMIT,
      receiptPath: "receipts/recovery.json",
      cwd: root,
      reconcile: async () => {
        const error = new Error("reconciliation failed");
        error.details = { receipt: recovery };
        throw error;
      },
    }), /reconciliation failed/u);
    assert.deepEqual(JSON.parse(await readFile(path.join(root, "receipts/recovery.json"), "utf8")), recovery);

    await assert.rejects(() => reconcileDocumentationCloudflareV1({
      mode: "probe",
      repository: REPOSITORY,
      desiredCommit: COMMIT,
      receiptPath: "receipts/preflight.json",
      cwd: root,
      observedAt: () => "2026-09-01T12:00:00.000Z",
      reconcile: async () => {
        const error = new Error("provider generation unavailable");
        error.code = "IO_ERROR";
        throw error;
      },
    }), /provider generation unavailable/u);
    const preflight = JSON.parse(await readFile(path.join(root, "receipts/preflight.json"), "utf8"));
    assert.equal(preflight.schema, DOCUMENTATION_RECONCILIATION_FAILURE_V1);
    assert.equal(preflight.outcome, "FAILED");
    assert.equal(preflight.failure.code, "IO_ERROR");
    assert.equal(preflight.failure.message, "provider generation unavailable");
    assert.equal("stack" in preflight.failure, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deploy refuses stale desired-state identity before the package can mutate", async () => {
  const root = await fixture();
  let calls = 0;
  try {
    await assert.rejects(() => reconcileDocumentationCloudflareV1({
      mode: "deploy",
      repository: REPOSITORY,
      desiredCommit: COMMIT,
      observedCommit: "b".repeat(40),
      receiptPath: "receipts/stale.json",
      cwd: root,
      reconcile: async () => {
        calls += 1;
        throw new Error("must not be called");
      },
    }), /desired commit changed/u);
    assert.equal(calls, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the workflow separates build from credentials and serializes durable reconciliation", async () => {
  const workflow = await readFile(".github/workflows/verify-production.yml", "utf8");
  assert.match(workflow, /jobs:\n  build:[\s\S]+\n  reconcile:/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(workflow, /cron: "17 9 \* \* \*"/u);
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}[\s\S]+path: dist/u);
  assert.match(workflow, /actions\/download-artifact@[0-9a-f]{40}[\s\S]+path: dist/u);
  assert.equal((workflow.match(/name: superbee-docs-portal-\$\{\{ github\.sha \}\}/gu) ?? []).length, 2);
  assert.match(workflow, /name: superbee-docs-portal-\$\{\{ github\.sha \}\}[\s\S]+overwrite: true/u);
  assert.doesNotMatch(workflow, /superbee-docs-portal-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}/u);
  assert.match(workflow, /RECONCILIATION_MODE: \$\{\{ github\.event_name == 'schedule' && 'probe' \|\| 'deploy' \}\}/u);
  assert.match(workflow, /if: always\(\)[\s\S]+cloudflare-reconciliation-receipt\.json[\s\S]+production-verification-receipt\.json/u);
  assert.match(workflow, /git fetch --no-tags origin main[\s\S]+--observed-commit/u);
  assert.equal((workflow.match(/CLOUDFLARE_API_TOKEN:/gu) ?? []).length, 1);
  const buildJob = workflow.slice(workflow.indexOf("  build:"), workflow.indexOf("  reconcile:"));
  assert.doesNotMatch(buildJob, /CLOUDFLARE|secrets\./u);
  assert.doesNotMatch(workflow, /npx wrangler deploy(?:\s|$)/u);
});
