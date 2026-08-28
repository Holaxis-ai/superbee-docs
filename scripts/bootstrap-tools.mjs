import { execFile } from "node:child_process";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, ".deps/source");
const packs = resolve(root, ".deps/packs");
const pins = {
  superbee: { repository: "https://github.com/Holaxis-ai/superbee.git", commit: "070426446c00bc1f04ae54007930ce726fec913c" },
  portal: { repository: "https://github.com/Holaxis-ai/superbee-portal.git", commit: "5b822be675c8c3641b856ae728af5026d381184f" },
};

async function run(command, args, cwd = root) {
  const result = await execFileAsync(command, args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return result.stdout.trim();
}

async function isDirectory(path) {
  try { return (await stat(path)).isDirectory(); } catch { return false; }
}

async function exactCheckout(name, pin) {
  const target = resolve(sourceRoot, name);
  if (!(await isDirectory(target))) {
    await run("git", ["clone", "--filter=blob:none", pin.repository, target]);
    await run("git", ["checkout", "--detach", pin.commit], target);
  }
  const observed = await run("git", ["rev-parse", "HEAD"], target);
  if (observed !== pin.commit) throw new Error(`${name} dependency is ${observed}; remove .deps/source/${name} and rerun`);
  const dirty = await run("git", ["status", "--porcelain=v1", "--untracked-files=all"], target);
  if (dirty !== "") throw new Error(`${name} dependency checkout is dirty; remove .deps/source/${name} and rerun`);
  return target;
}

await mkdir(sourceRoot, { recursive: true });
await rm(packs, { recursive: true, force: true });
await mkdir(packs, { recursive: true });

const superbee = await exactCheckout("superbee", pins.superbee);
await run("npm", ["ci"], superbee);
await run("npm", ["run", "build", "-w", "superbee"], superbee);
await run("npm", ["pack", resolve(superbee, "packages/cli"), "--pack-destination", packs]);

const superbeePack = resolve(packs, (await readdir(packs)).find((name) => name.startsWith("superbee-") && name.endsWith(".tgz")));
const portal = await exactCheckout("portal", pins.portal);
await run("npm", ["ci", "--legacy-peer-deps"], portal);
// npm does not materialize an explicit tarball that only satisfies an unpublished peer in this
// workspace. Stage the exact packed public package, then copy that package into the build-only
// checkout without modifying its package metadata or lockfile.
const buildPeers = resolve(root, ".deps/build-peers");
await rm(buildPeers, { recursive: true, force: true });
await mkdir(buildPeers, { recursive: true });
await run("npm", ["install", "--prefix", buildPeers, "--no-save", "--package-lock=false", "--legacy-peer-deps", superbeePack]);
await cp(resolve(buildPeers, "node_modules/superbee"), resolve(portal, "node_modules/superbee"), { recursive: true });
await run("npm", ["run", "build"], portal);
await run("npm", ["pack", portal, "--pack-destination", packs]);
await run("npm", ["pack", resolve(portal, "packages/portal-docs"), "--pack-destination", packs]);
await run("npm", ["pack", resolve(portal, "packages/docs-tooling"), "--pack-destination", packs]);

const packageFiles = (await readdir(packs)).filter((name) => name.endsWith(".tgz")).map((name) => resolve(packs, name));
await run("npm", ["install", "--no-save", "--package-lock=false", "--legacy-peer-deps", ...packageFiles]);
console.log(`tools_bootstrap: complete\nsuperbee: ${pins.superbee.commit}\nportal: ${pins.portal.commit}`);
