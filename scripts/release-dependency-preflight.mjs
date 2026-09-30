import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const read = async (file) => JSON.parse(await readFile(file, "utf8"));
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const version = /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/;

// Direct registry dependencies plus locked transitive dependencies in their scopes cover this
// consumer's credential-bearing packages. This is access preflight, not a replacement for npm ci.
export function preflightPackages(lock, manifest, replacement) {
  const direct = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies };
  const scopes = new Set(Object.keys(direct).filter((name) => name.startsWith("@")).map((name) => name.split("/")[0]));
  const selected = new Map();
  for (const name of Object.keys(direct)) {
    if (!packageName.test(name) || !version.test(lock.packages?.[`node_modules/${name}`]?.version ?? "")) {
      throw new Error("Dependency preflight needs complete direct dependency entries in package-lock.json; restore the reviewed lockfile before installing.");
    }
  }
  for (const [key, entry] of Object.entries(lock.packages ?? {})) {
    if (!key) continue;
    const name = entry.name ?? key.split("node_modules/").at(-1);
    if (!Object.hasOwn(direct, name) && !scopes.has(name.split("/")[0])) continue;
    if (!packageName.test(name) || !version.test(entry.version ?? "")) throw new Error("dependency preflight requires locked registry package identities");
    const url = entry.resolved && new URL(entry.resolved);
    if (url && (url.origin !== "https://registry.npmjs.org" || url.username || url.password || url.search || url.hash)) {
      throw new Error("dependency preflight requires canonical npm registry tarballs");
    }
    selected.set(`${name}@${entry.version}`, { name, version: entry.version, tarball: entry.resolved, integrity: entry.integrity });
  }
  if (replacement) {
    for (const [key, value] of selected) if (value.name === "superbee") selected.delete(key);
    if (!version.test(replacement.version ?? "")) throw new Error("dependency preflight requires a stable replacement identity");
    selected.set(`superbee@${replacement.version}`, { name: "superbee", version: replacement.version,
      tarball: replacement.tarballUrl, integrity: replacement.npmIntegrity });
  }
  return [...selected.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

async function npmView(bin, args, root) {
  return (await exec(bin, args, { cwd: root, timeout: 30_000, maxBuffer: 1024 * 1024 })).stdout;
}

export async function dependencyPreflight(root, { run = npmView, replacement } = {}) {
  let lock, manifest;
  try { lock = await read(path.join(root, "package-lock.json")); manifest = await read(path.join(root, "package.json")); }
  catch { throw new Error("Dependency preflight requires readable valid package.json and package-lock.json; restore reviewed dependency inputs before installing."); }
  const packages = preflightPackages(lock, manifest, replacement);
  let index = 0;
  let failure;
  const worker = async () => {
    while (!failure && index < packages.length) {
      const pkg = packages[index++];
      const id = `${pkg.name}@${pkg.version}`;
      try {
        const dist = JSON.parse(await run("npm", ["view", id, "dist", "--json", "--prefer-online",
          "--fetch-retries=0", "--fetch-timeout=15000", "--registry=https://registry.npmjs.org"], root));
        const url = new URL(dist.tarball);
        if (url.origin !== "https://registry.npmjs.org" || url.username || url.password || url.search || url.hash ||
            (pkg.tarball && dist.tarball !== pkg.tarball) || (pkg.integrity && dist.integrity !== pkg.integrity)) throw new Error("metadata mismatch");
      } catch {
        // Never include npm output, config, registry responses, tokens, or workstation paths.
        failure ??= new Error(`Dependency metadata access or identity failed for ${id}. Dependency files were not changed. Check registry access for this exact package using your existing npm setup, then retry; CI uses its existing read credential. Preflight does not configure credentials.`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, packages.length) }, worker));
  if (failure) throw failure;
  return { status: "accessible", packages: packages.length, scope: "direct dependencies and their locked package scopes; clean npm ci remains required" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await dependencyPreflight(process.cwd()))); }
  catch (error) { console.error(JSON.stringify({ status: "blocked", reason: error.message })); process.exitCode = 1; }
}
