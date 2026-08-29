import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

export const DOCUMENTATION_SELECTION_V1 = "https://getsuperbee.com/schemas/superbee-docs-documentation-selection/v1";

export async function validateDocumentationSelection(selection, portalConfig, root) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)
    || JSON.stringify(Object.keys(selection).sort()) !== JSON.stringify(["schema", "supportingDocuments"])
    || selection.schema !== DOCUMENTATION_SELECTION_V1
    || !Array.isArray(selection.supportingDocuments)
    || selection.supportingDocuments.length > 2_048) {
    throw new Error("documentation selection must use the exact production v1 contract");
  }
  const supportingDocuments = selection.supportingDocuments;
  const canonicalSupport = [...supportingDocuments].sort();
  if (new Set(supportingDocuments).size !== supportingDocuments.length
    || supportingDocuments.some((id, index) => id !== canonicalSupport[index])) {
    throw new Error("documentation supportingDocuments must be unique and canonically ordered");
  }
  const navigated = new Set(portalConfig.documentation?.navigation?.flatMap((section) => section.documents ?? []) ?? []);
  for (const [index, id] of supportingDocuments.entries()) {
    if (typeof id !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(id)) {
      throw new Error(`documentation supportingDocuments[${index}] is not a safe document id`);
    }
    if (navigated.has(id)) throw new Error(`documentation support '${id}' overlaps primary navigation`);
    const document = resolve(root, ".superbee", `${id}.md`);
    const info = await lstat(document).catch((error) => {
      if (error?.code === "ENOENT") throw new Error(`documentation support '${id}' is absent from the public bundle`);
      throw error;
    });
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`documentation support '${id}' must be a regular public bundle document`);
    }
  }
  return supportingDocuments;
}
