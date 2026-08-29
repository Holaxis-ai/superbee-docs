---
type: Concept
title: Understand reusable domain structure
description: >-
  Choose when documents, relationships, Kinds, recipes, and Views earn their
  maintenance cost.
superbee_updated_by: openai/codex
---
# Question answered

When should a bundle use an ordinary document, Kind, recipe, relationship, or View?

This explanation is for active users and agents choosing how much durable structure a real problem
needs. It is grounded in [the current stable release](../sources/current-release.md) and the current
Superbee Skill.

# Start with the recurring cost

Structure earns its place when it prevents repeated reconstruction, inconsistent records, lost
provenance, or repeated human interpretation. Begin with the smallest layer that removes the
observed cost. Add another layer after use reveals a stable need.

| Layer | Use it when | What it adds | Ongoing cost |
| --- | --- | --- | --- |
| Document | One important fact, decision, result, or explanation needs to persist. | A typed Markdown record with a stable ID. | Keep one record accurate. |
| Relationship | The meaning between two records matters to later readers or queries. | A labeled Markdown link and a derived backlink. | Preserve accurate targets and vocabulary. |
| Kind | Several documents represent the same domain concept and consistency matters. | Shared fields, allowed values, headings, paths, freshness, and relationship guidance. | Migrate instances when the convention evolves. |
| Recipe | Stable definitions should be installed in another bundle. | A portable package of conventions and declared reference or View definitions. | Version and review the reusable package. |
| View | People repeatedly rebuild the same comparison, graph, timeline, or decision surface. | A human presentation over authoritative bundle knowledge. | Maintain the presentation and its trust boundary. |

# How the layers fit together

## Documents preserve specific knowledge

A document records one meaningful thing in ordinary Markdown with YAML frontmatter. Generic
documents remain useful throughout a bundle's life because many facts never recur enough to justify
a schema.

Create a representative document while a domain shape is still emerging. Its actual use reveals
which fields, headings, and relationships remain stable.

## Relationships preserve context between records

Links can express evidence, dependency, provenance, containment, or any vocabulary the domain
needs. Superbee stores the link in the source document and derives the backlink. This keeps the
graph inspectable in Markdown and avoids a separate edge database.

A Kind can declare typed relationship vocabulary and expected inbound relationships. Untyped
citations remain available for links whose meaning has not stabilized.

## Kinds make recurring concepts consistent

A Kind is a convention document owned by the bundle. It governs documents whose `type` matches its
`governs` value. The convention may declare fields, enum values, required headings, path prefixes,
freshness horizons, terminal workflow values, and relationship vocabulary.

Kinds support reliable creation and maintenance. `superbee new "<Kind>"` validates a new instance
strictly, while `superbee status` checks existing instances across the bundle. The documents remain
the records people and agents read.

## Recipes move stable definitions between bundles

A recipe contains definitions and guidance. Applying one copies its declared convention documents
into the selected bundle, which then owns those files. Project instances stay with their project.

Recipe application is idempotent. If an installed definition has changed locally, a later recipe
application reports source drift and leaves the bundle's version untouched. This behavior gives the
owner a visible migration decision.

## Views reduce repeated interpretation

A View is useful when a human repeatedly needs the same representation of several documents and
relationships. Examples include a research evidence map, release readiness panel, experiment
comparison, or interactive timeline.

The View reads admitted bundle knowledge through an explicit capability. Documents and evidence
remain authoritative. The View can evolve or be replaced without migrating the underlying domain
records.

# A typical progression

Consider a team learning from customer interviews:

1. Preserve the first interview as an ordinary `Interview` document.
2. Add links when statements support existing decisions or reveal related needs.
3. After several interviews show the same useful fields and sections, declare an `Interview` Kind.
4. Introduce an `Insight` Kind after repeated synthesis exposes a stable shape and relationship
   vocabulary.
5. Package the definitions as a recipe when another bundle needs the same reviewed model.
6. Add a View after stakeholders repeatedly assemble the same evidence and insight overview.

Each step answers a cost observed in use. A project may stop at any step. A research bundle can
benefit from Kinds and relationships without adopting task tracking or a roadmap.

# Selection check

Use these questions before adding structure:

1. Is there one important record or a recurring class of records?
2. Which inconsistencies have already caused work or confusion?
3. Do links carry useful domain meaning that later readers need to query?
4. Will the same definitions be reused in another bundle?
5. Which overview do people repeatedly reconstruct?

Choose a document for the first case, a Kind for proven repetition, relationships for durable
context, a recipe for reusable definitions, and a View for repeated interpretation. If the evidence
is still weak, keep a representative document and revisit the decision after use.

# Boundaries and limitations

- A Kind validates declared shape. It cannot determine whether a claim, decision, or conclusion is
  true.
- A recipe installs definitions. It does not manage project instance data.
- A View presents bundle knowledge. It does not become the authority for that knowledge.
- Convention changes can create conformance work for existing documents. Inspect the affected
  instances and plan the migration before changing the convention.
- Different purposes may deserve separate bundles when their privacy, participants, or lifecycle
  differ.

# Evidence

The released implementation and tests for these boundaries are:

- [Kind registry and vocabulary](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/commands/kinds.ts)
- [Recipe parser](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/recipe-parser.ts)
- [Typed relationship tests](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/link.test.ts)
- [Registered View implementation](https://github.com/Holaxis-ai/superbee/tree/f4e1c37349627030f8201ff52028f71a9c92570a/packages/view-runtime)

[bundles, documents, and relationships](bundles-documents-and-relationships.md)

[model recurring domain concepts](../guides/model-recurring-domain-concepts.md)

[what Superbee is](what-superbee-is.md)
