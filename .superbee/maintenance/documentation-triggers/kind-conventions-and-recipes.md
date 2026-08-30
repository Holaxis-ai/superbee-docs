---
type: Documentation Trigger
title: Kind conventions and recipe formats change trigger
---
# Affected pages

[Kind conventions and recipe formats](../../reference/kind-conventions-and-recipes.md)

# Source paths

- `packages/core/src/kinds.ts`
- `packages/core/src/kinds-load.ts`
- `packages/core/src/document-mutation.ts`
- `packages/core/test/document-mutation.test.ts`
- `packages/core/test/kinds.test.ts`
- `packages/cli/src/recipe-parser.ts`
- `packages/cli/src/recipe-source-builtin.ts`
- `packages/cli/src/recipe-source-filesystem.ts`
- `packages/cli/src/recipe-resolver.ts`
- `packages/cli/src/recipes.ts`
- `packages/cli/src/commands/kind.ts`
- `packages/cli/src/commands/kinds.ts`
- `packages/cli/src/commands/new.ts`
- `packages/cli/src/commands/doc/update.ts`
- `packages/cli/src/commands/doc/write.ts`
- `packages/cli/src/commands/link.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/src/commands/recipe.ts`
- `packages/cli/src/commands/recipes.ts`
- `packages/cli/test/kind.test.ts`
- `packages/cli/test/kinds.test.ts`
- `packages/cli/test/new-cli-integration.test.ts`
- `packages/cli/test/link.test.ts`
- `packages/cli/test/recipes.test.ts`
- `packages/cli/test/status.test.ts`

# Product events

- `convention-vocabulary`
- `kind-registry-discovery`
- `kind-validation-mode`
- `recipe-manifest-format`
- `recipe-admission`
- `recipe-inventory`
- `recipe-application`
- `kind-instance-creation`

# Review action

Re-verify discovery, schema keys, validation posture, recipe admission, drift behavior, and instance
creation against the released package. Update the examples and compatibility boundary when any of
those contracts changes.

# Evidence

[current stable release evidence](../../sources/current-release.md)
