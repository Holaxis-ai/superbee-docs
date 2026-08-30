import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

export const DOCUMENTATION_SELECTION_V1 = "https://getsuperbee.com/schemas/superbee-docs-documentation-selection/v1";

/**
 * The agent entry point quotes one exact section of one already-selected page. Only the pointer is
 * configured here; the quoted bytes and their links stay owned by the published document, so this
 * file can never become a second content authority.
 */
function validateAgentGuidance(guidance, selected) {
  if (guidance === undefined) return undefined;
  if (!guidance || typeof guidance !== "object" || Array.isArray(guidance)
    || JSON.stringify(Object.keys(guidance).sort()) !== JSON.stringify(["documentId", "heading", "label"])
    || typeof guidance.documentId !== "string" || typeof guidance.heading !== "string" || typeof guidance.label !== "string"
    || !guidance.documentId.trim() || !guidance.heading.trim() || !guidance.label.trim()) {
    throw new Error("documentation agentGuidance must name one documentId, heading, and label");
  }
  if (!selected.has(guidance.documentId)) {
    throw new Error(`documentation agentGuidance '${guidance.documentId}' is not a selected documentation page`);
  }
  return { documentId: guidance.documentId, heading: guidance.heading, label: guidance.label };
}

export async function validateDocumentationSelection(selection, portalConfig, root) {
  const keys = ["schema", "supportingDocuments"];
  if (selection && typeof selection === "object" && !Array.isArray(selection) && Object.hasOwn(selection, "agentGuidance")) {
    keys.push("agentGuidance");
  }
  if (!selection || typeof selection !== "object" || Array.isArray(selection)
    || JSON.stringify(Object.keys(selection).sort()) !== JSON.stringify([...keys].sort())
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
  const agentGuidance = validateAgentGuidance(
    selection.agentGuidance,
    new Set([...navigated, ...supportingDocuments]),
  );
  return { supportingDocuments, ...(agentGuidance ? { agentGuidance } : {}) };
}
