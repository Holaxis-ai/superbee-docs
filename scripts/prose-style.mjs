import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PUBLIC_BUNDLE = path.resolve(".superbee");
const RULES = [
  { label: "em dash", pattern: /\u2014/u },
  { label: "load-bearing", pattern: /\bload-bearing\b/iu },
  { label: "not just/merely/simply", pattern: /\bnot\s+(?:just|merely|simply)\b/iu },
  {
    label: "not X, but Y contrast",
    pattern: /\b(?:is|are|was|were|does|do|did|can|could|should|would|will|has|have|had)\s+not\s+[^.;:\n]{1,80},?\s+but\b/iu,
  },
  {
    label: "X is not Y; it is Z contrast",
    pattern: /(?:^|[.!?]\s+)[A-Z][^.;:\n]{0,50}\s(?:is|are|was|were)\snot\b[^.;\n]{1,80}[.;]\s+(?:it|this|that|these|those|they|we)\s(?:is|are|was|were)\b/iu,
  },
];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(target);
    return entry.isFile() && entry.name.endsWith(".md") ? [target] : [];
  }));
  return nested.flat().sort();
}

const findings = [];
for (const file of await markdownFiles(PUBLIC_BUNDLE)) {
  const lines = (await readFile(file, "utf8")).split("\n");
  for (const [index, line] of lines.entries()) {
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push(`${path.relative(process.cwd(), file)}:${index + 1}: ${rule.label}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Public documentation prose check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log("Public documentation prose check passed.");
}
