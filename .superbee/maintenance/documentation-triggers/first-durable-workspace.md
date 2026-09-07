---
type: Documentation Trigger
title: First durable workspace change trigger
description: >-
  Operational change triggers for the First durable workspace documentation
  page.
superbee_updated_by: openai/codex
---
# Affected pages

[First durable workspace](../../get-started/first-durable-workspace.md)

# Source paths

- `README.md`
- `packages/cli/SKILL.md`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/doc/open.ts`
- `packages/cli/src/commands/sync/establish.ts`
- `packages/cli/src/commands/sync/orchestrate.ts`
- `packages/cli/src/bundle.ts`
- `packages/cli/src/skill-render.ts`
- `packages/cli/src/sync-outcomes.ts`
- `packages/cli/test/skill-distribution.test.ts`
- `packages/cli/test/sync-establish.test.ts`
- `packages/cli/test/sync-outcomes.test.ts`
- `packages/core/src/**`

# Product events

- `initialization-defaults`
- `initialization-refusal-rules`
- `okf-authoring-version`
- `document-display-behavior`
- `sharing-authority`
- `bundle-sharing-permissions`
- `repository-before-board`
- `shared-board-establishment`

# Review action

Run the first-workspace journey from a disposable directory. Recheck the repository-before-board
handoff when initialization, establishment, Skill, help, permission guidance, or recovery behavior
changes. Keep the tutorial local by default and route detailed sharing work to the sharing guide.

# Evidence

[current release evidence](../../sources/current-release.md)
