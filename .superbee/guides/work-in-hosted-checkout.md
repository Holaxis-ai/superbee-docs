---
type: Guide
title: Work in a hosted checkout
description: >-
  Sign in, select a hosted bundle, edit its local working copy, and reconcile
  conflicts.
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T19:52:26.688Z'
superbee_updated_by: 'process:release-docs-preparation'
---
# Release applicability

This page describes [the current stable CLI](../sources/current-release.md). Hosted availability depends on
the selected host's capabilities and your access. CLI support does not establish that a production
host offers every feature.

# Outcome

Work on a hosted bundle through a local folder while the host remains authoritative. Edits stay in
the folder until sync sends them under the signed-in person's access. Use this guide as an agent
or practitioner with the current stable CLI on macOS or Linux and access to a compatible hosted service.

# 1. Sign in and select a workspace

Ask the person which host to use, then run:

```sh
superbee setup hosted --url <hosted-url>
```

This explicit command signs in and records the default hosted workspace. Bare `superbee setup`
continues to inspect AI host integrations read-only. When a hosted command returns `AUTH_REQUIRED`
(exit 4), relay `details.sign_in_url` and `details.user_code` exactly, wait for the person to confirm
in their browser, and retry the command named by `details.resume`. Never request passwords or
credentials from the person. If the receipt says `choose_workspace`, ask which listed workspace
is intended and run its returned command. `no_workspace` requires an invitation or workspace
creation in the Superbee app.

Inspect the remembered session and discover accessible bundles:

```sh
superbee whoami
superbee catalog list --hosted
```

`whoami` describes local session state and unverified token claims, never a token. The host confirms
identity on hosted commands. `catalog list --hosted` reads live across accessible workspaces;
`catalog list --local` lists only local registrations without a hosted read. Plain catalog listing
also reports reachable hosted bundles that have no folder here and never starts sign-in.

# 2. Check out one returned reference

Use the exact `reference` returned by catalog:

```sh
superbee checkout <reference> --dir <new-folder>
superbee home --dir <new-folder>
superbee status --dir <new-folder>
```

A reference can be `<workspace>/<bundle-id>` when an ID exists in several workspaces. Ask which
workspace is intended; checkout refuses ambiguity. If catalog already supplies a `folder`, work
there with `--dir` instead of creating a duplicate. Checkout registers the folder in the private
catalog and binds its host, workspace, and bundle in private state. Ordinary commands then operate
on that folder, including unsent edits.

# 3. Edit, then sync one batch

Use `doc read`, `doc update`, `doc write`, and `list` on the folder as for a local bundle. Observe
versions from the folder for compare-and-swap. Run:

```sh
superbee sync --dir <folder>
```

Sync pulls before sending. Different documents can converge independently. A concurrent change
to the same document conflicts even when writers edited different fields. Rows are `committed`,
`conflict`, `held`, `refused`, `unknown`, or `paused`; exit 0 requires every row to be committed.
Read-only host capabilities or withdrawn access can preserve local edits without sending them.
Inspect the receipt rather than assuming every local file reached the host.

`list`, `doc read`, `status`, `home`, `link show`, and `view list` pull before reading when the
previous pull is over five minutes old. They wait at most two seconds, send no edits, and never
start sign-in. A pull older than thirty minutes produces a warning. Explicit sync owns sign-in and
freshness recovery. `SUPERBEE_NO_AUTOPULL` disables these read-side pulls when set.

# 4. Inspect and resolve a conflict

```sh
superbee sync --dir <folder> --inspect --doc <id>
superbee sync --dir <folder> --resolve take --doc <id>
# Or, after reviewing the inspected versions:
superbee sync --dir <folder> --resolve keep --doc <id>
# Or edit the file to the intended result, then:
superbee sync --dir <folder> --resolve revise --doc <id>
superbee sync --dir <folder>
```

Choose one resolution. `take` adopts the host version; `keep` retains the conflicted local version;
`revise` uses the file as edited now. Resolve records a decision with `sent: false`; a later sync
sends a keep or revise decision. Both require inspection and refuse `stale_review` when the host
has changed again. `file_edited` means keep no longer describes the file; inspect and use revise.
An unsent keep or revise is not replaced by repeating it. Take can replace an unsent decision,
but `resolution_not_replaceable` requires sync to settle a possibly sent write first.

When the host deleted a document, inspect that deletion before deciding whether to recreate it.
When you deleted a document the host changed, take restores the host's version and keep sends the
reviewed deletion. Ask the person when intent is unclear.

# 5. Handle held deletions with the person

Deleting a file or using `doc delete` queues a versioned delete for the next sync. A burst is held
when deletes over the last day exceed half the checkout and number at least three (or include every document of a smaller checkout). The calculation
also checks documents this checkout did not create, preventing new documents from diluting it.
The host can independently return `428 deletions_held` for its bundle-wide policy; CLI support
for that response does not establish that every host implements it.

A hold persists across ordinary syncs. Show the person the IDs in `deletions_held`. If they intend
to remove them, give them `confirmation_required.command_for_person` to run in their own terminal:

```sh
superbee sync --dir <folder> --accept-deletes <count>:<digest>
```

The person must type the count. Agents must not execute this command or simulate a person's
terminal. The token names exactly the held set; a changed set invalidates it. The interactive
check keeps the person involved and is not an authorization boundary. If deletion is unwanted:

```sh
superbee sync --dir <folder> --restore-deletes
```

Take can restore one document. When a pull unexpectedly omits at least eight documents and over
half the folder, or all documents, it removes none and reports `pulled.refused_deletions`. Confirm
in the Superbee app that the bundle really shrank before running the receipt's
`--take-host-deletions <count>:<digest>` command. It removes only that reviewed set and preserves
edited files; it sends nothing to the host.

# What cannot be edited in a checkout

Kinds and recipes are designed in a local or Git bundle before publication. Definition changes
are refused in this release; a generic operation is not a bypass. Artifact and blob
writes, verification, and View saves require the supported owning interface, usually the Superbee
app. Renames, retypes, unsupported metadata changes, and size-limit failures must be handled from
the returned refusal. Never bypass a refusal by editing reserved files or copying the folder.

The local MCP app serves a cataloged checkout through its folder. Supported document changes land
there and reach the host at the next sync. Work through that folder when it exists instead of
writing to the same bundle concurrently through the hosted connector.

# History, optional hooks, and next steps

`doc history <id>` reads the host's sent history. `--seq <n>` retrieves one host version; a newly
created local document gains host history after sync. Use the folder's `doc read` version for
local compare-and-swap.

With the person's agreement, `hook install --turn-end-sync` adds turn-end sync for Claude Code
and Codex. Git boards additionally require `--git-boards`. The hook reports a conflict, hold, or
sign-in condition once; it does not silently resolve it. `hook uninstall --turn-end-sync` removes
it, and `SUPERBEE_NO_TURN_SYNC` disables it in a shell. `SUPERBEE_VIA` supplies unverified agent
attribution (1 to 32 lowercase letters, numbers, dots, underscores, or dashes, not beginning with
`superbee`); `SUPERBEE_NO_VIA` suppresses it. Attribution never grants access.

Continue with [hosted access and operations](../reference/hosted-cli-access.md),
[move a bundle between local and hosted](move-bundle-between-local-and-hosted.md), or
[hosted recovery](../troubleshooting/hosted-checkout.md).

# Prepared hosted editing changes

The [prepared release](../releases/next-release.md) extends the stable rules above only when the
chosen host advertises the relevant capability and permits the signed-in person:

- `kind`, `recipe add`, and `recipe evolve` can change Kind conventions when
  `definition_writes: "allowed"` is recorded from the host. Recipes must install only conventions;
  recipes with Views or References are refused before writing. A `definition_incompatible` reply
  names documents that do not satisfy the proposed model. Fix those instances before syncing the
  model again. `"refused"` means the person lacks model-edit permission; an absent capability
  retains the older refusal. Request the needed bundle permission rather than assuming an admin
  role.
- The root `index.md` can be edited and synced as a front page when the host allows root writes.
  Inspect a conflict with `sync --inspect --doc index.md`; take adopts the host file, while keep or
  revise records a decision that a later sync sends. Keep/revise require inspection. The host
  refuses changes to `okf_version`. Subdirectory `index.md` and every `log.md` remain reserved.
- Sync holds a document exceeding the host's advertised request-size bound as `too_large`.
  JSON escaping and frontmatter count toward that bound. Preserve the edit, split it with the
  person's agreement, or use a host with a sufficient limit. Never silently shorten content.
- A committed send adopts the host's canonical returned bytes. Future local compare-and-swap
  uses the version from a new folder read. Preserved local edits and a `committed` host write are
  separate facts; inspect the receipt for refused or held rows.

Root files over 64 KiB as a request, invalid UTF-8 or a byte-order mark, symbolic links, and unsafe
paths are held. Artifact/blob mutation, verification and View saves retain their refusal. The local
MCP interface still refuses convention writes even when CLI Kind commands are allowed.
The [preparation evidence](../sources/next-release.md) bounds these source-grounded claims;
production hosted acceptance was not executed here.
