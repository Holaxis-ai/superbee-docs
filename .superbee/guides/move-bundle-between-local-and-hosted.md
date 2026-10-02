---
type: Guide
title: Move a bundle between local and hosted
description: 'Preview hosted publication, adopt a moved checkout, or export a hosted bundle.'
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T20:45:21.323Z'
superbee_updated_by: 'process:release-docs-preparation'
---
# Release applicability

This page describes [the current stable CLI](../sources/current-release.md). Hosted availability depends on
the selected host's capabilities and your access. CLI support does not establish that a production
host offers every feature.

# Outcome and prerequisites

Move only when the person has chosen the destination and sharing boundary. You need the current stable CLI, the intended bundle path, and access to a compatible host. Keep a recoverable copy of local
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
The command signs in if needed, creates a hosted bundle in their workspace, and, within checkout limits, converts the
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

# Large-bundle transfer

The [current release](../releases/current.md) selects staged creation when publication exceeds
one request's bounds. Preview reports the transport, limits, blockers, destination, and the folder's
post-publication ownership. Staged creation admits at most 10,000 documents, 1,000 reserved files,
1,000 other files of 16 MiB each, and 64 MiB of current files. Optional history admits up to 5,000
versions and 64 MiB; the manifest is capped at 3 MiB. Documents must also satisfy the host's
advertised write bound. These are CLI protocol limits, not a promise of host availability.

Review the preview, then retry the same approved command and target after an interrupted or unknown
outcome. Progress is emitted on stderr (JSON lines with `--json`). Preserve the staged intent; do
not invent a new bundle ID as recovery. The preview and receipt state whether the folder converts to a checkout or remains local or Git.
If it remains local or Git, later edits there do not sync to the newly published hosted bundle.

On a paging-capable host, checkout follows heads/snapshot pages with a maximum of 10,000 documents
and any lower host limit. Export verifies each page and the complete chain before exposing the
finished local copy. A changed source restarts from the first page a bounded number of times;
`export_source_changed` requires retrying when the source settles. An older host's export can fall
back to its single-archive contract.

For a new hosted write with more than one stored or remembered host candidate, supply the intended `--host`.
`ambiguous_host` is a selection refusal; the last sign-in no longer chooses among those hosts.
A bound checkout retains its own host. Use release evidence for
fixed implementation and verification limits.
