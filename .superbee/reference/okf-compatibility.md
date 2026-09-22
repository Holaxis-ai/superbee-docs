---
type: Reference
title: OKF compatibility
description: >-
  Open Knowledge Format editions, document semantics, compatibility limits, and
  migration behavior in the current stable Superbee release.
superbee_updated_by: anthropic/claude
generated:
  by: anthropic/claude
  at: '2026-09-22T22:26:49.673Z'
---
# Scope

Use this page to check which Open Knowledge Format behavior Superbee reads, authors, validates, and
preserves. It describes the current stable release against
[OKF v0.2 at revision `4bc03b7`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/4bc03b7560caa862cdeebccbeb2bced68940c9f0/okf/SPEC.md).

OKF defines the portable Markdown and YAML format. Superbee adds authoring, querying, validation,
concurrency, Kinds, recipes, and presentation. A valid OKF bundle does not require Superbee, and a
Superbee extension remains an ordinary producer-defined frontmatter field unless this page says
otherwise.

# Edition support

| Bundle condition | Stable Superbee behavior |
| --- | --- |
| New bundle with no edition override | Authors `okf_version: '0.2'` in the root `index.md`. |
| Explicit `--okf-version 0.1` | Authors a legacy-compatible v0.1 bundle. Use this only for a consumer that requires v0.1. |
| Existing v0.1 bundle | Reads and mutates it without changing the declared edition. |
| No root `okf_version` | Treats document writes and governed mutations as v0.1 compatibility behavior. |
| Declared v0.2 bundle | Reads and mutates with v0.2 document policy. |
| Another declared version | Attempts read and transport. Initialization and governed mutation refuse to claim or author an unsupported edition. |

The root declaration must be a non-empty YAML string. Use `okf_version: '0.2'`; an unquoted YAML
number is not recognized as the edition by the stable parser.

Initialization supports only `0.1` and `0.2`. Reopening an existing bundle leaves its root
`index.md` unchanged. Changing that one file does not migrate the documents, Kinds, saved queries,
or View code within the bundle.

# Bundle structure and reserved files

An OKF bundle is a directory tree. Every non-reserved `.md` file is a concept document. Its concept
ID is the bundle-relative path with the final `.md` removed. For example,
`evidence/launch-probe.md` has ID `evidence/launch-probe`.

Superbee recognizes the two OKF reserved filenames at every directory level:

| Filename | OKF role | Superbee treatment |
| --- | --- | --- |
| `index.md` | Optional directory listing; the root copy may declare `okf_version`. | Excluded from concept queries and concept writes. The root copy supplies the bundle edition. |
| `log.md` | Optional chronological update log. | Excluded from concept queries and concept writes. |

Superbee separates reserved files from concept documents. The stable health report does not perform
a complete structural validation of every `index.md` or `log.md` body against the OKF specification.

OKF includes non-reserved Markdown beneath dot-prefixed files and directories. Superbee's
filesystem discovery deliberately skips every dot-prefixed path segment. Such concepts are absent
from `list`, `query`, graph projections, and `status`, even though another OKF consumer may include
them. Keep portable concepts on visible paths when Superbee must discover them.

Concept IDs entering the core must be canonical and bundle-relative. They use forward slashes and
reject absolute paths, `.` or `..` segments, duplicate slashes, trailing slashes, and a non-final
path segment ending in `.md`. CLI entry points can accept a file-like spelling and normalize it
before the canonical identity reaches storage.

# Concept documents

Every conformant concept document is UTF-8 Markdown with a YAML frontmatter block. OKF v0.2 always
requires a non-empty `type`; all other standard fields are optional.

Stable Superbee enforces a non-empty string `type` on writes. It tolerates unknown type values and
preserves producer-defined frontmatter keys. A missing or malformed optional OKF family does not
make an otherwise readable document disappear, although malformed YAML is reported and skipped by
whole-bundle queries such as `status`.

The Markdown body has no required OKF sections. A bundle-owned Kind may impose additional fields,
enumerated values, headings, or relationship expectations for documents of one type. Those Kind
rules are Superbee conventions layered on the portable document.

# Standard v0.2 metadata

In a declared OKF v0.2 bundle, Superbee validates the standard fields that a write newly supplies or
changes. The check runs before automatic metadata and before persistence, and it applies whether or
not a Kind governs the type. Values that an existing document already stores unchanged are
preserved, including imported values that would fail these checks. Raw imports and v0.1 bundles
keep their earlier permissive behavior.

| Field family | OKF v0.2 meaning | Stable Superbee behavior |
| --- | --- | --- |
| `sources` | Materials from which the concept derives. | Each newly authored entry needs a non-empty `resource`; `id` and `title` must be strings, `author` a non-empty string, and `usage_count` a non-negative integer. Unknown nested keys are preserved. Superbee does not compute a credibility score. |
| `generated` | Actor and meaningful-change time for the current content. | Seeded on ordinary v0.2 creates without a usable clock, including ungoverned types. A meaningful content change records the resolved actor in `generated.by` and advances `generated.at`. A verification-only change updates neither. |
| `verified` | One or more independent verification events. | `superbee doc verify` appends one `{by, at}` event. Each newly authored event needs an OKF actor and an explicit-offset timestamp. A bare mapping is read as a one-element list. |
| `status` | `draft`, `stable`, or `deprecated`; absence means `stable` in OKF. | A newly supplied value must be one of those three. Superbee does not insert `stable` when the field is absent. Workflow state belongs in `superbee_progress_status`. |
| `stale_after` | Absolute instant on or after which the concept is stale. | Set it with `--stale-after` on `doc write`, `doc update`, or `new`, or with `doc field set`. A new value needs a date, time, and explicit UTC offset. `superbee status` evaluates it as an exact instant and reports stored date-only or malformed values as `invalid_stale_after`. |
| `tags` | Free-form labels. | Must be a list of strings. Change membership with `doc field add` or `doc field remove`; `doc update` no longer accepts `--tag`. |

Newly authored OKF timestamps require an ISO 8601 date and time with `Z` or a numeric UTC offset,
such as `2026-09-08T18:30:00Z` or `2026-09-08T12:30:00-06:00`. The rule covers `generated.at`,
`verified[].at`, `stale_after`, `sources[].last_modified`, and `usage_window` boundaries. A
date-only or zone-less value is refused with a correction. `superbee status` reports stored values
that fail the rule under `invalid_timestamps` and does not rewrite them; choose the intended instant
and repair each named field deliberately.

On an ordinary v0.2 document create with no usable `timestamp` or `generated.at`, Superbee seeds
`generated.by` with the resolved actor, or `process:superbee` when no actor is known, and the
current `generated.at`. A supplied mapping must carry a valid `by` and receives `at` if missing.
This applies to `doc write`, `new`, and document promotion, including types with no Kind. A Kind
requiring `timestamp` receives that required clock instead. Recipe definition installation and Kind
draft/dismiss operations opt out of automatic seeding so their definition bytes remain comparable.
Existing documents are not backfilled merely by reading them, and v0.1 clock behavior is unchanged.

# Actor identities

OKF actor strings identify who produced or verified content. A v0.2 bundle accepts three forms:

| Form | Use | Example |
| --- | --- | --- |
| `human:<id>` | A person | `human:alex` |
| `process:<id>` | An automated job or a role-specific agent session | `process:nightly-import` |
| `<producer>/<version>` | An agent or tool | `openai/codex`, `anthropic/claude` |

The resolved actor comes from `--actor`, then `SUPERBEE_ACTOR`, then the legacy
`AGENTSTATE_LITE_ACTOR`. On a v0.2 bundle, every writing command refuses a resolved actor that does
not match one of these forms, before any bytes are written. The refusal is a `USAGE` error whose
message names a corrected spelling and whose help gives a rerunnable `--actor` value or
`SUPERBEE_ACTOR` export. A role-qualified path such as `openai/codex/root` is refused; the
suggestion keeps `openai/codex` and offers `process:codex-root` for per-session attribution.
`home` and `session-start` show the resolved actor on a v0.2 bundle and flag one that writes would
refuse. A write with no actor remains allowed and is attributed to `process:superbee`.

Superbee also records the resolved actor as its own advisory `superbee_updated_by` field. That
attribution is separate from OKF provenance and is not authentication.

# Verification and trust tiers

Record that an actor confirmed a document's current content:

```sh
superbee doc verify <id> --actor human:<id>
superbee list --fields trust
```

`doc verify` appends one event to `verified` and leaves the body and `generated` provenance
untouched. An identical event is a no-op. `--at` supplies an explicit-offset confirmation instant,
and `--expected-version` makes the append compare-and-swap. The command requires a v0.2 bundle and
an actor; an unattributed verification is refused.

Superbee derives the OKF trust tier from `verified`:

| Tier | Condition |
| --- | --- |
| `unverified` | No verification events |
| `machine-confirmed` | Only `process:` or `<producer>/<version>` verifiers |
| `human-reviewed` | At least one `human:` verifier |

The tier appears in the `doc verify` receipt, per-tier counts in `status` and `home`, the derived
`trust` column of `list --fields trust`, and the local document reader header.

# Links and relationships

OKF relationships are standard Markdown links in the body. Superbee resolves both supported forms:

```markdown
[Root-relative release evidence](/sources/current-release.md)
[Relative release evidence](../sources/current-release.md)
```

The stored link is directed from the current document to the target concept. Superbee derives
backlinks from those bodies and does not store a second edge database. Links to missing concepts
remain valid unresolved relationships, consistent with OKF's allowance for not-yet-written
knowledge.

External URLs, `mailto:` links, in-page anchors, non-Markdown targets, image links, and links to
reserved `index.md` or `log.md` files do not become concept edges. Link text carries the
relationship meaning; Kinds may add a typed relationship vocabulary without changing the stored
Markdown form.

The derived edge and backlink graph recognizes inline `[text](href)` body links whose href contains
no whitespace. Reference-style Markdown links and path-valued frontmatter such as
`sources[].resource`, `computation`, `executor.resource`, and `attester.resource` remain preserved
data but do not become graph edges. The graph is therefore a bounded Superbee projection rather
than a complete projection of every OKF relationship-bearing value.

# Validation boundaries

`superbee status` is a read-only bundle health report. It reports malformed YAML, Kind conformance,
unresolved links, freshness, graph expectations, View registration problems, and relevant legacy
findings. Findings do not make the command fail after the analysis completes.

`status` also reports OKF v0.2 findings that authoring now prevents: `invalid_stale_after` and
`invalid_timestamps` for stored values without a usable instant, trust-tier counts, and an
`OKF_WORKFLOW_STATUS_COLLISION` registry warning when a Kind declares workflow values in the
lifecycle `status` field. See [Kind conventions and recipes](kind-conventions-and-recipes.md) for
that migration.

The stable release reads permissively and validates on write. Reads, raw imports, and transport keep
unknown fields and unusual legacy values instead of discarding them. Authored writes to a v0.2
bundle check the standard field shapes described above, but Superbee does not claim a complete
validator for every value another producer may store. Use the official OKF specification when
producing those families, and preserve unknown fields when integrating another producer's bundle.

Attested Computation fields are parsed, preserved, queried, and transported as producer frontmatter.
When a v0.2 write newly supplies them, Superbee checks their basic shapes, such as a non-empty
`runtime` and `parameters` entries with a `name` and `type`. It does not execute computations, run
attesters, validate receipts, or derive attestation verdicts.

Superbee's authoring paths add stricter rules where they own a mutation:

- generic writes require a non-empty `type`;
- v0.2 writes require an OKF actor spelling when an actor is supplied, and valid standard fields;
- a Kind-aware `new` operation validates the declared Kind strictly;
- generic writes can warn or use `--strict` when a Kind governs the type;
- `doc update` accepts one value per field flag and refuses to replace a list implicitly; use
  `doc field` for `tags` and `sources`, or a complete pull, edit, and promote loop for other lists;
- compare-and-swap versions protect a write from replacing a newer document; and
- unsupported authoring editions are rejected before a new bundle is created.

# Normalization and byte behavior

Superbee reads local document bytes as UTF-8, parses YAML frontmatter, and keeps YAML date and
date-time scalars as strings so a date-only value such as `2026-07-27` does not become a midnight
timestamp. The legacy top-level `timestamp` field is normalized to an ISO 8601 string when the YAML
parser identifies it as a timestamp.

A document mutation serializes the parsed frontmatter and Markdown body into Superbee's canonical
form. Unknown values remain semantically present, but YAML comments, quoting choices, spacing, key
order, and other source formatting are not a byte-preservation promise. Read-only query and
transport probes do not rewrite the source bundle.

The core document store does not declare an OKF document-size maximum in the stable release.
Bounded presentation channels have separate limits:

| Surface | Stable limit or behavior | Complete-content path |
| --- | --- | --- |
| Default `superbee doc read <id>` receipt | Body preview is limited to 1,000 characters and reports truncation. | `superbee doc read <id> --out <file>` |
| Shared Markdown renderer | Parses at most 262,144 body characters, renders at most 20,000 nodes, and limits nesting depth to 40. | Use the raw document channel when the complete body is required. |
| Local `doc read --out` | Copies the source document's bytes. | Already complete. |
| Remote `doc read --out` | Reconstructs canonical Markdown from parsed frontmatter and body because the stable wire protocol has no raw-document endpoint. | Semantically complete, without a byte-identical promise for hand-formatted YAML. |

These presentation limits do not shorten the stored document. A rendered view that reports
`bounded: true` is incomplete and should not be used as a full-fidelity export.

A truncated document receipt uses `body_preview` and `body_truncated` to identify its incomplete
body. Replacement writes reject recognized truncated previews. Read the complete body with
`superbee doc read <id> --body-out <file>` before editing and passing it to `doc update --body-file`.
The `--accept-truncated-body` override deliberately accepts the shortened replacement; it is not
the normal recovery from a preview refusal.

# v0.1 compatibility and migration

OKF v0.2 supersedes the v0.1 `timestamp` clock with `generated.at` and the body `# Citations` list
with `sources`. Both v0.2 families are optional, so imported v0.1 content remains readable.
Superbee's v0.1 write policy supplies a top-level `timestamp` when it is missing. The v0.2 policy
does not invent `sources` or `verified`. It seeds `generated` for ordinary new documents as
described above; a Kind that requires the legacy `timestamp` still receives that clock.

The largest field collision is workflow progress. OKF v0.2 owns top-level `status` for the
`draft | stable | deprecated` lifecycle. Superbee exposes the logical field name
`progress_status` for a Kind that declares the edition-specific storage coordinate:

| Edition | Physical workflow field | Agent-facing logical field |
| --- | --- | --- |
| v0.1 or no declaration | `status` | `progress_status` |
| v0.2 | `superbee_progress_status` | `progress_status` |

The alias is declaration-driven. It applies only when the document's governing Kind declares the
physical workflow field, and it never reclassifies a v0.2 lifecycle `status` value as workflow
progress.

Before changing a v0.1 bundle's root edition:

1. Commit or back up the bundle.
2. Run `superbee status` and inspect `okf_upgrade`.
3. Move Kind-governed workflow fields from physical `status` to
   `superbee_progress_status`, while continuing to use the logical `progress_status` interface.
4. Audit ungoverned documents, saved queries, and View code separately; the current finding cannot
   infer their intended use of `status`.
5. Decide whether legacy `timestamp` and `# Citations` content should be expressed through
   `generated` and `sources`.
6. Change the root `okf_version` only after all dependent surfaces agree.
7. Run `superbee status` again and exercise the workflows and Views that depend on the migrated
   fields.

Stable Superbee does not perform this multi-document edition migration automatically. Continue to
use a v0.1 bundle when the audit is incomplete.

# Related

[Migrate or upgrade safely](../guides/migrate-or-upgrade-safely.md)

[Bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

[CLI overview](cli-overview.md)

[Current release evidence](../sources/current-release.md)

# Evidence

- [Stable creation-clock policy and definition opt-out](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/document-mutation.ts)
- [Creation-clock regression tests](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/test/document-mutation.test.ts)
- [Kind draft and dismiss definition writes](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/cli/src/commands/kind-draft.ts)
- [Stable preview replacement guards](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/cli/src/body-replace-guards.ts)
- [OKF actor grammar and suggestions](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/okf-actor.ts)
- [Authored standard-field validation](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/okf-standard-fields.ts)
- [Authored timestamp validation](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/okf-timestamps.ts)
- [Verification events and trust tiers](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/verification.ts)
- [`doc verify` implementation](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/cli/src/commands/doc/verify.ts)
- [Frontmatter field actions](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/document-field-actions.ts)
- [Actor refusal guidance tests](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/cli/test/actor-guidance.test.ts)
- [Timestamp authoring tests](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/cli/test/okf-timestamp-authoring.test.ts)
- [Official OKF v0.2 specification at `4bc03b7`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/4bc03b7560caa862cdeebccbeb2bced68940c9f0/okf/SPEC.md)
- [Stable bundle engine](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/bundle.ts)
- [Stable frontmatter parser](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/frontmatter.ts)
- [Stable v0.2 mutation policy](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/document-write-policy.ts)
- [Stable concept identity and reserved-file rules](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/paths.ts)
- [Stable link resolver](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/links.ts)
- [v0.2 read compatibility tests](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/test/okf-v0-2-read-compat.test.ts)
- [v0.2 write contract tests](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/test/okf-v0-2-write-contract.test.ts)
- [Workflow progress compatibility tests](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/test/progress-status.test.ts)
- [Stable status implementation](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/cli/src/commands/status.ts)
- [Stable document-read implementation](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/cli/src/commands/doc/read.ts)
