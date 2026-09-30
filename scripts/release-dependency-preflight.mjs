import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dependencyPreflight as checkMetadata, lockedRegistryPackages } from "./vendor/package-verification/src/preflight.mjs";
import { verifySnapshotIntegrity } from "./vendor/package-verification/src/snapshot.mjs";

export function preflightPackages(lock, manifest, replacement) {
  return lockedRegistryPackages(lock, [{ directory: "", manifest }], { allowMetadataOnly: ["wrangler"], replacements: replacement ? [{
    name: "superbee", version: replacement.version, tarball: replacement.tarballUrl, integrity: replacement.npmIntegrity,
  }] : [] });
}

export async function dependencyPreflight(root, { run, replacement } = {}) {
  // Integrity is checked in the real consumer; fixture roots supply dependency JSON only.
  try { await verifySnapshotIntegrity(fileURLToPath(new URL("./vendor/package-verification", import.meta.url))); }
  catch { throw new Error("Shared package verification snapshot admission failed; restore the reviewed generated files before changing dependencies."); }
  let lock, manifest;
  try {
    lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
    manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  } catch {
    throw new Error("Dependency preflight requires readable valid package.json and package-lock.json; restore reviewed dependency inputs before installing.");
  }
  return checkMetadata({ packages: preflightPackages(lock, manifest, replacement), cwd: root, run });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await dependencyPreflight(process.cwd()))); }
  catch (error) { console.error(JSON.stringify({ status: "blocked", reason: error.message })); process.exitCode = 1; }
}
