---
type: Documentation Trigger
title: Superbee system context change trigger
description: >-
  Operational change triggers for the Superbee system context documentation
  page.
superbee_updated_by: openai/codex
---
# Affected pages

[Superbee system context](../../architecture/superbee-system-context.md)

# Source paths

- `packages/core/src/**`
- `packages/cli/src/**`
- `packages/cli/SKILL.md`
- `packages/cli/src/publication/**`

# Product events

- `core-storage-contract`
- `cli-installation-model`
- `publication-snapshot-contract`
- `portal-responsibilities`
- `sharing-model`

# Review action

Review the system boundary and update the page and diagram when component ownership or information flow changed.

# Evidence

[product evidence](../../sources/superbee-core.md)

[publication evidence](../../sources/superbee-portal.md)
