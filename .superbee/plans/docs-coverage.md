---
type: Plan
title: Documentation coverage and delivery
description: >-
  Ordered page coverage, representative slice, and readiness gates for the
  public documentation.
superbee_updated_by: 'process:release-docs-preparation'
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T20:07:58.790Z'
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

# Current stable release coverage

The `codex/docs-0.3.0-draft` branch covers the coupled release-facing page set below.
[Current release evidence](../sources/current-release.md) owns package verification and bounds
the stable implementation claims.
Production hosted acceptance and native Windows execution remain untested.

| Page set | Mode / audience / successful outcome | Disposition and governing evidence |
| --- | --- | --- |
| Hosted checkout, transfer, access reference, and recovery | How-to / practitioner and agent / select, edit, reconcile, transfer the intended hosted bundle | New authored procedures and trigger from fixed checkout, auth, operation, sync, publish/export source; installed-package journeys are recorded in release evidence; production host acceptance is untested. |
| Install, host support, verify host setup, upgrade, setup troubleshooting | Tutorial or how-to / new and existing user / use supported CLI and reconnect integrations | Installation and platform change sections plus hosted setup routing; verify-host procedure unchanged except optional hook capability, which is covered by host support. Native Windows support removal is fixed source evidence. |
| CLI overview, inventory, configuration, errors | Reference / agent and integrator / select the right command and recover from receipts | Updated command ownership, selection, and errors; inventory generated from the verified installed package. |
| Kinds, reusable structure, modeling, recipe evolution | Explanation or how-to / bundle author / preserve the model and guide reading order | Numeric Convention order and hosted definition refusal documented. Later hosted-definition writes excluded. |
| View contract, View authoring, query/links, trust | Reference or how-to / View author and operator / discover capabilities and confirm bounded changes | Local body/atomic proposal support, MCP scalar-only scope, graph bounds and absent OSS model projection documented from pinned protocol and tests. Live production host acceptance is untested. |
| Git sharing and privacy boundaries | How-to / practitioner / resolve saved conflicts without restoring lost ownership or confusing hosted policy | Recorded inspect/resolve decisions and explicit transfer boundary documented. Remote access principles unchanged. |
| Wire contract | Reference / integrator / reconcile complete reads and ambiguous document writes | Heads/snapshot/identified outcomes and retention limits documented. Server remains unauthenticated by default. |
| Contributor quickstart | How-to / contributor / find the governing release workflow | Release source instruction links added; no current-main feature inference. |
| Architecture at a glance, system context, document mutation, public publication | Explanation / technical reader / understand the independently pinned architecture | No change to the separately pinned source or admitted diagrams. Release interface changes route through authored references; architecture refresh remains independently reviewed. |
| Bundle engine, View lifecycle, sync/freshness architecture | Explanation / integrator / locate changed contracts | Added release-facing change notes; main narrative and diagrams retain their stated source scope. |
| What Superbee is, bundles/documents, start here, first workspace, context, assigned work, claims example | Explanation or tutorial / new and active user / preserve or model local work | No change: source delta retains these local journeys and actor/model examples; new hosted workflow is independently linked through navigation and CLI reference. Representative local journeys use the published package. |
| Artifacts and publication snapshot API, OKF compatibility, show documents/Views | How-to or reference / operator / preserve byte channels and use supported presentation | No change to the documented local/versioned contract; checkout refusals and View proposal extension are documented in the new hosted and View references. The installed package and documentation rendering are checked separately from production host acceptance. |
| Current release and archive | Reference / existing user / know actual stable identity and recovery | Promoted by the release conductor from verified registry, tag, and packed identity; immutable release history retained. |

The release conductor records every affected-page disposition against its captured registry and
source packet. The tree-delta review retains the independently pinned architecture diagrams.

# Stable preparation from the documented release

Branch `docs/prepare-0.4.0` owns the coupled preparation pages. The proximate goal is to explain
verified changes from the documented stable source to the published prerelease while preserving
user-owned bundles and trustworthy release identities. [Preparation evidence](../sources/next-release.md)
owns the fixed source comparison. Current stable records, site version label, dependency pins,
generated CLI inventory, archive, and independently pinned architecture/diagrams are retained
pending stable package verification.

The complete tree-delta plus release-event query selects 43 maintained pages. Dispositions:

| Page set | Audience / mode / outcome | Preparation disposition |
| --- | --- | --- |
| Install, verify host setup, migration, platform support, CLI overview, setup recovery | New or existing user / tutorial, how-to, reference / install the intended verified package | Correct moving-tag assumptions, retain stable identity, add prepared paging/platform/migration limits. |
| Hosted checkout, transfer, access, recovery | Operator and agent / how-to and reference / change only admitted state and recover transfers | Explain model and root permissions, write bounds, canonical sync bytes, staged/paged transfers and explicit host selection. Production hosted acceptance is untested. |
| First workspace, configuration, Git sharing | User and operator / tutorial and reference / create the intended local target before sharing | Explain plain Git init selection and malformed-document publication holds with non-destructive YAML recovery; explicit local-first tutorial and publication consent remain valid. |
| Reusable structure, modeling, recipe evolution, Kind reference | Bundle author / explanation and how-to / evolve an admitted hosted model | Add convention-only, person-scoped capability and incompatible-instance recovery. |
| Byte channels, query/links, View reference/authoring, errors, wire | Agent and integrator / reference and how-to / page safely and negotiate capabilities | Add page termination/version/channel contract, newest query ordering, local View refresh behavior, and malformed-list semantics. |
| Stable current/archive and generated CLI commands | Existing user / reference / discover verified identity | No promotion: actual stable release/package evidence is required before conductor finalization. |
| Architecture at a glance, system context, mutation, bundle engine, View lifecycle, sync/freshness | Technical reader / explanation / understand the independently pinned source | No diagram or source-pin change; retain historical scope and route prepared interface differences to references. Stable release citations remain stable. |
| What Superbee is, bundles/documents, start here, context, assigned work, claims example, privacy, publication snapshot, OKF, show documents/Views, contributor quickstart | New user or integrator / explanation, tutorial, reference / retain working local journeys and boundaries | No behavioral rewrite: the reviewed delta preserves these documented local/OKF/byte/presentation contracts. Existing stable sections cite current stable evidence; prepared capabilities route through the updated guides. |

Installed prerelease probes verify clean identity, Unicode paging, absent-next termination,
stale-version refusal, complete byte export, malformed listing and Git init. Hosted execution and
live integration acceptance remain source/test-grounded limitations. After stable publication,
review any additional source delta, use the existing release conductor, regenerate stable references,
and run fresh checks before publication. No other active tooling task or PR is claimed here.
