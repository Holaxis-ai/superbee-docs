---
type: Plan
title: Documentation coverage and delivery
description: >-
  Ordered page coverage, representative slice, and readiness gates for the
  public documentation.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T13:12:49.684Z'
---
# Purpose

This is the shared, ordered coverage plan for Superbee's public documentation. It controls scope and
coordination without pretending that planned pages already document product behavior.

Status values used here are `current`, `planned`, and `blocked`. A branch or pull request represents
draft and review; the plan does not duplicate that workflow. A page becomes `current` only after its
evidence and user-journey checks pass.

# Representative vertical slice

This slice proves the content modes, navigation, evidence model, site presentation, and update
workflow before broad generation.

| Priority | Page | Mode | Primary audience | Status | Governing evidence |
| --- | --- | --- | --- | --- | --- |
| P0 | Start here | Structural navigation | Evaluator and first-time user | current | Product statement and current verified journeys |
| P0 | What Superbee is | Explanation | Evaluator | current | Current stable release evidence, current Skill, product source, and core mental-model diagram |
| P0 | Install and set up Superbee | Tutorial | First-time user | current | Current stable release evidence, CLI help, isolated setup plans |
| P0 | Verify host setup | How-to | First-time user and integrator | current | Current stable setup plans, integration status commands, and live-host restart boundary |
| P0 | Create your first durable workspace | Tutorial | First-time user | current | Current stable release disposable init, write/read, discovery, home, status, and tagged doc-open behavior |
| P0 | Bundles, documents, and relationships | Explanation | New and active user | current | Current stable release help, OKF semantics, product source |
| P0 | Preserve context between sessions | How-to | Active user | current | Stable Context Note recipe plus a disposable create, edit, link, and resume journey |
| P0 | Understand reusable domain structure | Explanation | Active user and agent | current | Stable Kinds, recipes, validation, View behavior, and current Skill |
| P0 | Model recurring domain concepts | How-to | Active user and agent | current | Stable recipe and Kind commands plus a disposable modeled-domain journey |
| P0 | Show documents and Views to a human | How-to | Active user and agent | current | Stable CLI help, tagged browser and MCP implementations, and live host probes |
| P0 | Choose privacy and bundle boundaries | How-to | Active user and operator | current | Tagged bundle selection, catalog, MCP workspace, and public-publication behavior |
| P0 | Share and synchronize a Git-backed bundle | How-to | Active user and operator | current | Stable board-git state machine, sync CLI behavior, and conflict recovery tests |
| P0 | CLI overview | Reference | Active user and integrator | current | Generated current-release help and installed package |
| P0 | Host and platform support | Reference | First-time user and integrator | current | Current stable npm metadata, setup plans, and release verification evidence |
| P0 | Troubleshoot setup and bundle resolution | How-to | First-time user and integrator | current | Stable setup conductor, bundle resolution tests, and isolated failure probes |
| P0 | Current release | Reference | Existing user | current | npm/GitHub release receipts |
| P0 | Release notes archive | Reference | New and existing user | current | Immutable Release records, public npm/GitHub authorities, and the release-documentation freshness probe |
| P0 | Migrate or upgrade safely | How-to | Existing user | current | Stable release receipts, private-state source, and disposable OKF v0.1 compatibility journey |
| P0 | System context | Explanation | All technical readers | current | Pinned Superbee and Portal source; Diagram is its visual representation |
| P0 | Document mutation lifecycle | Explanation | Contributor and integrator | current | Pinned Superbee source; verified read/update/history sequence; registered diagram |

# Audited gap completion slice

The stable release refresh reviewed the public npm, GitHub release, and tag evidence linked from
[the current release](../releases/current.md). Release-event impact queries cover installation,
host verification, modeling, presentation, bundle selection, synchronization, and compatibility.
The refresh documents OKF v0.2 actor spelling, standard-field and timestamp validation, document
verification and trust tiers, explicit frontmatter field actions, permission-aware sharing details,
fresh-clone board provisioning, and managed reader abandonment. Guides whose examples used an actor
spelling that the current release refuses were corrected. Pages whose verified behavior did not
change retain their stated scope; the architecture source pin is independently maintained.
Installed CLI identity, help comparison, and disposable journey probes establish the package
behavior used here. Live host restart, remote GitHub sharing failures, and native Windows journeys
remain bounded by their linked release evidence.

The whole-code and documentation audit added this coupled reader and maintainer set. Each page is
current only with its stable-release or pinned-source evidence, operational trigger, and repository
checks.

| Priority | Page | Mode | Primary audience | Status |
| --- | --- | --- | --- | --- |
| P1 | [Assigned work lifecycle](../guides/assigned-work-lifecycle.md) | How-to | Active user and agent | current |
| P1 | [Artifacts and byte channels](../guides/artifacts-and-byte-channels.md) | How-to | Operator and integrator | current |
| P1 | [CLI commands](../reference/cli-commands.md) | Generated plus authored reference | Active user and integrator | current |
| P1 | [CLI errors and exit codes](../reference/cli-errors-and-exit-codes.md) | Reference | Agent and integrator | current |
| P1 | [Contributor quickstart](../contributing/quickstart.md) | How-to | Contributor | current |
| P1 | [Create a bundle View](../guides/create-a-bundle-view.md) | How-to | Bundle author | current |
| P1 | [Security and trust boundaries](../reference/security-and-trust-boundaries.md) | Reference | Operator and integrator | current |
| P1 | [Evolve installed recipes](../guides/evolve-installed-recipes.md) | How-to | Bundle maintainer | current |
| P1 | [Query, links, and backlinks](../guides/query-links-and-backlinks.md) | How-to | Active user and View author | current |
| P2 | [Wire protocol and reference server](../reference/wire-protocol-and-reference-server.md) | Reference | Integrator | current |
| P2 | Bundle engine and storage seam | Explanation | Contributor and integrator | current |
| P2 | [Research claims and evidence](../examples/claims-and-evidence.md) | Tutorial | Researcher and analyst | current |
| P2 | [Publication snapshot API](../reference/publication-snapshot-api.md) | Reference | Publisher and integrator | current |

# Next coverage

## Core concepts

- Kinds and validation.
- Recipes as reusable domain structure.
- Relationships and derived backlinks.
- Registered and transient Views.
- Local authority, trust, and human approval.
- Publication snapshots and public bundles.

## Guides

- Extend coordination beyond the current assigned-Task lifecycle when another repeated model proves
  necessary.
- Add a unified symptom-first recovery guide spanning conflicts, stale state, interrupted setup, and
  moved bundles.
- Evolve the privacy and bundle-boundary guide with multi-bundle workflows after stable product
  support expands.

## Integrations

- Codex.
- Claude Code and Claude Desktop.
- OpenCode.
- Cursor and other compatible hosts after live validation.
- Windows, macOS, and Linux compatibility.

## Examples

- Release knowledge and checks.
- Interview needs and insights.
- A domain model that does not use tasks.
- A public bundle and evolving human View.

## Reference

- [Configuration and bundle resolution](../reference/configuration-and-bundle-resolution.md).
- [OKF compatibility](../reference/okf-compatibility.md).
- [Kind conventions and recipes](../reference/kind-conventions-and-recipes.md).
- [View contract and access](../reference/view-contract-and-access.md).
- Public schemas and compatibility policy after their stable consumer contracts settle.

## Releases and migrations

- Expand release history only through immutable verified Release records and the generated archive.
- Compatibility and deprecation policy.
- Legacy AgentState and pre-0.2 bundle migration.

# Architecture coverage map

Architecture pages answer stable system questions and omit exhaustive package-tree detail. Every
page pins the reviewed source identity, cites governing entry points, states critical constraints
and honest failure behavior, provides a nonvisual equivalent for each diagram, and declares the
source-path change triggers in an operational `Documentation Trigger` record.

| Priority | Page and question | Scope | Visual | Status |
| --- | --- | --- | --- | --- |
| P0 | System context: how do humans, agents, the local product, bundles, distribution, and public publication fit together? | Outside-in product scope | System-context flow | current |
| P0 | Document mutation lifecycle: how does a read and optimistic update become persisted state, and when is it separately published through Git? | CLI, core mutation policy, storage seam, local/remote CAS, honest history, optional board sync | Mutation and optional-publication flow | current |
| P1 | [Architecture at a glance](../architecture/architecture-at-a-glance.md): what are the package layers, runtime surfaces, and supported public entry points? | Package roles, composition root, distribution and stable entry-point contracts | Conceptual layered flow with manifest evidence | current |
| P1 | [View lifecycle and trust](../architecture/view-lifecycle-and-trust.md): how do registered/transient Views safely execute across local UI and MCP? | Registration, exact-byte admission, approval, sandbox, bounded bridge, revocation | Admission, capability, confirmation, and revocation flow | current |
| P1 | [Sharing, synchronization, and freshness](../architecture/sharing-synchronization-and-freshness.md): how do local-only, in-tree, and board-channel bundles converge? | Channel states, opportunistic read freshness, sync, conflict export, awareness | State diagram | current |
| P1 | [Public publication](../architecture/public-publication-boundary.md): how does a changing bundle become an immutable, admitted site artifact? | Capture, snapshot, admission, Portal artifact, verified host | Capture-to-site pipeline | current |
| P2 | [Bundle engine and storage seam](../architecture/bundle-engine-and-storage-seam.md): which semantics belong to core and which capabilities belong to backends? | OKF engine, StorageBackend, filesystem, memory, remote, wire router | Component diagram | current |

The first mutation slice deliberately distinguishes document persistence, backend history, board
awareness, and Git publication. Those are related but separate authorities and transaction domains.
Distribution and private-state facts remain part of architecture-at-a-glance until reader evidence
justifies another page.

# Page brief template

Before drafting a planned page, record:

1. Working title and primary content mode.
2. Audience, user question, and observable successful outcome.
3. Scope, prerequisites, and deliberate exclusions.
4. Governing public sources and exact identities.
5. Material claims or command sequences that require verification.
6. Related pages and relevant View or diagram.
7. An operational `Documentation Trigger` record with source paths or named product events.
8. The journey test that will determine whether the page works.
9. How readers can report a failure or missing case after publication.

The brief may live in a pull-request description while the initial slice is small. Promote briefs to
bundle documents only if coordination or safe resume repeatedly needs them.

# Delivery sequence

1. Finalize this operating model, navigation contract, and representative page list.
2. Author the install/setup and first-workspace tutorial as the first complete reader journey.
3. Add the core mental-model explanation and CLI reference needed by that journey.
4. Build the documentation client's navigation and page components against those real pages over
   Portal's headless presentation contract.
5. Run novice task testing and revise the contract before parallel authoring.
6. Assign independent bounded page sets to content agents.
7. Promote structured Source fields and drift automation only after the first real update
   demonstrates the required granularity; do not add a second manifest authority.

# Readiness gates

The representative slice is ready to expand when:

- all P0 pages needed for install through first durable result are current;
- every material behavior claim identifies exact public evidence;
- a novice can complete the install and first-workspace journeys without private assistance;
- navigation works on desktop and mobile and the complete bundle remains inspectable;
- code blocks, tables, callouts, diagrams, and registered Views have accessible presentations;
- reference version labels agree with the installed package under test;
- the full repository check plus Portal and strict offline MkDocs builds pass from the same owned
  documentation projection;
- one real product change has exercised the page-update workflow without broad unnecessary churn.

[documentation operating model](../design/docs-operating-model.md)

[site experience contract](../design/site-experience-contract.md)

# 0.4.0 coverage audit

Branch `docs/prepare-0.4.0` delivered the coupled release update. The proximate goal is to explain the
verified stable changes while preserving user-owned bundles and trustworthy package identities.
[The release archive](../releases/release-notes.md) preserves the immutable release/evidence
records for that delivery, including its package handoff, changes, and acceptance limits. Stable records, archive, release label, runtime pin, and generated CLI inventory are
reconciled through the owning conductor. Architecture source and admitted diagrams retain their
independent scope. The existing tooling task and PR remain separately owned.

The complete stable tree-delta and release-event query selects 43 maintained pages: 32 updated and
11 retained with a recorded reason in the frozen conductor review.

| Page set | Audience / mode / outcome | Stable disposition |
| --- | --- | --- |
| Install, verify host setup, migration, platform support, CLI overview, setup recovery | New or existing user / tutorial, how-to, reference / install the intended verified package | Explicit stable installation, paging/platform/migration and acceptance limits. |
| Hosted checkout, transfer, access, recovery | Operator and agent / how-to and reference / change admitted state and recover transfers | Model and root permissions, write bounds, canonical sync bytes, staged/paged transfer and explicit host selection; production acceptance untested. |
| First workspace, configuration, Git sharing | User and operator / tutorial and reference / create the intended target and recover sharing | Plain Git init selection, malformed-document publication holds, preserved history and YAML recovery; publication consent retained. |
| Reusable structure, modeling, recipe evolution, Kind reference | Bundle author / explanation and how-to / evolve an admitted model | Convention-only person-scoped hosted model capability and incompatible-instance recovery. |
| Byte channels, query/links, View reference/authoring, errors, wire | Agent and integrator / reference and how-to / page safely and negotiate capabilities | Page termination/version/channel contract, newest ordering, local View refresh and malformed-list semantics. |
| Current/archive and generated CLI commands | Existing user / reference / identify the stable release | Generated from verified stable package/source and immutable release history through the conductor. |
| Architecture and contributor references | Technical reader / explanation and how-to / locate governing contracts | Independent source and diagrams retained; interface changes route through maintained guides/references. |
| What Superbee is, bundles/documents, start here, context, assigned work, claims example, privacy, publication snapshot, OKF, show documents/Views | User or integrator / explanation, tutorial, reference / preserve existing local journeys | Retained contracts; changed hosted/paging/runtime surfaces covered in the coupled guides and references. |

Installed stable-package probes verify clean identity, Unicode paging and absent-next termination,
changed-page refusal, complete byte export, malformed listing and Git init. Hosted/live integration
acceptance remains limited to fixed source/tests as recorded in evidence. Publication uses the
existing repository workflow after exact-SHA review and required checks.

# Current 0.4.1 release coverage

Branch `docs/prepare-0.4.1` owns this bounded patch documentation update. Its proximate goal is to
help new hosted users and agents choose the intended host, recognize sign-in state, recover a
private-state permission refusal, and understand the limits of same-page Markdown links.
The completed 0.4.0 documentation remains historical. The existing finalization-tooling proposal
is separately owned and unchanged.

[Current package evidence](../sources/current-release.md) and
[the current source review](../sources/next-release.md) bind the published package and released
tree comparison. The owning conductor reconciles immutable history, current/archive records,
release label, runtime pin, and generated CLI help. The complete source/event review selects 26
pages: 11 update dispositions, including idempotent CLI-inventory regeneration, and 15 retained
with concrete reasons. The upgrade guide is additionally updated for the changed automation contract. Two existing renderer-page trigger
records now include the Markdown renderer's source and tests.

| Scope | Reader outcome / content mode | Disposition |
| --- | --- | --- |
| Installation, hosted checkout/access/recovery, CLI errors, setup recovery, upgrade | User or agent / tutorial, how-to, reference / select the intended service and recover the actual receipt | Explain first-run status, the two sign-in states, explicit-host exceptions and private-state permission remedy. |
| Document presentation and View contract reference | User or integrator / how-to, reference / understand fragment navigation and its limits | Document inert validated fragment metadata and the host adapter's heading check; no live rendering guarantee. |
| Current release, archive, generated CLI commands | Existing user / reference / identify the stable package and changed help | Reconcile through the existing conductor using published package/source identities. |
| Architecture, contributor, platform, OKF, local modeling, context, Git and transfer pages | Existing reader / existing content mode / retain verified unchanged journeys | Retain source and diagram pins, public-platform limits, explicit-host transfer examples and local contracts. Contributor quickstart stays outside the separately owned tooling proposal. |

Disposable macOS package probes verify first-run status, host-selection refusals, state-write
recovery and help. Waiting confirmation and renderer admission are source/test-grounded; live
OAuth, host restart, hosted writes/transfers and adapter activation are outside this acceptance.
Repository checks and independent exact-SHA review determine readiness for handoff. Publication
remains a separate authorized step through the existing workflow.

# First useful workspace and advanced progression

The first-workspace tutorial uses work-tracking because it is a built-in recipe: a fixed fictional
workshop brief becomes three related Tasks and a visible saved Plan, then supports a follow-up
ownership/dependency question. It demonstrates generic structured records, links, queries and human
inspection through one familiar example, with create-only rerun safety. It does not claim a live
board, automatic scheduling, collaboration, accuracy or token savings.

The advanced progression defines a domain's kinds and relationships, uses them in a bundle, then
packages stable definitions as a reusable recipe. The proposed bounded domain is a three-package
inventory from fictional manifests, with version/license snapshots and dependency relationships.
Existing modeling guidance supplies the supported lifecycle; the complete advanced tutorial is
separate scoped work. Use current release evidence and its actual package inventory for both.

[First durable workspace](../get-started/first-durable-workspace.md)

[Model recurring domain concepts](../guides/model-recurring-domain-concepts.md)

# October 13 OSS documentation review

The current installation and generated CLI reference use the current stable package. Architecture is grounded
in the stable 069a42092f39d8261ccd4322c0dc7ff5488aa2c8 tree. The first page leads with saved work,
a local first-workspace exercise, reusable structure, and Git collaboration.

Service onboarding pages are removed from navigation and reduced to scope signposts. Reader guides
no longer describe joining a hosted workspace. Immutable release history and the generated inventory
retain factual descriptions of interfaces shipped by the OSS package. A GitHub release for the current npm stable package
receipt remains unavailable; external finalization is not asserted.

# Consumer runtime update

The same review branch updates Portal and its Cloudflare adapter, Portal WebMCP, and Recipe Studio
to the released consumer versions recorded in [Portal package evidence](../sources/superbee-portal.md).
The existing Worker and public-bundle publication model remain the tested composition.
No additional remote agent endpoint is enabled by this consumer update.
