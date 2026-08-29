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

- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/doc/open.ts`
- `packages/cli/src/bundle.ts`
- `packages/core/src/**`

# Product events

- `initialization-defaults`
- `initialization-refusal-rules`
- `okf-authoring-version`
- `document-display-behavior`
- `sharing-authority`

# Review action

Run the first-workspace journey from a disposable directory and update steps or recovery guidance that no longer match.

# Evidence

[current release evidence](../../sources/current-release.md)
