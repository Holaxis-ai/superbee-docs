---
type: Reference
title: Kind conventions and recipe formats
superbee_updated_by: openai/codex
---
# Scope

This reference describes the Kind convention and recipe formats supported by the current stable release.
It is for bundle authors, recipe authors, and integrators who need exact discovery, validation, and
installation behavior. The [current release evidence](../sources/current-release.md) identifies the
package, source tag, and verification boundary.

# Kind discovery

Superbee builds a bundle's live Kind registry from ordinary OKF Markdown documents that meet both
conditions:

- the document ID is under `conventions/`; and
- its frontmatter declares `type: Convention`.

The `governs` value is required and names the instance `type`. A Convention outside
`conventions/` is not discovered. Malformed declarations are skipped and reported as registry
warnings. When multiple documents govern the same type, the first document by ID wins and the
others produce `KIND_DUPLICATE_GOVERNS` warnings.

Inspect the active registry rather than inferring it from recipe history:

```sh
superbee kinds
superbee new "<Kind>" --help
```

`kinds` projects the schema into Superbee's authoring vocabulary and includes registry warnings.
`new "<Kind>" --help` reports the exact required and optional fields, allowed values, ID prefix,
headings, and link guidance for one declared Kind.

# Convention document format

This example uses every supported declaration group:

```yaml
---
type: Convention
title: Experiment
governs: Experiment
description: A bounded test of a stated question and method.
path: experiments/
fields:
  required: [title, progress_status]
  optional: [owner, confidence]
  descriptions:
    owner: Person responsible for the next action.
  values:
    progress_status: [planned, running, complete]
    confidence: [low, medium, high]
  value_descriptions:
    confidence:
      low: Evidence is preliminary.
      high: Evidence has survived the planned checks.
  terminal:
    progress_status: [complete]
links:
  uses: Dataset
link_descriptions:
  uses: Dataset used by this experiment.
expects_inbound:
  contains: Program
sections: [Question, Method, Result]
freshness_horizon: 30d
browse_collapsed: true
---
```

The Markdown body is guidance for people and agents. The frontmatter fields below drive product
behavior.

| Key | Shape | Meaning and constraints |
| --- | --- | --- |
| `type` | string | Must be exactly `Convention` for registry discovery. |
| `governs` | non-empty string | Required. Matches the `type` on governed instances. |
| `title` | string | Display title. Defaults to `governs`. |
| `description` | non-empty string | Guidance for the Kind's purpose and intended use. |
| `path` | string | Bundle-relative prefix that `new` prepends to an unprefixed instance ID. |
| `fields.required` | list | Fields that must be present and non-empty. |
| `fields.optional` | list | Fields accepted when present. |
| `fields.descriptions` | map | Declared field to human guidance. It does not change validation. |
| `fields.values` | map of lists | Declared field to allowed scalar values. An enum-constrained instance value has scalar arity. |
| `fields.value_descriptions` | nested map | Enum field and allowed value to human guidance. It does not add states or transitions. |
| `fields.terminal` | map of lists | Field to terminal values. The field should also have a `fields.values` enum, and terminal values should be members of it. |
| `links` | map | Outbound link text to allowed target Kind. Exact link text activates typed-edge validation. |
| `link_descriptions` | map | Declared outbound link text to human guidance. |
| `expects_inbound` | map | Expected inbound link text to expected source Kind. `status` reports missing expectations but writes remain allowed. |
| `sections` | list | Required level-one Markdown heading names, such as `# Result`. |
| `freshness_horizon` | string | A positive integer followed by `m`, `h`, or `d`, such as `15m`, `24h`, or `30d`. |
| `browse_collapsed` | boolean | The value `true` asks browse surfaces to collapse instances initially. It is a display hint. |

Keys under `fields` are limited to `required`, `optional`, `values`, `value_descriptions`,
`terminal`, and `descriptions`. Unknown keys in that block produce warnings and are ignored.
Unknown top-level frontmatter remains available to other OKF producers. The near-miss top-level
keys `enum`, `enums`, `values`, and `constraints` produce warnings because enum constraints belong
under `fields.values`.

Core filters `type`, `dir`, `remote`, `json`, `help`, `body`, and `body-file` from declared fields.
The `new` command also consumes `actor`, `link`, and `no-prefix` as controls, so recipe authors
should avoid all of those names for fields intended for `superbee new`.

# Validation modes

The same Kind validator checks required fields, enum membership and scalar arity, and declared
level-one sections. The command determines whether findings warn or block.

| Surface | Behavior in `0.1.3` |
| --- | --- |
| Registry load | Skips malformed Convention documents and reports warnings. A malformed declaration does not invalidate the rest of the registry. |
| `superbee new "<Kind>"` | Strict and create-only. Missing fields, unknown fields, invalid enum values, missing headings, or an existing ID reject the write. |
| `superbee doc write` | Kind findings are warnings by default. `--strict` rejects before writing. An overwrite that would make an already-conforming governed document nonconforming is rejected. |
| `superbee doc update` | A patch to a Kind-declared field is strict. A standard-field-only patch warns by default, and `--strict` makes those findings blocking. |
| `superbee status` | Read-only whole-bundle lint. It reports registry warnings, instance findings, conformance debt, freshness, and declared relationship findings. |
| `superbee recipe add` | Parses the recipe before opening the mutation loop. A `definitions-only` recipe rejects malformed or undeclared content before any write. |

Typed links use a teaching posture: `link add` warns when an exact declared link type has the wrong
source or target Kind, while `status` applies the same rule across the bundle. `expects_inbound`
also feeds the read-only `missing_expected_links` report.

# Recipe folder format

A recipe packages definitions for installation into another bundle. The minimum folder contains a
manifest and at least one valid Convention:

```text
experiment-model/
  recipe.md
  conventions/
    experiment.md
```

A strict portable recipe may also carry declared Reference documents and self-contained View
definitions:

```text
experiment-model/
  recipe.md
  conventions/
    experiment.md
  references/
    operating-model.md
  views-registry/
    experiment-dashboard.md
  views/
    experiment-dashboard.html
```

The manifest for that shape is:

```yaml
---
type: Recipe
id: experiment-model
title: Experiment model
version: "1"
summary: Defines the Experiment domain concept.
offer: organize repeated experiments consistently
content_policy: definitions-only
references:
  - references/operating-model.md
pages:
  - registry: views-registry/experiment-dashboard.md
    entry: views/experiment-dashboard.html
---
```

| Manifest key | Requirement |
| --- | --- |
| `type` | Required and exactly `Recipe`. |
| `id`, `title`, `version`, `summary` | Required non-empty strings. The version is reported with the recipe identity. |
| `offer` | Optional one-line outcome used by setup or orientation surfaces. Defaults to `title`. |
| `content_policy` | Optional. `definitions-only` is the only accepted value in `0.1.3`. |
| `references` | Optional list of `.md` paths below `references/`. Requires `definitions-only`; each document must declare `type: Reference` and a title. |
| `pages` | Optional list of `{registry, entry}` maps. Requires `definitions-only`; each registry is a `type: View` document and each entry is self-contained HTML at the matching declared path. |

`composes`, `seeds`, and `requires` are reserved manifest keys in this release. They produce a
warning and have no application behavior.

With `content_policy: definitions-only`, every file must be a declared Convention, Reference, View
registry, or View entry. Unsafe paths, missing declared files, duplicate governed types, malformed
conventions, and undeclared files reject the recipe. Without that policy, legacy folders may carry
ignored files outside `conventions/`; portable recipes should use the strict policy.

# Built-in and external recipes

`superbee recipes` lists the built-ins shipped with the CLI: `context-notes`, `work-tracking`, and
`roadmap`. It can show that inventory before a bundle exists and reports whether each recipe's
definitions are present when a bundle is available.

External recipes are addressed by path and are not included in the built-in inventory:

```sh
superbee recipe add ./experiment-model
superbee recipe add ~/shared-recipes/experiment-model
```

A bare name selects the built-in namespace. Prefix a local folder with `./` when its name contains
no path separator. Filesystem loading resolves the recipe root, confines symlinks to that root,
and rejects dot-prefixed paths under a strict portable recipe.

# Application and safe evolution

Recipe application uses create-only writes for each definition. Reapplying identical definitions
is an idempotent `changed: false` result. When an existing Convention differs from recipe source,
Superbee reports `source_differs`, preserves the bundle-owned document, and points to an explicit
version-checked promotion path. A recipe never overwrites a local definition merely because its
manifest version changed.

Use this sequence when the domain model changes:

1. Run `superbee kinds` and `superbee status --limit 0` to inspect the live schema and affected
   instances.
2. Add or remove one field with `superbee kind field "<Kind>" add <name>` or
   `superbee kind field "<Kind>" remove <name>`. New fields are optional unless `--required` is
   supplied, and `--values <a,b,c>` sets an enum on an added field.
3. For other convention changes, pull the current document, edit the frontmatter, and promote it
   with the version returned by the pull:

   ```sh
   superbee pull --doc-key conventions/experiment.md --out experiment.md
   superbee promote experiment.md \
     --doc-key conventions/experiment.md \
     --expected-version <version-from-pull>
   ```

4. Run `superbee kinds` and `superbee status --limit 0` again. Update affected instances
   deliberately before tightening another constraint.
5. Update the reusable recipe only after the bundle-owned model and its instances prove the new
   shape. Reapplying the recipe reports drift for existing installations; it does not migrate
   them automatically in `0.1.3`.

Adding an optional field preserves conformance for existing instances. Adding a required field,
narrowing an enum, or adding a required section can create conformance work immediately. The
version-checked promotion prevents an unseen concurrent edit from being overwritten.

# Instance creation

Create an instance from the live Kind, then inspect the saved document and bundle health:

```sh
superbee new "Experiment" onboarding-copy \
  --title "Shorter onboarding copy" \
  --progress_status running \
  --owner "Product research" \
  --body-file /tmp/onboarding-copy-experiment.md \
  --link "uses=datasets/customer-sample"

superbee doc read experiments/onboarding-copy
superbee status --limit 0
```

The declared `path` produces `experiments/onboarding-copy`. Pass `--no-prefix` when the requested
ID is already intentional. Repeating a non-enum field flag creates an array; enum fields accept one
value. A malformed `--link` value is rejected before the document write. A later link failure is
reported separately because the create may already have succeeded.

# Recovery

- Read `registry_warnings` from `superbee kinds` or `superbee status` when a Convention is absent
  from the live registry.
- Use `superbee new "<Kind>" --help` when an instance fails validation; it reports the live schema
  rather than a recipe's historical definition.
- Treat `source_differs` as a migration decision. Compare the installed Convention with recipe
  source before promoting any replacement.
- Run `superbee status --limit 0` after schema changes and resolve the named instance IDs rather
  than assuming a successful definition write completed the migration.

# Evidence

The exact `0.1.3` sources and tests governing this reference are:

- [Kind parser and validator](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/core/src/kinds.ts)
- [Kind registry discovery](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/core/src/kinds-load.ts)
- [Kind-aware instance creation](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/commands/new.ts)
- [Recipe parser](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/recipe-parser.ts)
- [Recipe source resolution](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/recipe-resolver.ts)
- [Filesystem recipe admission](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/recipe-source-filesystem.ts)
- [Recipe application](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/recipes.ts)
- [Shared document mutation validation](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/core/src/document-mutation.ts)
- [Kind behavior tests](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/core/test/kinds.test.ts)
- [Recipe behavior tests](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/recipes.test.ts)

[understand reusable domain structure](../concepts/reusable-domain-structure.md)

[model recurring domain concepts](../guides/model-recurring-domain-concepts.md)

[CLI overview](cli-overview.md)

[current release](../releases/current.md)
