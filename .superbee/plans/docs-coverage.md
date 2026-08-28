---
type: Plan
title: Documentation coverage and delivery
description: >-
  Ordered page coverage, representative slice, and readiness gates for the
  public documentation.
superbee_updated_by: openai/codex
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
| P0 | Start here | Structural navigation | Evaluator and first-time user | current | Product statement; expansion remains planned in this slice |
| P0 | What Superbee is | Explanation | Evaluator | planned | Product source, current Skill, representative bundles |
| P0 | Install and set up Superbee | Tutorial | First-time user | planned | Packed package, CLI help, installed-host probes |
| P0 | Create your first durable workspace | Tutorial | First-time user | planned | Bundle resolution, init, home, document/open behavior |
| P0 | Bundles, documents, and relationships | Explanation | New and active user | planned | OKF semantics and core tests |
| P0 | Preserve context between sessions | How-to | Active user | planned | Context-note recipe and session behavior |
| P0 | Understand reusable domain structure | Explanation | Active user and agent | planned | Kinds, recipes, validation, and current Skill |
| P0 | Model recurring domain concepts | How-to | Active user and agent | planned | Kinds, recipes, validation, and current Skill |
| P0 | Show documents and Views to a human | How-to | Active user and agent | planned | CLI open, MCP Apps, View runtime, host probes |
| P0 | CLI reference | Reference | Active user and integrator | planned | Generated help and installed package |
| P0 | Troubleshoot setup and bundle resolution | How-to | First-time user and integrator | planned | Setup conductor, resolution tests, known failures |
| P0 | Current release | Reference | Existing user | planned | npm/GitHub release receipts |
| P0 | Migrate or upgrade safely | How-to | Existing user | planned | Release receipts and migration probes |
| P0 | System context | Explanation | All technical readers | current | Pinned Superbee and Portal source; Diagram is its visual representation |

# Next coverage

## Get started

- Join an existing shared bundle safely.
- Understand what setup installs in each supported host.
- Verify that Skill, hook, MCP, and CLI surfaces are working.
- Choose privacy and sharing boundaries before creating durable structure.

## Core concepts

- Kinds and validation.
- Recipes as reusable domain structure.
- Relationships and derived backlinks.
- Registered and transient Views.
- Local authority, trust, and human approval.
- Publication snapshots and public bundles.

## Guides

- Evolve a bundle as the user's domain changes.
- Coordinate several agents or humans through shared structure.
- Share and synchronize a Git-backed bundle.
- Create a useful human representation instead of returning raw Markdown paths.
- Recover from conflicts, stale state, interrupted setup, or a moved bundle.
- Maintain multiple bundles for distinct purposes.

## Integrations

- Codex.
- Claude Code and Claude Desktop.
- OpenCode.
- Cursor and other compatible hosts after live validation.
- Windows, macOS, and Linux compatibility.

## Examples

- Research claims and evidence.
- Release knowledge and checks.
- Interview needs and insights.
- A domain model that does not use tasks.
- A public bundle and evolving human View.

## Reference

- Command groups and exact help.
- Configuration and bundle resolution.
- OKF compatibility.
- Kind convention and recipe formats.
- View contract, access levels, and actions.
- Host support matrix.
- Exit codes and structured errors.
- Security, trust, and local state boundaries.

## Releases and migrations

- Verified release index.
- Version-specific release notes.
- Compatibility and deprecation policy.
- Legacy AgentState and pre-0.2 bundle migration.

# Page brief template

Before drafting a planned page, record:

1. Working title and primary content mode.
2. Audience, user question, and observable successful outcome.
3. Scope, prerequisites, and deliberate exclusions.
4. Governing public sources and exact identities.
5. Material claims or command sequences that require verification.
6. Related pages and relevant View or diagram.
7. Change triggers.
8. The journey test that will determine whether the page works.
9. How readers can report a failure or missing case after publication.

The brief may live in a pull-request description while the initial slice is small. Promote briefs to
bundle documents only if coordination or safe resume repeatedly needs them.

# Delivery sequence

1. Finalize this operating model, navigation contract, and representative page list.
2. Author the install/setup and first-workspace tutorial as the first complete reader journey.
3. Add the core mental-model explanation and CLI reference needed by that journey.
4. Build the Portal navigation and page components against those real pages.
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
- the full repository check and Portal build pass;
- one real product change has exercised the page-update workflow without broad unnecessary churn.

[documentation operating model](../design/docs-operating-model.md)

[site experience contract](../design/site-experience-contract.md)
