---
type: Documentation Trigger
title: Share and synchronize Git bundle change trigger
description: >-
  Operational change triggers for the Git-backed bundle sharing and
  synchronization guide.
superbee_updated_by: openai/codex
---
# Affected pages

[Share and synchronize a Git-backed bundle](../../guides/share-and-synchronize-git-bundle.md)

# Source paths

- `packages/board-git/src/channel.ts`
- `packages/board-git/src/autopull.ts`
- `packages/board-git/src/intree.ts`
- `packages/board-git/src/porcelain.ts`
- `packages/cli/src/autopull.ts`
- `packages/cli/src/cursor.ts`
- `packages/cli/src/commands/home.ts`
- `packages/cli/src/commands/session-start.ts`
- `packages/cli/src/commands/sync/orchestrate.ts`
- `packages/cli/src/commands/sync/converge.ts`
- `packages/cli/src/commands/sync/show-incoming.ts`
- `packages/cli/src/sync-outcomes.ts`

# Product events

- `board-channel-model`
- `shared-board-join`
- `sync-convergence-policy`
- `read-freshness-policy`
- `session-start-board-awareness`
- `awareness-cursor-contract`
- `stable-release-verified`

# Review action

Exercise the join, pull-only, full-sync, conflict recovery, in-tree, and SessionStart journeys for
the current stable package. Update the guide when a command, channel decision, receipt, awareness
boundary, or recovery path changes.

# Evidence

[Current stable release evidence](../../sources/current-release.md)

[Sharing, synchronization, and freshness architecture](../../architecture/sharing-synchronization-and-freshness.md)
