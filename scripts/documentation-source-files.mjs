import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

async function regularDocument(root, id, subject) {
  const file = path.resolve(root, ".superbee", `${id}.md`);
  const info = await lstat(file).catch((error) => {
    if (error?.code === "ENOENT") throw new Error(`${subject} '${id}' is absent from the public bundle`);
    throw error;
  });
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${subject} '${id}' must be a regular public bundle document`);
  }
  return file;
}

/** Verify consumer-owned source facts that a package-level config normalizer cannot inspect. */
export async function validateDocumentationSourceFiles(documentation, root) {
  const supportingDocuments = documentation.supportingDocuments ?? [];
  for (const id of supportingDocuments) await regularDocument(root, id, "documentation support");

  if (documentation.guidance) {
    const file = await regularDocument(root, documentation.guidance.documentId, "documentation guidance");
    const markdown = await readFile(file, "utf8");
    const heading = `# ${documentation.guidance.heading}`;
    if (markdown.split("\n").filter((line) => line.trim() === heading).length !== 1) {
      throw new Error(`documentation guidance heading '${documentation.guidance.heading}' must appear exactly once in '${documentation.guidance.documentId}'`);
    }
  }
  return Object.freeze({ supportingDocuments: [...supportingDocuments], ...(documentation.guidance ? { guidance: documentation.guidance } : {}) });
}
