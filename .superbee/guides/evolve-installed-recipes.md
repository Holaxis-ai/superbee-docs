---
type: Guide
title: Evolve installed recipes
description: >-
  Plan and apply an additive installed-recipe upgrade with state-bound safety
  and explicit recovery.
superbee_updated_by: openai/codex/root
---
# Goal

Upgrade definitions from an already installed recipe without replacing bundle-owned values or
writing from a stale plan. This how-to is for bundle maintainers using the current stable release.

The stable behavior and package identity are recorded in
[the current release evidence](../sources/current-release.md).

# What recipe evolution can change

`recipe evolve` is an additive convention-upgrade path. It may add supported declarations to
installed recipe definitions after validating existing instances. It does not perform a general
merge or replace bundle-owned content.

The preflight blocks changes such as:

- replacing or removing existing declared values;
- making a previously optional field or body section required when current instances do not comply;
- changing terminal workflow semantics incompatibly;
- replacing active View assets or undeclared artifacts;
- removing definitions that are absent from the new recipe source;
- relationship or schema changes outside the supported additive rules.

# Prerequisites

- Back up or commit the bundle according to its normal sharing model.
- Identify the built-in recipe name or local recipe folder.
- Run `superbee recipes` and confirm the recipe is already installed.
- Inspect local edits to the installed convention; evolution preserves and reports bundle-owned
  drift rather than silently overwriting it.

# 1. Produce a read-only plan

```sh
superbee recipe evolve context-notes
```

For a local folder, pass a path such as `./recipes/my-domain`. A bare name selects a built-in
recipe. Planning performs no writes. Review:

- the definitions that would change;
- additive operations for each target;
- existing-instance validation;
- blockers and drift;
- the exact apply command and plan token.

Continue only when the plan reports ready and every proposed definition change is expected.

# 2. Apply the exact plan

Run the apply command returned by the plan. Its shape is:

```sh
superbee recipe evolve context-notes \
  --apply PLAN_TOKEN \
  --actor openai/codex/root
```

Apply recomputes the complete preflight, binds the token to the current recipe source and target
heads, and writes each changed convention with exact-version compare-and-swap. A token from another
bundle, another recipe source, or an earlier state is refused.

# 3. Verify the live conventions and instances

```sh
superbee kinds
superbee status
superbee recipes
```

Inspect each evolved Kind, then read representative existing instances and create one disposable
new instance when the change adds an authoring capability. The recipe is fully applied only when
definitions match and the bundle remains valid.

# Concurrency and partial completion

Evolution preflights the whole operation before writing. Each target still has its own versioned
write, so a concurrent change can interrupt a multi-target apply. The receipt separates completed
targets from pending targets and reports any concurrent non-target change discovered by the final
postcondition check.

Do not replay the old token after a partial result. Inspect the completed writes and concurrent
changes, rerun the read-only plan, and apply only a newly reviewed token. Additive operations are
idempotent, so a fresh plan should omit definitions already brought to the intended state.

# Recovery

| Result | Response |
| --- | --- |
| Plan reports a blocker | Change the recipe design or migrate instances explicitly; evolution will not force it. |
| Plan reports bundle-owned drift | Decide whether the local definition or recipe source should govern, then reconcile intentionally. |
| Apply reports stale state | Discard the token, inspect current definitions, and plan again. |
| Apply reports completed and pending targets | Verify completed targets, address the conflict, and generate a new plan for the remainder. |
| Postcondition reports a concurrent non-target change | Inspect that change before declaring the upgrade verified. |
| A broader replacement is required | Use an explicit migration with its own backup, review, and recovery procedure. |

# Evidence and related guidance

The planner and apply state machine are implemented in the tagged
[`recipe evolve` command](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/recipe-evolve.ts)
and exercised by its integration tests. See
[Kind conventions and recipes](../reference/kind-conventions-and-recipes.md) for the static recipe
model and [Migrate or upgrade safely](migrate-or-upgrade-safely.md) for package-level recovery.
