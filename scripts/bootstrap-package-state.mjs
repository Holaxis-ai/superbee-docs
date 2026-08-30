import { rm } from "node:fs/promises";
import { resolve } from "node:path";

/** Packages staged from exact source pins by scripts/bootstrap-tools.mjs. */
export const BOOTSTRAPPED_PACKAGES = [
  "superbee",
  "superbee-portal",
  "@superbee/docs-projection",
  "@superbee/portal-docs",
  "@superbee/docs-tooling",
  "@superbee/docs-mkdocs",
];

/**
 * Remove prior same-version package bytes before npm installs the newly packed exact pins.
 * Build hosts may restore node_modules between runs, while these unpublished packages keep a
 * stable version. npm can otherwise treat stale bytes as already satisfied.
 */
export async function removeBootstrappedPackages(root) {
  await Promise.all(BOOTSTRAPPED_PACKAGES.map((name) =>
    rm(resolve(root, "node_modules", ...name.split("/")), { recursive: true, force: true })));
}
