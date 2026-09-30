---
type: Guide
title: Move a bundle between local and hosted
description: 'Preview hosted publication, adopt a moved checkout, or export a hosted bundle.'
generated:
  by: 'process:release-docs-review'
  at: '2026-09-30T19:59:53.022Z'
superbee_updated_by: 'process:release-docs-review'
---
# Release applicability

This page describes [the current stable CLI](../sources/current-release.md). Hosted availability depends on
the selected host's capabilities and your access. CLI support does not establish that a production
host offers every feature.

# Outcome and prerequisites

Move only when the person has chosen the destination and sharing boundary. You need the current stable CLI
CLI, the intended bundle path, and access to a compatible host. Keep a recoverable copy of local
work. A migration changes how future synchronization travels; it does not prove teammates have
moved with you.

# Publish a local bundle or Git board

Preview first:

```sh
superbee publish --to hosted --dir <bundle> --host <url> --workspace <workspace>
```

Without `--yes`, the preview makes no network request. It names documents, reserved files and
other files that travel; dot-files and links that stay; validation failures; intended bundle ID;
and the host. Fix nonconforming documents and malformed Kinds before publishing. A Git board
behind upstream must be synced before publication.

Show the preview to the person. Once they agree, run the exact `--yes` command it supplies.
The command signs in if needed, creates a hosted bundle in their workspace, and converts the
folder into a checkout without rewriting its files. Only that person can reach the new bundle
until they share it. A Git board loses its local binding but its local and remote board branches
remain. Teammates continue using that board until they explicitly move to the hosted bundle.

`--with-history` imports Git versions as labeled, unverified history when the person requests it.
`TRANSIENT` with `write_outcome_unknown` means creation may be partial: retry the same command
so it can finish or confirm the same creation. Never guess a different bundle ID as recovery.

# Adopt a moved, copied, or restored checkout

The read-only `.superbee/checkout.json` marker names a host and bundle but never routes commands.
Private state binds the folder by path. `copy_of_checkout` with `home: local` means the folder
has lost that binding; sync and local MCP writes refuse it with `unbound_copy`.

```sh
superbee checkout --adopt <folder>
```

A same-disk move can be rebound offline with its unsent edits and conflicts. A copy or restore
only previews until the person confirms a host and you pass `--host <url>`. Do not trust the
marker's host by itself. Adoption never overwrites files: differences become conflicts, missing
documents are added, and `local_only` documents will be sent as new at sync. Review that list
with the person. A workspace collision requires `--workspace <id>` and proof that this folder
came from that workspace's bundle; `not_this_bundle` or `origin_unknown` requires a fresh
checkout of the intended reference instead.

To keep a copied folder local, the person can choose to remove its marker. `checkout --release
<folder>` forgets an existing checkout binding while retaining files; use export when a complete
portable copy is required.

# Export a complete local copy

```sh
superbee export <reference> --to <new-or-empty-folder>
```

Export carries the current revision of documents, reserved files, and blobs, with host digests
verified before files are written. It leaves the host unchanged and carries no history.
The destination appears complete or not at all. Retry the same command on `export_incomplete`.

To convert an existing checkout in place:

```sh
superbee export --dir <checkout> --in-place
```

It adds missing files, preserves differing local files in `kept_local`, and forgets the hosted
binding. `unsent_changes` requires sync first. Use `--keep-unsent` only after the person agrees
those edits will stay local and will never reach the host. An interrupted in-place export can
resume without the network.

`--git` creates a board branch. Sharing that result still requires the person to configure its
intended remote and authorize `sync --establish`. Export itself never establishes publication.

Verify the resulting target with `bundle locate`, `home`, and `status`. For a checkout, confirm
`home: hosted`; for an export, confirm local or Git ownership before continuing.

[Hosted checkout procedure](work-in-hosted-checkout.md)

[Choose privacy and bundle boundaries](choose-privacy-and-bundle-boundaries.md)
