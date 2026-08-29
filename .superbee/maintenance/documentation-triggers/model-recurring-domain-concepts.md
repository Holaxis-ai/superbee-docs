---
type: Documentation Trigger
title: Model recurring domain concepts change trigger
description: >-
  Operational change triggers for the Model recurring domain concepts
  documentation page.
superbee_updated_by: openai/codex
---
# Affected pages

[Model recurring domain concepts](../../guides/model-recurring-domain-concepts.md)

# Source paths

- `packages/core/src/kinds.ts`
- `packages/cli/src/commands/new.ts`
- `packages/cli/src/recipe-parser.ts`
- `packages/cli/test/recipes.test.ts`
- `packages/cli/test/status.test.ts`

# Product events

- `convention-vocabulary`
- `recipe-admission`
- `strict-kind-creation`
- `typed-link-validation`
- `conformance-reporting`

# Review action

Re-run the modeling journey and update examples, constraints, and verification results that changed.

# Evidence

[pinned implementation source](../../sources/superbee-codebase-main.md)
