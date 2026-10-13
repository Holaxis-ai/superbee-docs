---
type: Documentation Trigger
title: Architecture at a glance change trigger
description: >-
  Operational change triggers for the Architecture at a glance documentation
  page.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T13:02:31.897Z'
---
# Affected pages

[Architecture at a glance](../../architecture/architecture-at-a-glance.md)

# Source paths

- `package.json`
- `packages/*/package.json`
- `packages/cli/build.mjs`
- `packages/cli/scripts/prepare-bundle-inputs.mjs`
- `packages/cli/scripts/embed-ui-assets.mjs`

- `packages/superbee/build.mjs`
- `packages/superbee/scripts/build-bundle.mjs`

# Product events

- `package-layout-or-build-pipeline`

# Review action

Re-run the architecture inventory and update the page and diagram if ownership or package boundaries changed.

# Evidence

[pinned implementation source](../../sources/superbee-codebase-main.md)
