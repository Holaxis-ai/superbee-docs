/*
 * Bind Superbee Docs' immutable source and target identity to Portal's public Cloudflare
 * reconciler. Provider planning, activation, verification, and rollback remain package-owned.
 */

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  inspectCloudflareDesiredState,
  reconcileCloudflarePortal,
} from "@superbee/portal-cloudflare/reconcile";

export const DOCUMENTATION_CLOUDFLARE_TARGET_V1 = Object.freeze({
  cwd: ".",
  artifactDirectory: "dist",
  staticAssetsDirectory: "deploy",
  liveUrl: "https://docs.getsuperbee.com/",
  targetId: "cloudflare:workers:superbee-docs:production",
  wranglerConfigPath: "wrangler.jsonc",
  wrapperPath: "scripts/cloudflare-worker.mjs",
});

export const DOCUMENTATION_RECONCILIATION_FAILURE_V1 =
  "https://getsuperbee.com/schemas/superbee-docs/cloudflare-reconciliation-failure/v1";

function currentGitCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function assertCommit(value, field) {
  if (typeof value !== "string" || !/^[0-9a-f]{40,64}$/iu.test(value)) {
    throw new Error(`${field} must be a 40 to 64 character hexadecimal Git object ID`);
  }
  return value.toLowerCase();
}

export async function documentationReconciliationProvenanceV1({ repository, commit, root = "." }) {
  if (typeof repository !== "string" || !/^[^/\s]+\/[^/\s]+$/u.test(repository)) {
    throw new Error("source repository must be an owner/repository identity");
  }
  const desired = assertCommit(commit, "source commit");
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const version = (name) => {
    const value = manifest.dependencies?.[name];
    if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/u.test(value)) {
      throw new Error(`dependency ${name} must be pinned to one exact release`);
    }
    return `${name}@${value}`;
  };
  return Object.freeze({
    source: Object.freeze({ repository, commit: desired, bundlePath: ".superbee" }),
    site: Object.freeze({ repository, commit: desired, configPath: "portal.config.json" }),
    toolchain: Object.freeze({
      superbee: version("superbee"),
      portal: version("@superbee/portal"),
      action: `${version("@superbee/portal-cloudflare")}+superbee-docs/scripts/reconcile-cloudflare.mjs@${desired}`,
    }),
  });
}

export async function writeReconciliationReceiptV1(receipt, destination) {
  const absolute = path.resolve(destination);
  await mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await rename(temporary, absolute);
  return absolute;
}

export async function inspectDocumentationCloudflareDesiredStateV1({
  repository,
  desiredCommit,
  cwd = ".",
  inspect = inspectCloudflareDesiredState,
}) {
  const commit = assertCommit(desiredCommit, "desired commit");
  const provenance = await documentationReconciliationProvenanceV1({ repository, commit, root: cwd });
  const target = Object.freeze({ ...DOCUMENTATION_CLOUDFLARE_TARGET_V1, cwd: path.resolve(cwd) });
  return inspect(target, { provenance });
}

function safeFailure(error) {
  return Object.freeze({
    name: error instanceof Error && error.name ? error.name : "Error",
    ...(error && typeof error === "object" && typeof error.code === "string" ? { code: error.code } : {}),
    message: error instanceof Error ? error.message : String(error),
  });
}

export async function reconcileDocumentationCloudflareV1({
  mode,
  repository,
  desiredCommit,
  observedCommit,
  receiptPath,
  cwd = ".",
  reconcile = reconcileCloudflarePortal,
  observedAt = () => new Date().toISOString(),
}) {
  if (!["plan", "deploy", "probe"].includes(mode)) throw new Error("mode must be plan, deploy, or probe");
  const commit = assertCommit(desiredCommit, "desired commit");
  const observed = mode === "deploy" ? assertCommit(observedCommit, "observed desired commit") : null;
  const provenance = await documentationReconciliationProvenanceV1({ repository, commit, root: cwd });
  const target = Object.freeze({ ...DOCUMENTATION_CLOUDFLARE_TARGET_V1, cwd: path.resolve(cwd) });
  try {
    if (observed !== null && observed !== commit) {
      throw new Error(`desired commit changed before activation: expected ${commit}, observed ${observed}`);
    }
    const receipt = await reconcile({
      mode,
      target,
      provenance,
      ...(mode === "deploy" ? {
        expectedDesiredCommit: commit,
        observedDesiredCommit: observed,
      } : {}),
    });
    await writeReconciliationReceiptV1(receipt, path.resolve(cwd, receiptPath));
    return receipt;
  } catch (error) {
    const receipt = error && typeof error === "object" && error.details?.receipt
      ? error.details.receipt
      : Object.freeze({
          schema: DOCUMENTATION_RECONCILIATION_FAILURE_V1,
          outcome: "FAILED",
          observedAt: observedAt(),
          mode,
          target: Object.freeze({ id: target.targetId, liveUrl: target.liveUrl }),
          provenance,
          failure: safeFailure(error),
        });
    await writeReconciliationReceiptV1(receipt, path.resolve(cwd, receiptPath));
    throw error;
  }
}

function options(argv) {
  const parsed = {
    mode: null,
    repository: process.env.GITHUB_REPOSITORY ?? "Holaxis-ai/superbee-docs",
    desiredCommit: process.env.GITHUB_SHA ?? currentGitCommit(),
    observedCommit: null,
    receiptPath: "cloudflare-reconciliation-receipt.json",
  };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--mode" && value) parsed.mode = value;
    else if (flag === "--repository" && value) parsed.repository = value;
    else if (flag === "--desired-commit" && value) parsed.desiredCommit = value;
    else if (flag === "--observed-commit" && value) parsed.observedCommit = value;
    else if (flag === "--receipt" && value) parsed.receiptPath = value;
    else throw new Error([
      "usage: node scripts/reconcile-cloudflare.mjs --mode <plan|deploy|probe>",
      "[--repository <owner/repository>] [--desired-commit <commit>]",
      "[--observed-commit <commit>] [--receipt <path>]",
    ].join(" "));
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const receipt = await reconcileDocumentationCloudflareV1(options(process.argv.slice(2)));
  console.log(JSON.stringify(receipt, null, 2));
}
