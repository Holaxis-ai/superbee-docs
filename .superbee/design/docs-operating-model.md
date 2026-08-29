---
type: Design
title: Documentation operating model
description: >-
  Audience, content, authority, lifecycle, and maintenance contract for
  Superbee's public documentation.
superbee_updated_by: openai/codex
---
# Outcome

The documentation bundle helps a curious evaluator understand Superbee, a new user succeed without
already knowing the product vocabulary, an active user complete recurring work, and a maintainer
verify product behavior. It is readable public documentation and source-grounded knowledge that
agents can evolve through reviewable changes.

This document governs documentation structure and maintenance. Product behavior remains governed by
the product sources linked from each page.

# Audiences and success conditions

| Audience | Immediate question | Successful outcome |
| --- | --- | --- |
| Prospective or first-time user | What does Superbee do, does it fit, and how do I get one visible success? | Understands the product boundary, installs safely, and creates or joins the intended bundle. |
| Practitioner or operator | How do I preserve, model, relate, present, share, upgrade, or recover this work? | Selects the smallest useful structure and completes the task. |
| Contributor or integrator | What governs behavior, how does this host or interface behave, and how do I extend or update it? | Finds the governing behavior and evidence, changes the right page or integration, and proves the result. |

Documentation should start from the reader's goal. Superbee vocabulary is introduced only when it
helps the reader make or execute a decision.

# House style

Write concise technical prose for a human reader:

- Name the subject, behavior, and result directly.
- Use a period, comma, colon, semicolon, or parentheses in place of an em dash.
- Replace rhetorical denial-then-correction patterns with a direct statement of the behavior that
  matters.
- Reserve terms such as `exact`, `authority`, `boundary`, and `durable` for cases where they name a
  verified identity, security rule, ownership rule, or persistence guarantee. Prefer the concrete
  component, scope, or behavior elsewhere.
- Keep commands, identifiers, schema terms, source citations, and compatibility constraints
  verbatim. Editorial simplification must preserve their technical meaning.
- Prefer one clear claim per sentence. Explain necessary safety distinctions without dramatizing
  them or narrating the review process.

The repository prose check enforces only objective signals: em dashes, a short banned-phrase list,
and common rhetorical contrast templates. Human review remains responsible for clarity, tone, and
technical fidelity in both rendered documentation outputs.

# Content model and navigation

Internally, every reader-facing page has one primary mode:

- **Tutorial:** a safe, guided learning experience that produces a real result.
- **How-to:** a task-oriented procedure for a reader who already knows the desired outcome.
- **Explanation:** a mental model, boundary, or rationale that makes later decisions easier.
- **Reference:** exact facts organized for lookup.

These modes follow the distinct user needs described by
[Diataxis](https://diataxis.fr/). They are an authoring classification, not the required names of
the site's primary navigation. Releases and migrations are a navigation and product-lifecycle area:
release facts are Reference, migration procedures are How-to, and design rationale is Explanation.
Landing and map pages are structural navigation and do not need a content mode.

The public navigation uses conventional goal-oriented labels:

1. **Get started:** orientation, installation, setup, first bundle, and first persisted result.
2. **Core concepts:** bundles, documents, Kinds, recipes, relationships, Views, and trust.
3. **Guides:** preserve context, model a domain, coordinate work, present knowledge, share, and
   recover.
4. **Integrations:** supported agent hosts and installation or lifecycle differences.
5. **Examples:** complete, inspectable bundles and patterns grounded in real needs.
6. **Reference:** CLI, configuration, schemas, compatibility, security constraints, and errors.
7. **Troubleshooting:** symptom-first diagnosis and recovery.
8. **Releases and migrations:** verified versions, changes, actions, and compatibility windows.
9. **Contributing and architecture:** documentation maintenance and source-grounded system design.

Launch with a shallow subset that has real content: Get started, Core concepts, Guides, Reference,
Releases and migrations, and Architecture and contributing. Promote Integrations and Examples to
top-level navigation only when each has enough verified material to justify the space.

The first page offers two or three likely next actions. Section pages orient and route; they do not
become long catalogs. Article pages expose related prerequisites, next actions, sources, and relevant
visuals without making the raw bundle tree the primary interface.

# Priority user journeys

The initial documentation is complete enough to launch only when a reader can perform these journeys
without private knowledge:

1. Decide whether Superbee fits the work.
2. Install Superbee and complete host setup.
3. Create a greenfield bundle or safely join an existing one.
4. Preserve important context and retrieve it in a later session.
5. Recognize when an ordinary document, Kind, recipe, relationship, or View is warranted.
6. Present a document or View to a human.
7. Share and synchronize a bundle without confusing another bundle for the active project.
8. Diagnose common setup, resolution, validation, and View failures.
9. Upgrade or migrate using verified release guidance.

These are the task corpus for documentation review. Navigation labels and page counts are secondary
to whether the journeys succeed.

# Page contract

Every reader-facing page states, either explicitly or through its placement and introduction:

- the intended audience and outcome;
- one primary content mode;
- prerequisites and supported scope;
- the exact product or release evidence that governs material behavior claims;
- the tested package version or source commit when the behavior is version-sensitive;
- expected result and recovery guidance for procedures;
- related concepts, next actions, and relevant registered Views.

Additional expectations depend on the mode:

| Mode | Required shape |
| --- | --- |
| Tutorial | Starting state, guided sequence, observable checkpoints, final working result, cleanup or next step. |
| How-to | Goal, prerequisites, shortest supported procedure, verification, likely failures. |
| Explanation | Question, mental model, boundaries, examples, implications, evidence. |
| Reference | Supported version, exact syntax or schema, defaults, constraints, errors, authoritative source. |

Examples must be runnable or clearly marked illustrative. Commands are copied from current help or
verified installed-package behavior, not reconstructed from memory. Claims such as supported,
secure, deterministic, compatible, or complete require corresponding evidence.

# Sources and authority

Each maintained page names its authoritative source class:

- source and tests for product semantics;
- generated CLI help and packed-package probes for command behavior;
- schemas for accepted structure;
- installed-host probes for host compatibility;
- npm and GitHub release receipts for released state;
- reviewed product decisions for declared policy.

Evidence links and version pins live visibly in the page or a linked `Source` document. Operational
`Documentation Trigger` records relate maintained pages to source paths and named product events.
They are ordinary public bundle documents, so agents and public inspection tools can query them
without forcing maintenance instructions into reader prose. Private material may inform a separately
reviewed public explanation but is never copied into this bundle.

Generated reference is authoritative only for the exact facts its generator can prove, such as
command syntax, options, defaults, output fields, or schemas. Authored pages own task framing,
explanation, examples, limitations, and recovery. Generated text must not overwrite authored prose,
and authored prose must not duplicate generated facts where a stable link or projection will do.

## Page freshness

Page freshness is computed by the publication workflow, not typed into prose or frontmatter for
display. `Last updated` means the document's OKF meaningful-change clock (`generated.at`, with the
legacy `timestamp` fallback) when present. Otherwise it is the commit time of the exact clean,
tracked document source in the repository's full Git history. The fact is bound to that document's
source version before entering the shared documentation projection, so unchanged inputs rebuild to
the same output. Dirty files, untracked files, shallow history, and other unknown sources emit no
date.

`Last verified` is a different claim. It may be published only when an independent immutable
verification input exists; an evidence-only verification must not change `Last updated`. Product
release applicability remains the configured version label and is not inferred from either date.
Portal and MkDocs render the same available facts with native, accessible `<time>` elements and
omit missing facts.

# Lifecycle

The persisted lifecycle is deliberately small:

1. **Current:** the page passed its evidence, link, task, and publication checks for its stated
   version or scope.
2. **Needs review:** a declared trigger changed or evidence is no longer sufficient; the limitation
   is visible until the page is re-verified.
3. **Retired:** the page no longer earns maintenance and identifies its replacement or historical
   scope.

`Planned` belongs in the coverage plan. A branch or pull request is the draft and review state; the
bundle does not need duplicate workflow records. After several real pages prove which fields and
transitions recur, the bundle may promote the stable shape into Kinds. Until then, the coverage plan
is the one planning projection and Git history is the audit trail.

# Operational documentation records

`Documentation Trigger` records live under `maintenance/documentation-triggers/`. Each record names
its affected page, exact source-path patterns or product events, the required review action, and the
governing evidence. They remain generic OKF documents until repeated authoring demonstrates that a
Kind would reduce real maintenance effort.

The documentation profile declares `Documentation Trigger` in `operationalTypes`. The complete
Portal publication therefore retains every trigger under its raw bundle route, while the shared
documentation projection rejects any attempt to select one as navigation or supporting content.
This is a presentation rule, not an authorization or privacy boundary.

Run `npm run docs:impact:check` to validate the records and their affected-page links. For a product
change, run `npm run docs:impact -- --changed <source-path>` and add repeatable `--changed` or
`--event` arguments as needed. Review every returned page and either update it or record why the
verified behavior did not change.

# Operational moments

| Moment | Required action |
| --- | --- |
| Before authoring | Locate the page brief, confirm its primary mode, inspect existing pages, and resolve the governing public sources. |
| During drafting | Verify each material behavioral claim and execute procedural checkpoints while the page is being written. |
| Before review | Confirm the page contract, links, public boundary, package or source identity, and affected journey. |
| Before merge | Run the repository check and inspect both the exact Portal artifact and conventional MkDocs output for pages whose presentation changed. |
| Product behavior merge | Query the operational trigger records for changed sources or events; update affected pages or mark them stale. |
| Verified release | Reconcile release facts, compatibility, reference version labels, and migration guidance. |
| Quarterly audit | Remove ceremonial pages and visuals, promote repeated stable structure, and test the priority journeys. |

## Stable current-release identities

Reader navigation and maintained pages link to `releases/current` and `sources/current-release`, not
to a package-version path. Each verified release also creates immutable `releases/<version>` and
`sources/superbee-release-<version>` records. The stable documents are semantic copies of those
immutable records, so history remains inspectable while ordinary pages avoid mechanical version
churn.

The release process passes an ephemeral, validated JSON handoff to:

```bash
npm run docs:release -- --manifest <release.json>
```

The input is transport, not a persisted documentation authority. The command normalizes and writes
the four bundle documents through Superbee, refuses to replace immutable history, and is idempotent
when retried. `npm run docs:release:check` verifies stable-to-immutable agreement, stable Portal
navigation, and the absence of hardcoded Superbee package versions outside release, evidence, or
migration records. Authored behavioral claims still require the declared release verification;
automation never promotes an unverified version merely by changing a number.

An agent run ends with a durable update to the relevant page or plan, the evidence examined, checks
run, and unresolved questions. Private chat is not the handoff mechanism.

# Multi-agent coordination

- One agent owns one bounded page or tightly coupled page set at a time.
- The coverage plan is the shared queue; an active branch or pull request is the observable claim on
  a page brief during the pilot.
- Research agents return source identities and claim-level findings, not ungrounded prose for direct
  publication.
- Authors integrate evidence and maintain narrative coherence.
- Reviewers audit the exact page against its sources and journey; site reviewers test the rendered
  experience using the settled product semantics.
- Navigation and synthesis pages are reduced only after their contributing pages stabilize.

# Site and bundle boundary

The bundle owns documents, relationships, evidence links, registered Views, and the information
architecture. One captured Superbee publication snapshot and one explicit, owned documentation
projection bind the selected documents, navigation, relationships, brand asset, and admitted static
diagrams before any output adapter runs. Portal owns its deterministic publication artifact,
integrity and View-admission boundaries, browser primitives, and deployment adapters. The Portal
documentation client owns routing, layout, navigation rendering, search presentation, and responsive
behavior. The separate MkDocs adapter owns only its conventional static-site materialization. Both
consume the same closed projection and generated bytes remain projections, never competing content
authorities.

The entire public bundle remains inspectable. The primary UI may emphasize a curated subset and
human navigation without hiding the underlying documents.

# Stopping rule

Do not introduce a Kind, generated index, claim registry, content metric, or maintenance job unless
it removes observed authoring, review, release, or reader effort. The next milestone is a verified
representative vertical slice, not a comprehensive documentation bureaucracy.

[coverage and delivery plan](../plans/docs-coverage.md)

[site experience contract](site-experience-contract.md)

[current system context](../architecture/superbee-system-context.md)
