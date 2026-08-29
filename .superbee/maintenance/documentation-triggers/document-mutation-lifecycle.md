---
type: Documentation Trigger
title: Document mutation lifecycle change trigger
description: >-
  Operational change triggers for the Document mutation lifecycle documentation
  page.
superbee_updated_by: openai/codex
---
# Affected pages

[Document mutation lifecycle](../../architecture/document-mutation-lifecycle.md)

# Source paths

- `packages/cli/src/cli.ts`
- `packages/cli/src/commands/doc/update.ts`
- `packages/cli/src/mutate.ts`
- `packages/core/src/document-mutation.ts`
- `packages/core/src/document-write-policy.ts`
- `packages/core/src/mutation-attribution.ts`
- `packages/core/src/mutation.ts`
- `packages/core/src/types.ts`
- `packages/core/src/backend.ts`
- `packages/core/src/filesystem-identity.ts`
- `packages/core/src/filesystem-lock.ts`
- `packages/core/src/remote-backend.ts`
- `packages/server/src/router.ts`
- `packages/cli/src/commands/sync/orchestrate.ts`
- `packages/cli/src/commands/sync/converge.ts`
- `packages/cli/src/commands/sync/establish.ts`
- `packages/board-git/src/porcelain.ts`
- `packages/board-git/src/diff.ts`
- `packages/board-git/src/channel.ts`
- `packages/board-git/src/engine.ts`
- `packages/board-git/src/flow.ts`

# Product events

- `document-mutation-policy`
- `sync-convergence-policy`

# Review action

Trace the mutation and synchronization path again, then update the page and diagram or record that the behavior is unchanged.

# Evidence

[pinned implementation evidence](../../sources/superbee-codebase-main.md)
