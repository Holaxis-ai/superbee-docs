---
type: Reference
title: OKF compatibility
description: >-
  Open Knowledge Format editions, document semantics, compatibility limits, and
  migration behavior in the current stable Superbee release.
superbee_updated_by: openai/codex
---
# Scope

Use this page to check which Open Knowledge Format behavior Superbee reads, authors, validates, and
preserves. It describes `superbee@0.1.3`, the current stable release, against
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

| Field family | OKF v0.2 meaning | Stable Superbee behavior |
| --- | --- | --- |
| `sources` | Materials from which the concept derives. | Preserved as frontmatter, including unknown nested keys and date-only values. Superbee does not compute a credibility score. |
| `generated` | Actor and meaningful-change time for the current content. | Optional. A mutation preserves `by`; a meaningful content or provenance change advances `at`. A verification-only change does not advance it. |
| `verified` | One or more independent verification events. | Preserved across a mutation when the candidate omits it. Stable Superbee does not currently expose an OKF trust-tier projection. |
| `status` | `draft`, `stable`, or `deprecated`; absence means `stable` in OKF. | Preserved as the standard lifecycle field. Superbee does not insert `stable` when the field is absent. |
| `stale_after` | Absolute instant on or after which the concept is stale. | Preserved. `superbee status` includes it in the freshness sweep. |

When `generated` is newly supplied through the governed mutation path, `generated.by` must use
`human:<id>`, `process:<id>`, or `<producer>/<version>`, and `generated.at` must parse as an ISO 8601
date-time when present. Imported metadata is consumed permissively: unknown keys and unusual legacy
actor spellings remain available instead of being silently discarded.

Superbee records its advisory mutation attribution separately. In v0.2, `--actor` can persist
`superbee_updated_by`; it does not replace the provenance actor in `generated.by`.

Superbee preserves a bare `verified` mapping as supplied. Code that derives the OKF trust tier must
apply the specification's rule that a bare mapping is equivalent to a one-element list.

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

# Validation boundaries

`superbee status` is a read-only bundle health report. It reports malformed YAML, Kind conformance,
unresolved links, freshness, graph expectations, View registration problems, and relevant legacy
findings. Findings do not make the command fail after the analysis completes.

The stable release is a permissive OKF consumer. It does not claim a complete schema validator for
every optional `sources`, `verified`, lifecycle, or attested-computation field. Use the official OKF
specification when producing those families, and preserve unknown fields when integrating another
producer's bundle.

Superbee's authoring paths add stricter rules where they own a mutation:

- generic writes require a non-empty `type`;
- a Kind-aware `new` operation validates the declared Kind strictly;
- generic writes can warn or use `--strict` when a Kind governs the type;
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

# v0.1 compatibility and migration

OKF v0.2 supersedes the v0.1 `timestamp` clock with `generated.at` and the body `# Citations` list
with `sources`. Both v0.2 families are optional, so imported v0.1 content remains readable.
Superbee's v0.1 write policy supplies a top-level `timestamp` when it is missing. The v0.2 policy
does not invent `timestamp`, `sources`, or `verified`.

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

[Migrate or upgrade safely](../guides/migrate-or-upgrade-safely.md)

[Bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

[CLI overview](cli-overview.md)

[Current release evidence](../sources/current-release.md)

# Evidence

- [Official OKF v0.2 specification at `4bc03b7`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/4bc03b7560caa862cdeebccbeb2bced68940c9f0/okf/SPEC.md)
- [Stable bundle engine](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/src/bundle.ts)
- [Stable frontmatter parser](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/src/frontmatter.ts)
- [Stable v0.2 mutation policy](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/src/document-write-policy.ts)
- [Stable concept identity and reserved-file rules](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/src/paths.ts)
- [Stable link resolver](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/src/links.ts)
- [v0.2 read compatibility tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/test/okf-v0-2-read-compat.test.ts)
- [v0.2 write contract tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/test/okf-v0-2-write-contract.test.ts)
- [Workflow progress compatibility tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/test/progress-status.test.ts)
- [Stable status implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/src/commands/status.ts)
- [Stable document-read implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/src/commands/doc/read.ts)

# Journey check

Use one disposable v0.2 bundle, one disposable governed v0.1 bundle, and one hand-authored v0.2
fixture. The reader should identify the edition, explain reserved files, inspect standard metadata,
resolve both link forms, retrieve a complete document through the byte channel, and stop a v0.1
edition change when workflow `status` still collides with the v0.2 lifecycle field.
