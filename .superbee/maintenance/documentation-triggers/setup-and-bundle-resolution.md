---
type: Documentation Trigger
title: Setup and bundle resolution troubleshooting change trigger
description: >-
  Operational change triggers for the Setup and bundle resolution
  troubleshooting documentation page.
superbee_updated_by: openai/codex
---
# Affected pages

[Setup and bundle resolution troubleshooting](../../troubleshooting/setup-and-bundle-resolution.md)

# Source paths

- `packages/cli/src/setup-plan.ts`
- `packages/cli/test/setup-plan.test.ts`
- `packages/cli/src/bundle.ts`
- `packages/cli/test/bundle-locate.test.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/test/status.test.ts`
- `packages/cli/src/user-state-migration.ts`

# Product events

- `stable-release-identity`
- `installation-model`
- `supported-hosts`
- `setup-plan`
- `private-state-migration`
- `bundle-selection-precedence`
- `project-binding-format`
- `catalog-boundary`
- `status-findings`

# Review action

Reproduce affected symptoms with the current package and update diagnostic order, commands, and recovery guidance.

# Evidence

[current release evidence](../../sources/current-release.md)
