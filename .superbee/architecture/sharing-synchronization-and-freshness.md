---
type: Diagram
title: Sharing, synchronization, and freshness
description: >-
  How Superbee classifies bundle channels, refreshes reads, converges shared
  changes, and preserves conflicting work.
superbee_updated_by: openai/codex
---
# Question answered

How does Superbee know where a bundle is shared, make reads reasonably fresh, and converge changes
without hiding conflicts or publishing through the wrong Git channel?

Superbee classifies a bundle from repository evidence before it chooses a sharing behavior. A bundle
may be local-only, committed in the current code branch, or checked out from the dedicated `board`
branch. An unavailable remote probe can also leave classification indeterminate. That refusal is a
safety result: an inaccessible private remote never counts as proof that no shared board exists.

# Three durable channel modes

| Channel | Where changes live | How teammates receive them | What `superbee sync` does |
| --- | --- | --- | --- |
| `local-only` | A conventional bundle directory with no proven shared Git channel | They do not; the state remains local | Ordinary sync does not infer permission to publish. `sync --establish` explicitly creates the dedicated channel. |
| `in-tree` | The bundle is committed with code on the current branch | Normal repository commit, push, and pull | Full sync refuses because publishing the bundle would also publish the code branch. `sync --pull-only` refreshes awareness; `sync --establish` converts the arrangement. |
| `branch` | The bundle is a linked worktree on `board`, with `origin/board` as the explicit shared ref | Superbee's board sync flow | Sync commits bundle changes, fetches and converges incoming history, pushes when safe, and records awareness. |

The
[`BoardChannel` contract and decision matrix](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/channel.ts#L38-L69)
define these modes. The
[`remote evidence rules`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/channel.ts#L103-L135)
distinguish a successful absent result from an offline, timed-out, or unauthorized probe. The full
[`classification matrix`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/channel.ts#L197-L222)
also refuses a verified dual-board situation so a human can choose which location is authoritative.

# Freshness is bounded and observable

On a provisioned `branch` channel, board-reading commands consult a per-clone awareness cache. When
the cache is older than five minutes, the triggering read may perform one inline, two-second-budget,
fast-forward-only pull. A successful pull advances the cursor and rewrites the cache before the read
continues. An offline, dirty, busy, detached, or diverged checkout stays on its last known state and
the failed pull writes no newer cursor. This behavior keeps reads available while preserving an
honest boundary around what was actually fetched. The
[`opportunistic pull contract`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/autopull.ts#L1-L67)
and
[`pull-and-record transaction`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/autopull.ts#L149-L203)
govern this path.

An `in-tree` bundle uses its current branch's configured tracking upstream as the comparison basis.
Superbee fetches that exact upstream, counts bundle-touching commits in both directions, and records a
mode-scoped cursor and delta. Delivery still happens through the user's normal `git pull`; Superbee
does not move the code branch. Detached HEAD, missing tracking configuration, or an unusable ref
produces an explicit no-comparison-basis result rather than a guessed `origin/<branch>`. See the
[`in-tree read-side boundary`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/intree.ts#L1-L31)
and
[`fetch-and-record step`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/intree.ts#L140-L247).

# Explicit synchronization and conflict recovery

For a `branch` channel, full sync runs a fixed sequence: provision or join the linked worktree,
capture a baseline, commit local bundle changes, fetch and rebase onto `origin/board`, calculate the
incoming and since-last-read deltas, push, then write the receipt and awareness state. The CLI
[`orchestration sequence`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/cli/src/commands/sync/orchestrate.ts#L679-L702)
keeps these phases in one order. `sync --pull-only` uses a fast-forward merge and never commits,
rebases, or pushes.

When the full-sync rebase finds the same path changed on both sides, Superbee keeps the fetched
teammate version, saves the local bytes outside the board worktree, and completes or aborts the
rebase cleanly. A parseable document also receives a body-only export that can be supplied to
`doc update --body-file` after the user reconciles the content. The conflicted run skips its push and
returns a conflict receipt with the recovery path. The
[`converging rebase contract`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/porcelain.ts#L1547-L1578)
and
[`byte-preserving export sequence`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/board-git/src/porcelain.ts#L1620-L1687)
make local work recoverable. A later sync can commit the reconciled document and publish it.

# Diagram and nonvisual equivalent

The diagram summarizes the channel decision, freshness path, and explicit convergence path. Its
complete nonvisual equivalent is:

1. Inspect local worktree, tracked-folder, local-branch, and remote-ref evidence.
2. Classify the bundle as `local-only`, `in-tree`, or `branch`; refuse a mode-sensitive operation if
   the available evidence is indeterminate or proves two competing locations.
3. Keep local-only state local until an explicit establishment request.
4. For in-tree state, fetch only the configured tracking upstream, record awareness, and leave
   delivery and publication to the repository's normal Git workflow.
5. For branch state, a stale read may run a bounded fast-forward-only pull; failure preserves the
   last known state and does not advance freshness metadata.
6. A full sync commits local bundle changes, fetches and converges remote history, exports local
   conflicting bytes when needed, pushes only a conflict-free result, and records the resulting
   awareness state.

# Trust and failure boundaries

- Channel detection is evidence-based and read-only. Establishment is the explicit publication
  boundary.
- Opportunistic freshness is best-effort. A successful read means the selected local state was
  readable; it does not prove the remote was reachable during that command.
- Awareness is per clone and mode-scoped. It reports what that clone has observed since its cursor;
  it is not a global event ledger.
- Fast-forward-only refresh never reconciles divergence. Full sync owns rebase and conflict export.
- A successful local commit followed by an authentication or network failure remains saved locally.
  Retrying sync is the publication path.
- This page covers Git-backed sharing of a local bundle. Remote HTTP storage, public site
  publication, package release distribution, and arbitrary code-branch Git policy are outside its
  scope.

For the local document transaction before sharing, see the
[document mutation lifecycle](document-mutation-lifecycle.md). For package and runtime boundaries,
see [architecture at a glance](architecture-at-a-glance.md).

# Evidence

[pinned implementation source](../sources/superbee-codebase-main.md)
