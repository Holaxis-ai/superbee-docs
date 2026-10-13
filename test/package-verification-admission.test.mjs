import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("missing and malformed snapshot admission stays private before dependencies/docs change", async (t) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "docs-snapshot-admission-")));
  t.after(() => rm(root, {recursive:true,force:true}));
  await mkdir(path.join(root,"scripts/vendor"),{recursive:true});
  await cp("scripts/vendor/package-verification",path.join(root,"scripts/vendor/package-verification"),{recursive:true});
  for (const name of ["release-dependency-preflight.mjs","release-package-journeys.mjs"]) await cp(`scripts/${name}`,path.join(root,"scripts",name));
  await mkdir(path.join(root,".superbee/sources"),{recursive:true});
  await cp(".superbee/sources/current-release.md",path.join(root,".superbee/sources/current-release.md"));
  await cp("package.json",path.join(root,"package.json"));
  await cp("package-lock.json",path.join(root,"package-lock.json"));
  await mkdir(path.join(root,"node_modules"));
  await writeFile(path.join(root,"node_modules/retained"),"existing dependencies");
  const preserved=["package.json","package-lock.json",".superbee/sources/current-release.md","node_modules/retained"];
  const before=await Promise.all(preserved.map(file=>readFile(path.join(root,file))));
  const manifest=path.join(root,"scripts/vendor/package-verification/snapshot.json");
  for (const state of ["malformed","missing"]) {
    if (state === "malformed") await writeFile(manifest,"synthetic-private-token /private/synthetic-path invalid JSON");
    else await rm(manifest);
    for (const script of ["release-dependency-preflight.mjs","release-package-journeys.mjs"]) {
      const result=spawnSync(process.execPath,[path.join(root,"scripts",script)],{cwd:root,env:{PATH:process.env.PATH},encoding:"utf8",timeout:10_000});
      assert.equal(result.status,1);
      const output=`${result.stdout}${result.stderr}`;
      assert.match(output,/restore/i);
      assert.doesNotMatch(output,/synthetic-private-token|\/private\/synthetic-path/);
      assert.ok(!output.includes(root),"temporary paths must not escape diagnostics");
      assert.deepEqual(await Promise.all(preserved.map(file=>readFile(path.join(root,file)))),before);
    }
  }
});
