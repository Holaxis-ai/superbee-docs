---
type: Guide
title: Model recurring domain concepts
description: >-
  Turn a proven recurring concept into a bundle-owned Kind and validated
  instances.
superbee_updated_by: openai/codex
---
# Outcome

Turn a proven recurring concept into a bundle-owned Kind, create one validated instance, relate it
to supporting knowledge, and check existing records for migration work. This guide is for active
users and agents who already have repeated examples of the concept.

The procedure is verified against [the current stable release](../sources/current-release.md).

# Before you start

- Run `superbee home` and confirm the intended bundle.
- Obtain the bundle owner's approval to add durable domain structure.
- Identify at least two existing records or repeated workflows that support the same useful shape.
- Decide which fields and sections apply to every instance.

Use one generic document first when the shape is still uncertain. A Kind begins governing every
document with its declared type as soon as the convention is installed.

# 1. Inspect the existing domain

This example models recurring experiments. Inspect documents, conventions, recipes, and links
before choosing names:

```sh
superbee list --type Experiment --limit 0
superbee kinds
superbee recipes
superbee link list --limit 100
```

Reuse established vocabulary. Record any existing `Experiment` documents because the new Kind will
check them too.

# 2. Define the smallest stable Kind

Create a temporary recipe directory outside the bundle with this manifest at
`experiment-recipe/recipe.md`:

```md
---
type: Recipe
id: experiment-model
title: Experiment model
version: "1"
summary: Defines the Experiment domain concept.
content_policy: definitions-only
---
# Experiment model

Installs the reviewed Experiment convention.
```

Add `experiment-recipe/conventions/experiment.md`:

```md
---
type: Convention
title: Experiment
governs: Experiment
description: A bounded test of a stated question and method.
path: experiments/
fields:
  required: [title, progress_status]
  optional: [owner]
  values:
    progress_status: [planned, running, complete]
  descriptions:
    progress_status: Current execution state.
    owner: Person responsible for the next action.
  terminal:
    progress_status: [complete]
links:
  uses: Dataset
link_descriptions:
  uses: Dataset used by the experiment.
sections: [Question, Method, Result]
freshness_horizon: 30d
---
# Experiment

Use this Kind for a bounded test with a stable question, method, and result structure.
```

The example declares only fields and headings supported by the repeated records. The `uses`
relationship expresses real domain meaning between an `Experiment` and a `Dataset`.

# 3. Apply and inspect the definition

From the directory containing `experiment-recipe`, run:

```sh
superbee recipe add ./experiment-recipe
superbee kinds
superbee new "Experiment" --help
```

Check that the live Kind reports the expected path, fields, values, sections, freshness horizon,
and link vocabulary. Recipe application creates an absent definition. If the bundle already owns a
different `conventions/experiment` document, Superbee reports source drift and preserves the
existing file. Review that definition and plan an explicit migration.

# 4. Create related knowledge and one instance

Create the dataset record if the bundle does not already contain it:

```sh
superbee doc write datasets/customer-sample \
  --type Dataset \
  --title "Customer sample"
```

Save this body as `/tmp/onboarding-copy-experiment.md`:

```md
# Question

Does shorter onboarding copy improve completion?

# Method

Compare the current and shorter variants with the same customer sample.

# Result

Pending.
```

Create the governed instance and its typed relationship:

```sh
superbee new "Experiment" onboarding-copy \
  --title "Shorter onboarding copy" \
  --progress_status running \
  --owner "Product research" \
  --body-file /tmp/onboarding-copy-experiment.md \
  --link "uses=datasets/customer-sample"
```

The Kind's path places the document at `experiments/onboarding-copy`. `new` is create-only and
rejects missing fields, unknown fields, disallowed values, or missing required headings before it
writes the instance.

# 5. Verify the model and migration surface

```sh
superbee doc read experiments/onboarding-copy
superbee link show experiments/onboarding-copy --text "uses"
superbee list --type Experiment --limit 0
superbee status --limit 0
```

Confirm that the instance contains the declared fields and sections, the typed link reaches a
`Dataset`, and status reports no defect caused by the new record. Review every Kind warning or
conformance-debt row for older `Experiment` documents. Update those records deliberately or revise
the proposed convention before treating the model as established.

# Evolve from observed use

Add a field after real instances show that it is useful:

```sh
superbee kind field "Experiment" add confidence \
  --values low,medium,high
```

An optional field preserves existing conformance. Adding a required field makes missing values
visible in `superbee status`, which is useful only when a migration is ready. Changes to sections,
relationship vocabulary, or freshness require a deliberate update to the bundle-owned convention
and another whole-bundle status check.

Package the model for another bundle after its definitions stabilize. Keep project experiments and
results out of the recipe so each bundle retains its own instance data.

# Recovery and limits

- If the recipe is malformed, correct the named manifest or convention field and retry. The
  definitions-only policy rejects undeclared files before any write.
- If recipe application reports source drift, inspect the installed convention. Superbee leaves its
  bytes untouched.
- If `new` reports an existing ID, read and update that instance or choose a distinct ID.
- If a typed link warns about source or target type, inspect both documents and correct the model or
  target.
- If the new Kind creates widespread conformance debt, pause the rollout and agree on a migration
  before tightening the convention.

# Evidence and change triggers

The released implementation and tests for this journey are:

- [Kind convention parser](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/core/src/kinds.ts)
- [Strict Kind instance creation](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/commands/new.ts)
- [External recipe application and drift tests](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/recipes.test.ts)
- [Bundle-wide conformance tests](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/status.test.ts)

Re-evaluate this page when convention vocabulary, recipe admission, strict instance creation,
typed-link validation, or conformance reporting changes.

[understand reusable domain structure](../concepts/reusable-domain-structure.md)

[preserve context between sessions](preserve-context-between-sessions.md)

[CLI overview](../reference/cli-overview.md)
