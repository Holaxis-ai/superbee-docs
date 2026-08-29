---
type: Documentation Trigger
title: Migrate or upgrade safely change trigger
description: >-
  Operational change triggers for the Migrate or upgrade safely documentation
  page.
superbee_updated_by: openai/codex
---
# Affected pages

[Migrate or upgrade safely](../../guides/migrate-or-upgrade-safely.md)

# Source paths

- `packages/cli/src/setup-plan.ts`
- `packages/cli/src/user-state-migration.ts`
- `packages/cli/src/bundle.ts`
- `packages/cli/src/commands/setup.ts`

# Product events

- `npm-update-command`
- `private-state-migration`
- `legacy-workspace-discovery`
- `okf-edition-migration`
- `legacy-view-migration`

# Review action

Exercise the applicable upgrade and migration paths and update the procedure, compatibility window, and recovery guidance.

# Evidence

[current release evidence](../../sources/current-release.md)
