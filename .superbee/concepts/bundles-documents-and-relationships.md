---
type: Concept
title: 'Bundles, documents, and relationships'
description: >-
  How Superbee's portable bundle, document, convention, recipe, link, version,
  and presentation layers fit together.
superbee_updated_by: openai/codex
---
# Question answered

What is inside a Superbee workspace, and how do its parts remain portable while gaining useful
structure?

This explanation describes released `superbee@0.1.3` behavior and new OKF v0.2 bundles.

# A bundle is a portable boundary

A bundle is a directory with a root `index.md` declaring its Open Knowledge Format version. Concept
documents are Markdown files; non-document artifacts remain byte-exact blobs. The document ID is its
bundle-relative path without `.md`.

The conventional project location is `.superbee/`. From a project subdirectory, Superbee walks up
to discover that folder much like Git discovers `.git`.

Resolution remains explicit and deterministic:

1. an explicit `--dir` selects a local bundle;
2. an explicit `--remote` selects a wire-protocol service and cannot be combined with `--dir`;
3. a supported project binding can point to an out-of-tree local bundle;
4. otherwise conventional local discovery walks upward; and
5. a private catalog label must be deliberately resolved and selected—it is not ambient context.

If valid `.superbee/` and legacy `.agentstate-lite/` bundles compete at one project level, Superbee
refuses to choose.

# Documents carry meaning

Every non-reserved concept document has YAML frontmatter with a non-empty `type`, followed by a
Markdown body. Common fields such as title and description help people and agents scan results.
Kinds may declare additional fields, allowed values, and expected headings for a particular type.

The generic path remains available even when no Kind exists:

```sh
superbee doc write decisions/storage \
  --type Decision \
  --title "Keep storage local"
```

Use `doc update` to patch an existing document while preserving unspecified fields and body. Use
`doc read` for model-sized inspection, or its byte-channel options when complete Markdown, body, or
canonical rendered HTML should bypass model context.

# Kinds are bundle-owned conventions

Kinds live under `conventions/` as ordinary convention documents. They can describe:

- required and optional fields;
- enum values;
- required body headings;
- freshness horizons; and
- typed outbound and expected inbound relationships.

`superbee kinds` lists the conventions active in the selected bundle. `superbee new "<Kind>"`
creates a strictly validated instance and can add declared links in the same operation.

A bundle without conventions remains valid. Add a Kind only after repeated documents demonstrate a
real consistency or lifecycle need.

# Recipes install reusable structure

`superbee recipes` shows the definitions shipped with the release. In `0.1.3` they are:

- `context-notes`;
- `work-tracking`; and
- `roadmap`.

The default initialization applies `context-notes`; `--recipe none` creates a bare bundle. Applying
another recipe is explicit and idempotent:

```sh
superbee recipe add <name-or-path>
```

A recipe installs definitions rather than project instances. After application, the bundle owns
the resulting content.

# Relationships remain ordinary links

A Markdown link from one concept document to another is the stored edge. Superbee derives the
reverse backlink; backlinks are never copied into frontmatter.

```sh
superbee link add decisions/storage evidence/local-first --text "supported by"
superbee link show decisions/storage
superbee link list --text "supported by"
```

Adding the same relationship again is a no-op. A Kind may describe allowed or expected relationship
labels, but the graph still comes from the documents' links rather than a separate database of
edges.

# Versions protect concurrent work

Each document state has a content-derived version token. Mutations use compare-and-swap semantics;
callers that supply `--expected-version` fail on a stale head instead of replacing newer content.
Writes may carry an actor identity, and history-keeping backends expose the attributed chain through
`doc history`. A plain local filesystem reports its current content version; Git can preserve the
broader file history.

# Views and artifacts serve humans

`doc open` and `ui` render documents through Superbee's shared bounded Markdown renderer. Registered
Views use an exact bundle registration and an explicit trust boundary for richer presentations.
`artifact create` packages a produced HTML output and its record in one operation.

These are presentation and output surfaces. They do not change which document or evidence is
authoritative.

[what Superbee is](what-superbee-is.md)

[CLI overview](../reference/cli-overview.md)

[release evidence](../sources/superbee-release-0.1.3.md)

# Re-evaluate this page when

- OKF authoring or reserved-file rules change;
- bundle resolution precedence changes;
- Kind, recipe, link, or version semantics change; or
- a presentation surface becomes an independent authority.
