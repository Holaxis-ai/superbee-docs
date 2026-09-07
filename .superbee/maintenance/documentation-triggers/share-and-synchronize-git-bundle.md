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

- `README.md`
- `packages/board-git/src/errors.ts`
- `packages/board-git/src/channel.ts`
- `packages/board-git/src/autopull.ts`
- `packages/board-git/src/intree.ts`
- `packages/board-git/src/porcelain.ts`
- `packages/board-git/test/channel.test.ts`
- `packages/board-git/test/git-porcelain.test.ts`
- `packages/cli/src/autopull.ts`
- `packages/cli/src/command-spec.ts`
- `packages/cli/src/cursor.ts`
- `packages/cli/SKILL.md`
- `packages/cli/src/commands/home.ts`
- `packages/cli/src/commands/list.ts`
- `packages/cli/src/commands/doc/read.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/src/commands/link.ts`
- `packages/cli/src/commands/view.ts`
- `packages/cli/src/commands/session-start.ts`
- `packages/cli/src/commands/sync/establish.ts`
- `packages/cli/src/commands/sync/establish-committed.ts`
- `packages/cli/src/commands/sync/orchestrate.ts`
- `packages/cli/src/commands/sync/converge.ts`
- `packages/cli/src/commands/sync/show-incoming.ts`
- `packages/cli/src/skill-render.ts`
- `packages/cli/src/sync-outcomes.ts`
- `packages/cli/src/ui/sharing.ts`
- `packages/cli/test/board-git-errors.test.ts`
- `packages/cli/test/command-spec.test.ts`
- `packages/cli/test/fixtures/sync-outcomes/**`
- `packages/cli/test/skill-distribution.test.ts`
- `packages/cli/test/sync-establish.test.ts`
- `packages/cli/test/sync-establish-committed.test.ts`
- `packages/cli/test/sync-intree.test.ts`
- `packages/cli/test/sync-outcomes.test.ts`
- `packages/cli/test/sync.test.ts`
- `packages/cli/test/ui-sharing.test.ts`
- `packages/ui/src/views/Launcher.tsx`
- `packages/ui/src/views/Launcher.test.tsx`
- `packages/ui-server/test/config.test.ts`

# Product events

- `board-channel-model`
- `bundle-sharing-permissions`
- `repository-before-board`
- `shared-board-join`
- `shared-board-establishment`
- `sync-convergence-policy`
- `read-freshness-policy`
- `session-start-board-awareness`
- `awareness-cursor-contract`
- `stable-release-verified`

# Review action

Exercise the no-Git, no-origin, remote-unknown, establish, join, pull-only, full-sync, denied-push,
conflict recovery, in-tree, and SessionStart journeys for the current stable package. Recheck the
three-system explanation and owner, member, and outside-collaborator handoffs when repository
creation, board establishment, Git classification, Skill guidance, UI copy, or recovery behavior
changes. Keep provider facts linked to current official GitHub guidance and keep unreleased runtime
fields out of stable-package claims.

# Evidence

[Current stable release evidence](../../sources/current-release.md)

[Sharing, synchronization, and freshness architecture](../../architecture/sharing-synchronization-and-freshness.md)
