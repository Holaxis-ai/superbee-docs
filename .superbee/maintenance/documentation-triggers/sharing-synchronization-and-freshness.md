---
type: Documentation Trigger
title: Sharing synchronization and freshness change trigger
description: >-
  Operational change triggers for the sharing, synchronization, and freshness
  architecture page.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T12:56:35.022Z'
---
# Affected pages

[Sharing, synchronization, and freshness](../../architecture/sharing-synchronization-and-freshness.md)

# Source paths

- `packages/board-git/src/channel.ts`
- `packages/board-git/src/autopull.ts`
- `packages/board-git/src/intree.ts`
- `packages/board-git/src/cursor.ts`
- `packages/board-git/src/porcelain.ts`
- `packages/cli/src/autopull.ts`
- `packages/cli/src/commands/sync/orchestrate.ts`
- `packages/cli/src/commands/sync/converge.ts`
- `packages/cli/src/sync-outcomes.ts`

- `packages/cli/src/commands/sync/gate.ts`
- `packages/cli/src/hosted/moved-marker.ts`

# Product events

- `board-channel-model`
- `sync-convergence-policy`
- `read-freshness-policy`
- `awareness-cursor-contract`

# Review action

Re-run the sharing, synchronization, and freshness review, then update the page and diagram or
record that the contract is unchanged.

# Evidence

[pinned implementation source](../../sources/superbee-codebase-main.md)
