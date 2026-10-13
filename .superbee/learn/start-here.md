---
type: Guide
title: Every session starts further ahead
description: >-
  Keep what you learn, put it to work, and give your next agent session a useful
  starting point.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T13:02:26.979Z'
---
# Superbee in one minute

Superbee is an open-source tool that keeps what you and your agents learn in a local workspace you own. Decisions, evidence, and the
concepts your work uses become saved records that you can inspect and your next agent session can
find, reuse, and extend. Start with one useful result, then add structure as your work needs it.

# Choose your starting point

- **Try it with your agent:** [Install Superbee](../get-started/install-and-setup.md), then
  [turn a short brief into a useful workspace](../get-started/first-durable-workspace.md).
- **Understand how it works:** [Explore the core ideas](../concepts/what-superbee-is.md) and
  [choose the structure your work needs](../concepts/reusable-domain-structure.md).

# How it compounds

## 1. Model the domain

Start with the concepts, constraints, and language your work already uses. A research project might
have claims and evidence. A workshop might have tasks, owners, and dependencies. Capture a useful
decision or finding first; define recurring concepts when a consistent shape helps.

[Learn when reusable structure earns its place](../concepts/reusable-domain-structure.md).

## 2. Make it operative

Give recurring records a shared shape and connect them. Your agent can query the saved information,
follow relationships, and build a View that helps you inspect it. For a workshop, that might mean
seeing who owns the handout and which unfinished task it depends on.

[Model a recurring concept](../guides/model-recurring-domain-concepts.md) or
[show a document or View](../guides/show-documents-and-views.md).

## 3. Build together

People and agents work from the same evolving records. Save what changed, why it changed, and what
comes next. A later session can continue from that work; when a team needs shared access, choose
a Git-backed bundle with the intended sharing permissions.

[Preserve a session handoff](../guides/preserve-context-between-sessions.md) or
[choose how to share](../guides/choose-privacy-and-bundle-boundaries.md).

# See the value in one example

You ask your agent to prepare a community workshop. It saves the outline, handout, and rehearsal as
three related tasks, with owners and completion conditions, and shows you a plan.

In a later session, ask: **"What does the writer need before finishing the handout?"** The agent
can read the saved handout task and follow its dependency to the outline. You can inspect both
records and check the answer against the original brief. Update a record when the work changes.

[Try the complete workshop exercise](../get-started/first-durable-workspace.md).
The example uses fictional work. Saved records provide continuity; checking facts and keeping those
records current remain part of the work.

# Work by directing your agent

Describe the outcome in your own words:

> Save the decisions and evidence from this session, link them to the work they affect, and leave
> a short handoff so we can continue next time.

In Codex or Claude Code with the Superbee Skill installed, your agent translates that request
into operations and shows you the result. You choose the goal and who may see the workspace.
[Install and verify your host](../get-started/verify-host-setup.md) before relying on its integration.

Your workspace contains ordinary Markdown files and links. You can inspect it without Superbee;
Kinds add conventions, recipes reuse those conventions, and Views make saved information easier to
work with. [See how the pieces fit](../concepts/bundles-documents-and-relationships.md).

# Already using Superbee?

Find a command in the [CLI reference](../reference/cli-commands.md),
[recover a setup problem](../troubleshooting/setup-and-bundle-resolution.md), or
[upgrade an existing installation](../guides/migrate-or-upgrade-safely.md).
The [current release](../releases/current.md) records supported platforms and version-sensitive changes.
