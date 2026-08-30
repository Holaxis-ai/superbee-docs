---
type: Documentation Trigger
title: Privacy and bundle boundaries change trigger
description: >-
  Operational change triggers for the Choose privacy and bundle boundaries
  documentation page.
superbee_updated_by: openai/codex
---
# Affected pages

[Choose privacy and bundle boundaries](../../guides/choose-privacy-and-bundle-boundaries.md)

# Source paths

- `packages/cli/src/bundle.ts`
- `packages/cli/test/bundle-locate.test.ts`
- `packages/cli/src/catalog.ts`
- `packages/cli/src/commands/catalog.ts`
- `packages/cli/test/catalog-command.test.ts`
- `packages/cli/src/mcp-workspace-resolver.ts`
- `packages/cli/test/mcp-workspace-resolver.test.ts`
- `packages/mcp-app/src/server.ts`
- `packages/publication/src/capture.ts`
- `packages/publication/test/publication.test.mjs`

# Product events

- `stable-release-identity`
- `bundle-selection-precedence`
- `project-binding-format`
- `catalog-boundary`
- `mcp-workspace-selection`
- `publication-inventory`
- `public-bundle-exposure`
- `portal-complete-bundle-artifact`
- `documentation-projection`
- `sharing-model`

# Review action

Run the two-bundle selection journey against the current stable package, then review the complete
publication inventory and sharing boundaries. Update the decision criteria, selection procedure,
and recovery guidance when verified behavior changes.

# Evidence

[current release evidence](../../sources/current-release.md)

[pinned implementation source](../../sources/superbee-codebase-main.md)

[pinned Portal source](../../sources/superbee-portal.md)

[public publication boundary](../../architecture/public-publication-boundary.md)
