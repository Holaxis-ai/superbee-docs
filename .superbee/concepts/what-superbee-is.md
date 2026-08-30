---
type: Concept
title: What Superbee is
description: >-
  The product mental model: durable bundles, typed documents, reusable
  structure, relationships, and human representations.
superbee_updated_by: openai/codex/root
---
# The core mental model

One bundle is an ordinary folder containing records that remain useful with or without Superbee.
The visual uses the built-in Context Note, Task, Roadmap Item, and Roadmap conventions to show one
realistic arrangement.

The same model in text:

1. `roadmap.md` is a `Roadmap` document. Its `contains` link points to
   `roadmap-items/docs-release.md`, a `Roadmap Item`.
2. The Roadmap Item uses another `contains` link to group `tasks/explain-product.md` and
   `tasks/publish-docs.md`, both `Task` documents.
3. `tasks/publish-docs.md` uses the Task convention's `depends on` relationship to record that the
   explanation must be ready first. Superbee derives the reverse backlink.
4. `context-notes/handoff.md` is a `Context Note` that preserves what a later session needs to
   resume. It remains an ordinary Markdown file beside the longer-lived records.
5. Convention documents under `conventions/` declare the expected fields and relationship
   vocabulary. The documents remain the project records.
6. A human can read the Markdown directly. An agent can use Superbee to create, query, validate,
   relate, version, and open the same records.

## Bundle

A bundle is a folder of Open Knowledge Format Markdown documents and inspectable supporting files.
It is the unit kept local, shared, copied, reviewed, or published. Concept documents remain readable
in ordinary editors. Attachments and produced outputs retain their original bytes; access to a file
does not imply that every reader or model can interpret its format.

## Document

A document preserves one meaningful thing. Every document has a `type`, may carry other structured
fields, and has a Markdown body. A bundle can hold a decision, claim, experiment, interview,
release, task, or a concept specific to the user's domain without Superbee adding a subsystem for
each one.

## Relationship

Relationships are ordinary Markdown links between documents. Superbee resolves and queries them,
derives backlinks, and can validate link vocabulary declared by a Kind. The links remain useful in
GitHub and ordinary editors.

## Kind

A Kind is an optional convention document that makes a recurring domain concept consistent. It can
declare fields, allowed values, required headings, freshness, and relationship vocabulary. A Kind
does not replace the documents; it gives humans and agents a shared interface for creating and
maintaining repeated records.

## Recipe

A recipe packages reusable definitions, including Kinds and, when declared, References or Views.
Applying a recipe installs capability into the bundle. The resulting files belong to the bundle and
remain inspectable. Recipes are useful when a stable structure should travel between projects.

## Human representation

Documents render as Markdown pages. Registered Views are self-contained, explicitly trusted visual
representations over bundle knowledge. Supporting files can include images, attachments, and
produced outputs such as HTML. The bundle's documents and evidence remain authoritative across
these presentations.

# Why Superbee

AI agents can complete useful work in one session and still leave the next session reconstructing
the same decisions, evidence, and project vocabulary. Important knowledge often remains buried in
chat, while overlapping edits and accidental sharing become harder to reason about as work spans
more people, agents, and days.

Superbee gives humans and AI agents a shared, user-owned knowledge environment. It preserves
decisions, evidence, domain models, procedures, and useful representations as typed, linked
Markdown that later sessions can inspect and extend. The AI model remains the expert doing the
work. Superbee makes the useful results available to whatever capable agent works next.

This explanation describes behavior verified against
[the current stable release](../sources/current-release.md).

## What changes when knowledge becomes part of the project

| Recurring problem | Superbee response | Practical result |
| --- | --- | --- |
| A new session must reconstruct what happened. | Important context becomes a named Markdown document with links to the relevant work. | The next session starts from an inspectable handoff instead of chat history. |
| Two writers act on the same record. | Writes carry content versions and stale updates receive a conflict. | A newer edit is not silently replaced. |
| The human cannot see what an agent learned. | Documents open as rendered Markdown, and Views can present repeated human overviews. | People can inspect the knowledge that will guide later work. |
| Useful structure exists only in one prompt or agent's memory. | Optional Kinds declare shared fields, allowed values, sections, freshness, and relationship vocabulary. | Humans and agents can discover and maintain recurring domain records with less guessing. |
| Local work is shared by accident. | Local creation, Git-backed sharing, and public publication remain separate actions. | The owner chooses when a bundle leaves the machine and what public pipeline receives it. |

Superbee is a good fit when work spans sessions, important reasoning needs provenance, recurring
domain records benefit from shared structure, or humans repeatedly need to inspect what agents
have produced. A plain file or short-lived chat is usually enough when the work has no meaningful
continuity, relationships, coordination, or reuse.

# Match structure to the project

Task tracking and roadmaps are optional. An agent should first understand the user's work and then
add the smallest structure that removes repeated effort:

- one document when one important thing needs to persist;
- a relationship when two things need persistent context;
- a Kind when a domain concept recurs and inconsistency is costly;
- a recipe when stable definitions should be reused; or
- a View when humans repeatedly reconstruct the same overview.

The structure can evolve as the user's domain and questions change. See
[reusable domain structure](reusable-domain-structure.md) for the selection and evolution model.

# Humans and agents stay in control

Agents use the CLI because its structured, bounded output is predictable and economical. Humans can
read every Markdown document, inspect Git history for a committed or shared bundle, and ask
Superbee to open a specific document or View. Configuration and publication changes remain explicit
human decisions.

Document writes are content-versioned and attributed. A stale writer receives a conflict,
preserving the newer state. A plain local filesystem provides the current version; Git supplies
longer history when the bundle is committed or shared.

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
pages identify the package they verify and keep unreleased source behavior separate.

[create your first durable workspace](../get-started/first-durable-workspace.md)

[understand bundles, documents, and relationships](bundles-documents-and-relationships.md)

[CLI overview](../reference/cli-overview.md)

[system context](../architecture/superbee-system-context.md)

[current release evidence](../sources/current-release.md)
