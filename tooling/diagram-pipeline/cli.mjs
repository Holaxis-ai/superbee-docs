#!/usr/bin/env node
import { resolve } from "node:path";
import { checkAgreement, compileAll } from "./src/index.mjs";

function options(argv) {
  const command = argv[0];
  const out = { command, root: ".", manifest: "diagrams/manifest.json", output: ".tmp/diagrams" };
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value || !["--root", "--manifest", "--output"].includes(key)) throw new Error(`unknown or incomplete option '${key ?? ""}'`);
    out[key.slice(2)] = value;
  }
  return out;
}

try {
  const input = options(process.argv.slice(2));
  if (input.command === "build") {
    const result = await compileAll({ root: resolve(input.root), manifestPath: input.manifest, outputDir: resolve(input.output) });
    console.log(`diagram_build: complete\ncount: ${result.rows.length}\noutput: ${resolve(input.output)}`);
  } else if (input.command === "check") {
    const result = await checkAgreement({ root: resolve(input.root), manifestPath: input.manifest });
    console.log(`diagram_check: passed\ncount: ${result.count}`);
    for (const row of result.rows) console.log(`- ${row.id}: ${row.view}`);
  } else {
    throw new Error("usage: superbee-docs-diagrams <build|check> [--root <path>] [--manifest <path>] [--output <path>]");
  }
} catch (error) {
  console.error(`diagram_error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
