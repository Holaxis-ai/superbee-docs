import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

async function authoredProseFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return authoredProseFiles(target);
    return entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".mmd"))
      ? [target]
      : [];
  }));
  return nested.flat().sort();
}

export function proseStyleFindings(file, content) {
  const findings = [];
  const lines = content.split("\n");

  const inspect = (text, line) => {
    for (const rule of RULES) {
      if (rule.pattern.test(text)) findings.push(`${file}:${line}: ${rule.label}`);
    }
  };

  if (file.endsWith(".mmd")) {
    for (const [index, line] of lines.entries()) inspect(line, index + 1);
    return findings;
  }

  let fence;
  let paragraph = [];
  let paragraphStart;
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    inspect(paragraph.join(" ").replace(/\s+/gu, " ").trim(), paragraphStart);
    paragraph = [];
    paragraphStart = undefined;
  };

  for (const [index, line] of lines.entries()) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (marker && fence === undefined) {
      flushParagraph();
      fence = { character: marker[0], length: marker.length };
      continue;
    }
    if (fence !== undefined) {
      const closing = new RegExp(`^\\s*${fence.character}{${fence.length},}\\s*$`, "u");
      if (closing.test(line)) fence = undefined;
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    if (paragraphStart === undefined) paragraphStart = index + 1;
    paragraph.push(line.trim());
  }
  flushParagraph();

  return findings;
}

export async function publicProseFindings(directory = PUBLIC_BUNDLE) {
  const findings = [];
  for (const file of await authoredProseFiles(directory)) {
    const relative = path.relative(process.cwd(), file);
    findings.push(...proseStyleFindings(relative, await readFile(file, "utf8")));
  }
  return findings;
}

async function main() {
  const findings = await publicProseFindings();
  if (findings.length > 0) {
    console.error("Public documentation prose check failed:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log("Public documentation prose check passed.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
