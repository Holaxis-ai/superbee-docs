---
type: Documentation Trigger
title: 'Bundles, documents, and relationships change trigger'
description: >-
  Operational change triggers for the Bundles, documents, and relationships
  documentation page.
superbee_updated_by: openai/codex
---
# Affected pages

[Bundles, documents, and relationships](../../concepts/bundles-documents-and-relationships.md)

# Source paths

- `packages/core/src/**`
- `packages/cli/src/bundle.ts`
- `packages/cli/src/commands/kinds.ts`
- `packages/cli/src/recipe-parser.ts`
- `packages/cli/src/commands/link.ts`

# Product events

- `okf-authoring-rules`
- `reserved-file-rules`
- `bundle-resolution-precedence`
- `kind-semantics`
- `recipe-semantics`
- `relationship-semantics`
- `presentation-authority`

# Review action

Review the concept model against current OKF and product behavior, then update the explanation when its distinctions changed.

# Evidence

[product evidence](../../sources/superbee-core.md)
