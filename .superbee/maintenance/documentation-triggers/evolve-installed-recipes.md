---
type: Documentation Trigger
title: Installed recipe evolution change trigger
description: Operational change triggers for additive recipe evolution and recovery.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Evolve installed recipes](../../guides/evolve-installed-recipes.md)

# Source paths

- `packages/cli/src/commands/recipe-evolve.ts`
- `packages/cli/src/commands/recipe.ts`
- `packages/cli/src/recipe-parser.ts`
- `packages/cli/src/recipe-evolution/**`
- `packages/cli/references/recipes/**`
- `packages/cli/test/recipe-evolve*.test.ts`

# Product events

- `recipe-evolution-plan`
- `recipe-evolution-additive-rule`
- `recipe-evolution-apply-token`
- `recipe-evolution-partial-completion`

# Review action

Exercise ready, blocked, stale-token, concurrent-target, concurrent-non-target, and partial apply
journeys against a disposable installed recipe. Update the page when supported operations, blockers,
token identity, postconditions, or recovery receipts change.

# Evidence

[current release evidence](../../sources/current-release.md)
