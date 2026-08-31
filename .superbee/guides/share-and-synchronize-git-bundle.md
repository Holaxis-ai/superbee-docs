---
type: Guide
title: Share and synchronize a Git-backed bundle
description: >-
  Join, refresh, share, and recover a Git-backed Superbee bundle without
  crossing its publication boundary.
superbee_updated_by: openai/codex/root
---
# Outcome

Join a project that already shares a Superbee bundle, refresh incoming work without publishing
local changes, and use the correct sharing path for the bundle's Git mode.

This guide is for macOS, Linux, and Windows users of [the current stable release](../releases/current.md). It
is verified against the package identity in the current release evidence, source commit
`38e4bd1779a14c2518a7f3930ab2d9e26a76f889`, and the tagged synchronization and SessionStart tests
linked below. The stable package requires Node.js 20 or newer.

# Before you join

Start in the cloned project repository. Confirm that `origin` names the same repository where a
teammate shared the bundle:

```sh
git remote -v
```

You also need Git access to that remote. Keep any existing non-empty `.superbee/` or
`.agentstate-lite/` directory in place until you know what it contains. Superbee refuses to replace
an unrelated directory during provisioning.

Avoid `superbee init` when you expect a shared bundle. Initialization creates a new local bundle.
The join command discovers the existing shared channel and materializes the intended checkout.

# Ask an agent to assess sharing before it acts

In Codex or Claude Code with the Superbee Skill installed, ask an agent to inspect the repository,
selected bundle, and channel state; explain whether the next step only reads incoming changes or
can create, share, or publish bundle changes; then wait for your approval before taking the latter
action. The agent may use the supported commands in this guide, but it must honor the privacy
boundary and authority you set. In particular, a local bundle does not become shared merely because
an agent found it or knows how to run `sync --establish`. See [Install and set up
Superbee](../get-started/install-and-setup.md) for the Skill installation path.

# Join an existing dedicated board

From the project root, run the read-side form first:

```sh
superbee sync --pull-only
```

When `origin/board` exists, this command provisions the bundle checkout at `.superbee/` (or retains
an existing legacy `.agentstate-lite/` location), then fast-forwards it from the remote. The receipt
includes `provisioned: <path>` on first materialization. `--pull-only` skips local bundle commits,
rebases, and pushes.

Confirm that Superbee resolved the expected workspace:

```sh
superbee home --no-update-check
superbee status
```

Stop if `home` names an unexpected workspace. A remote failure with no fetched board evidence
leaves the shared-board state unknown. Retry `sync --pull-only` when the remote is reachable. Keep
the existing directory and avoid establishment while the state is unknown.

# Match the command to the channel

Superbee derives one of three Git channel modes from the repository and remote evidence.

| Mode | Where the bundle lives | Safe incoming path | How outgoing changes travel |
| --- | --- | --- | --- |
| `local-only` | A local bundle with no proven shared Git channel | No incoming channel exists | Changes stay on this machine until an authorized owner explicitly runs `superbee sync --establish`. |
| `in-tree` | `.superbee/` or `.agentstate-lite/` is committed on the current code branch, with no dedicated board branch | `superbee sync --pull-only` fetches and reports bundle changes from the branch's configured upstream; normal `git pull` delivers them | Normal repository commit and push carry bundle and code changes together. Full `superbee sync` refuses. |
| `branch` | The bundle is a linked worktree on the dedicated `board` branch | `superbee sync --pull-only` fast-forwards the local board | Full `superbee sync` commits pending bundle changes, reconciles incoming board history, and pushes a conflict-free result. |

Channel detection can return an indeterminate result when the remote is inaccessible or when the
available evidence cannot identify one safe channel. Resolve the reported Git or remote condition,
then retry. Treat an unknown state as unresolved sharing evidence.

Establishment is the publication boundary. Run `superbee sync --establish` only after the bundle
owner has decided to share a local bundle through this repository's `origin`. The command creates
and pushes the dedicated `board` branch. A plain `superbee sync` never establishes a previously
local-only bundle.

# Share changes on a dedicated board

Before a full sync, inspect the pending bundle files at the path reported by `home`:

```sh
git -C .superbee status --short
```

Use the legacy directory name in that command when `home` resolves `.agentstate-lite/`.

Run a full sync only when every pending bundle change is ready to share:

```sh
superbee sync
```

Full sync may create a local board commit, fetch and reconcile `origin/board`, and push the resulting
board history. Its receipt reports the work that committed, pulled, and pushed. A clean shared board
reports `sync: already up to date`.

For an in-tree bundle, use normal Git review, commit, pull, and push commands. `superbee sync
--pull-only` refreshes the comparison and reports bundle changes in the upstream branch while
leaving the working tree unchanged. Run `git pull` when you want Git to deliver those commits.

# Recover from a document conflict

A full dedicated-board sync can find one document changed on both sides. Superbee keeps the
teammate's fetched version in the board checkout, saves your complete bytes to the export path in
the receipt, and creates a body-only export when the document can be parsed and round-tripped. The
run exits with code 5 and skips its push.

Resolve each document deliberately:

1. View the teammate version retained as of the last fetch:

   ```sh
   superbee sync --show-incoming <id>
   ```

2. Compare it with the complete local export named in the conflict receipt. Create a merged body
   file that preserves the intended content from both versions. Review any frontmatter keys named
   as different in the receipt and include the intended field updates explicitly.

3. Apply the merged body to the retained document:

   ```sh
   superbee doc update <id> --body-file <merged-body-file>
   ```

   If the conflict receipt reports frontmatter differences, apply the intended `--title`, `--type`,
   or Kind-declared field flags in the same update. Use a complete read, edit, and promote loop when
   the intended frontmatter cannot be expressed by those patch flags.

4. Inspect the document, then share the resolved version:

   ```sh
   superbee doc read <id>
   superbee sync
   ```

`sync --show-incoming` reads the last-fetched upstream ref and performs no fetch. Use the receipt's
specific recovery for an upstream deletion, a reserved file, or content without a body-only export.
Keep the full byte export until the reconciliation has been verified and shared.

# Understand session awareness

Awareness belongs to one clone. `home` and `session-start` summarize observed document changes since
that clone's cursor, attribute rows when actor metadata exists, and report unpushed or uncommitted
local backstops. The summary orients this clone and provides no global audit log.

The managed SessionStart hook runs a best-effort pull within a seven-second budget, then renders
`home`. On a fresh clone it may provision the existing board checkout. On a provisioned dedicated
board it may fast-forward incoming history. For an in-tree bundle it fetches and reports the
configured upstream while leaving delivery to `git pull`. Offline, authentication, lock, and
timeout failures fall through to a last-known-state render with an honest note. SessionStart never
creates a bundle commit or pushes one.

The `list`, `doc read`, `status`, `home`, and `link show` commands may run a silent, two-second,
fast-forward-only refresh when a provisioned dedicated board's awareness state is more than about
five minutes old. That refresh can advance the local board checkout and its cursor and cache. It
never provisions, rebases, commits, or pushes. Disable this network attempt for a scripted run with:

```sh
SUPERBEE_NO_AUTOPULL=1 superbee list
```

# Honest recovery states

- `shared board state unknown` means the remote could not be verified. Keep local work in place and
  retry when access returns.
- A failed push after a successful local commit leaves the work committed on the local board. Restore
  network or credentials, inspect the receipt, and rerun `superbee sync`.
- A diverged `--pull-only` run performs no rebase. An authorized board writer can use full sync to
  reconcile. A read-only participant should coordinate with a writer.
- An in-tree branch with no configured upstream or a detached HEAD has no comparison basis. Check
  out the intended branch and configure its tracking upstream before retrying.
- A moved repository can leave linked-worktree pointers stale. A later sync can repair the pointers
  and reports `repaired: <path>` when it does so.
- A provisioning refusal preserves the existing bundle directory. Read the structured error, back
  up unfamiliar local content, confirm the intended repository, and follow the reported remedy.
- A SessionStart failure leaves the session usable. Run `superbee sync --pull-only` interactively
  for a complete error and recovery receipt.

For the channel model and freshness mechanics, see
[sharing, synchronization, and freshness](../architecture/sharing-synchronization-and-freshness.md).
For local document persistence before sharing, see
[the document mutation lifecycle](../architecture/document-mutation-lifecycle.md).

# Evidence

- [Current stable release evidence](../sources/current-release.md)
- [Tagged sync command implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/sync/orchestrate.ts)
- [Tagged channel classification](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/board-git/src/channel.ts)
- [Tagged SessionStart implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/session-start.ts)
- [Tagged opportunistic refresh implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/board-git/src/autopull.ts)
- [Join, provisioning, and full-sync tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/sync.test.ts)
- [Conflict recovery acceptance tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/sync-conflict.test.ts)
- [In-tree mode tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/sync-intree.test.ts)
- [SessionStart awareness and failure tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/session-start.test.ts)
- [Opportunistic refresh tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/autopull.test.ts)

# Journey check

Test this page with two disposable clones of one repository whose `origin/board` was established by
the first clone. From the second clone, `sync --pull-only` should provision the expected bundle and
publish nothing. A later attributed change from the first clone should appear in the second clone's
awareness after a pull. A deliberate same-document conflict should preserve the teammate version,
export the local version, and clear only after the documented inspect, merge, update, and sync
sequence.
