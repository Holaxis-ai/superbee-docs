---
type: Documentation Trigger
title: CLI overview change trigger
description: Operational change triggers for the CLI overview documentation page.
superbee_updated_by: openai/codex
---
# Affected pages

[CLI overview](../../reference/cli-overview.md)

# Source paths

- `packages/cli/src/cli.ts`
- `packages/cli/src/commands/**`
- `packages/cli/src/bundle.ts`
- `packages/cli/src/setup-plan.ts`
- `packages/cli/src/commands/sync/**`

# Product events

- `cli-command-ownership`
- `cli-output-conventions`
- `bundle-selection-precedence`
- `installation-ownership`
- `sharing-ownership`

# Review action

Regenerate and inspect CLI help, then update ownership descriptions and command references that changed.

# Evidence

[current release evidence](../../sources/current-release.md)
