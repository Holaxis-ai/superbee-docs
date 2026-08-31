---
type: Documentation Trigger
title: Assigned work lifecycle change trigger
description: Operational change triggers for the assigned-work lifecycle guide.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Assigned work lifecycle](../../guides/assigned-work-lifecycle.md)

# Source paths

- `packages/cli/src/commands/list.ts`
- `packages/cli/src/commands/doc.ts`
- `packages/cli/src/commands/link.ts`
- `packages/cli/references/recipes/tasks/**`
- `packages/core/src/document-mutation.ts`
- `packages/core/src/query-selection.ts`

# Product events

- `task-convention-change`
- `guarded-document-mutation`
- `assignment-lifecycle`
- `task-evidence-linking`

# Review action

Run the claim, stale-claim, evidence-link, body-update, and close journey against the stable package.
Update field names, terminal behavior, receipts, and recovery guidance that changed.

# Evidence

[current release evidence](../../sources/current-release.md)
