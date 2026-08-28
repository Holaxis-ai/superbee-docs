---
type: Concept
title: What Superbee is
description: >-
  The product mental model: durable bundles, typed documents, reusable
  structure, relationships, and human representations.
superbee_updated_by: openai/codex
---
# The short version

Superbee is a local, user-owned knowledge environment shared by humans and AI agents. It turns work
that would otherwise disappear in chat—decisions, evidence, domain models, procedures, and useful
representations—into typed, linked Markdown that later sessions can inspect and extend.

The AI model remains the expert doing the work. Superbee supplies the durable environment that lets
the result compound instead of being reconstructed each time.

This explanation describes behavior verified against
[the current stable release](../sources/current-release.md).

# The core mental model

```text
project
  -> bundle
      -> documents
          -> relationships
      -> optional Kinds and recipes
      -> human documents, Views, and artifacts
```

## Bundle

A bundle is a folder of Open Knowledge Format Markdown and opaque artifacts. It is the unit that is
kept local, shared, copied, reviewed, or published. The filesystem remains readable without
Superbee; the CLI adds safe semantics and agent-friendly operations.

## Document

A document preserves one meaningful thing. Every document has a `type`, may carry other structured
fields, and has a Markdown body. A bundle can hold a decision, claim, experiment, interview,
release, task, or a concept specific to the user's domain without Superbee adding a new subsystem.

## Relationship

Relationships are ordinary Markdown links between documents. Superbee resolves and queries them,
derives backlinks, and can validate link vocabulary declared by a Kind. The links remain useful in
GitHub and ordinary editors.

## Kind

A Kind is an optional convention document that makes a recurring domain concept consistent. It can
declare fields, allowed values, required headings, freshness, and relationship vocabulary. A Kind
does not replace the documents; it lets agents create and maintain repeated documents reliably.

## Recipe

A recipe packages reusable definitions—Kinds and, when declared, References or Views. Applying a
recipe installs capability into the bundle; the resulting files belong to the bundle and remain
inspectable. Recipes are useful when a stable structure should travel between projects.

## Human representation

Documents render as Markdown pages. Registered Views are self-contained, explicitly trusted visual
representations over bundle knowledge. Artifacts are produced outputs such as HTML meant to be
shared with a human. Neither becomes a second source of truth: the bundle's documents and evidence
remain authoritative.

# One structure does not fit every project

Superbee does not require task tracking or a roadmap. An agent should first understand the user's
work and then add the smallest structure that removes repeated effort:

- one document when one important thing needs to persist;
- a relationship when two things need durable context;
- a Kind when a domain concept recurs and inconsistency is costly;
- a recipe when stable definitions should be reused; or
- a View when humans repeatedly reconstruct the same overview.

The structure can evolve as the user's domain and questions change.

# Humans and agents share authority

Agents use the CLI because its structured, bounded output is predictable and economical. Humans can
still read every Markdown file, inspect history through Git, and ask Superbee to open an exact
document or View. Configuration and publication changes remain explicit human decisions.

Document writes are content-versioned and attributed. A stale writer receives a conflict instead of
silently overwriting a newer state. On a plain local filesystem, Git supplies longer history when
the bundle is committed or shared.

# Local, shared, and public are distinct

1. **Local:** `superbee init` creates a workspace on the current machine. This is the default.
2. **Shared:** `superbee sync --establish` is the separate explicit act that creates a shared board
   through a repository remote. Ordinary `sync` then exchanges board changes.
3. **Public:** a publication snapshot and site pipeline may expose a deliberately public bundle.
   Publishing is not implied by creating or cataloging it.

A private catalog provides explicit machine-local workspace selection. A catalog entry never makes
that bundle the active context of an unrelated project.

# Current maturity

Superbee is pre-1.0. The local bundle engine, agent-facing CLI, document presentation, Kinds,
recipes, and Git sharing are functional, but commands and formats can still change. Release-specific
pages state the exact package they verify rather than describing newer source as already shipped.

[create your first durable workspace](../get-started/first-durable-workspace.md)

[understand bundles, documents, and relationships](bundles-documents-and-relationships.md)

[CLI overview](../reference/cli-overview.md)

[system context](../architecture/superbee-system-context.md)

[current release evidence](../sources/current-release.md)

# Re-evaluate this page when

- the product's local/shared/public authority model changes;
- Kinds, recipes, Views, or artifacts change their role;
- the storage or concurrency contract changes materially; or
- a stable release changes the product's maturity claim.
