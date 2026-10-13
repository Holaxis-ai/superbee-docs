---
type: Diagram
title: 'Sharing, synchronization, and freshness'
description: >-
  How Superbee classifies bundle channels, refreshes reads, converges shared
  changes, and preserves conflicting work.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T13:02:31.096Z'
---
# Question answered

How does Superbee select a sharing channel, refresh reads, and preserve work when writers conflict?

# Git channel ownership

| Channel | Delivery | Sync behavior |
| --- | --- | --- |
| Local-only | Local files | Plain sync does not infer publication consent. Establishment explicitly shares the chosen bundle. |
| In-tree | Bundle committed with code | Normal repository Git workflow owns delivery. Read-side awareness can compare its configured upstream; full bundle sync refuses code-branch publication. |
| Dedicated branch | Conventional `board` worktree or an admitted named standalone board | Sync commits bundle changes, converges with the matching upstream, preserves conflicts, and pushes a safe result. |

The [channel classifier](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/board-git/src/channel.ts#L1-L140) distinguishes these modes.
A named standalone branch `board-research` declares itself in `.superbee-board.json` and tracks
`origin/board-research`; it never substitutes for `origin/board`.

# Bounded freshness

A stale board read can attempt a short, fast-forward-only pull. Offline, dirty, busy, or diverged
state remains readable as last-known local content. Attempt throttling and observed freshness are
separate facts. The [opportunistic pull owner](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/board-git/src/autopull.ts#L1-L80)
defines the read-side behavior. In-tree awareness uses its configured tracking upstream and leaves
moving the code branch to normal Git.

# Full synchronization

The [sync orchestrator](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/cli/src/commands/sync/orchestrate.ts#L99-L220) provisions or
joins the selected board, commits saved edits, fetches and converges, preserves conflict copies,
and reports partial outcomes. The
[converging Git implementation](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/board-git/src/porcelain.ts#L1540-L1700) retains the
incoming document and exports the local conflicting bytes for a reviewed resolution.

Before a push that sends commits, an optional Git-configured check runs on the converged tree. A
failure, timeout, or board edit holds the push. A lost push race refetches, converges, checks, and
retries within a five-attempt bound. The
[sync check](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/cli/src/commands/sync/gate.ts#L1-L162) owns command execution and postconditions.
Pull-only sync and first establishment do not run it.

# Evidence

[pinned implementation source](../sources/superbee-codebase-main.md)

[Current package evidence](../sources/current-release.md).
