---
type: Documentation Trigger
title: Public publication boundary change trigger
description: >-
  Operational change triggers for the public publication boundary architecture
  page.
superbee_updated_by: openai/codex
---
# Affected pages

[Public publication boundary](../../architecture/public-publication-boundary.md)

# Source paths

- `packages/publication/src/capture.ts`
- `packages/publication/src/snapshot-backend.ts`
- `packages/publication/src/bridge.ts`
- `packages/publication/src/types.ts`
- `packages/core/src/backend.ts`

# Product events

- `publication-snapshot-contract`
- `portal-publication-contract`
- `documentation-projection-contract`
- `hosting-runtime-contract`

# Review action

Re-run the public publication boundary review against both pinned repositories, then update the page and diagram or record that the contract is unchanged.

# Evidence

[pinned Superbee implementation source](../../sources/superbee-codebase-main.md)

[pinned Portal implementation source](../../sources/superbee-portal.md)
