import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function canonicalTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : undefined;
}

function meaningfulChangeTime(frontmatter) {
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    return { present: false, value: undefined };
  }
  const generated = frontmatter.generated;
  if (generated && typeof generated === "object" && !Array.isArray(generated)
    && Object.hasOwn(generated, "at")) {
    return { present: true, value: canonicalTimestamp(generated.at) };
  }
  if (Object.hasOwn(frontmatter, "timestamp")) {
    return { present: true, value: canonicalTimestamp(frontmatter.timestamp) };
  }
  return { present: false, value: undefined };
}

async function git(root, args) {
  try {
    return (await execFileAsync("git", args, { cwd: root, maxBuffer: 1024 * 1024 })).stdout.trim();
  } catch {
    return undefined;
  }
}

async function committedChangeTime(root, file) {
  const resolvedRoot = await realpath(root).catch(() => undefined);
  if (!resolvedRoot) return undefined;
  const repository = await git(resolvedRoot, ["rev-parse", "--show-toplevel"]);
  if (!repository || path.resolve(repository) !== resolvedRoot) return undefined;
  if (await git(resolvedRoot, ["rev-parse", "--is-shallow-repository"]) !== "false") return undefined;
  const relative = path.relative(path.resolve(root), path.resolve(file)).split(path.sep).join("/");
  if (!relative || relative.startsWith("../")) return undefined;
  if (await git(resolvedRoot, ["ls-files", "--error-unmatch", "--", relative]) !== relative) return undefined;
  if (await git(resolvedRoot, ["diff", "--quiet", "HEAD", "--", relative]) === undefined) return undefined;
  return canonicalTimestamp(await git(resolvedRoot, ["log", "-1", "--format=%cI", "--", relative]));
}

/**
 * Derive displayable update facts from immutable document bytes or their committed Git history.
 * Unknown, dirty, untracked, or shallow-history facts are omitted instead of guessed.
 */
export async function deriveDocumentationFreshness({ root, bundle, snapshot, documentIds }) {
  const byId = new Map(snapshot.manifest.documents.map((document) => [document.id, document]));
  const facts = [];
  for (const documentId of [...documentIds].sort()) {
    const document = byId.get(documentId);
    if (!document) throw new Error(`freshness selection references absent document '${documentId}'`);
    const clock = meaningfulChangeTime(document.frontmatter);
    const updatedAt = clock.present
      ? clock.value
      : await committedChangeTime(root, path.join(bundle, ...documentId.split("/")) + ".md");
    if (!updatedAt) continue;
    facts.push({ documentId, sourceVersion: document.version, updatedAt });
  }
  return facts;
}
