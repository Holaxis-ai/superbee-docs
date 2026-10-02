---
type: Guide
title: Troubleshoot a hosted checkout
description: >-
  Recover sign-in, selection, held files, conflicts, and interrupted hosted
  transfers.
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T19:52:27.387Z'
superbee_updated_by: 'process:release-docs-preparation'
---
# Release applicability

This page describes [the current stable CLI](../sources/current-release.md). Hosted availability depends on
the selected host's capabilities and your access. CLI support does not establish that a production
host offers every feature.

# Collect the relevant receipts

Use `whoami`, `catalog list --hosted`, `bundle locate --dir <folder>`, `status --dir <folder>`,
and `sync --dir <folder>` for the selected checkout. Reads never establish another project's
context. Keep local edits until the receipt establishes their disposition.

| Receipt or symptom | Recovery |
| --- | --- |
| `AUTH_REQUIRED` / exit 4 | Relay the returned sign-in link and user code; wait for the person's browser confirmation, then repeat `details.resume`. |
| Missing published CLI client identity | Ask the host operator to provide supported CLI sign-in; do not invent credentials or client IDs. |
| `choose_workspace` / `no_workspace` | Ask the person which returned workspace to select, or have them obtain access in the app. |
| `ambiguous_bundle` | Choose the intended workspace. Use its catalog reference; an existing folder can be adopted with confirmed host/workspace only when origin proof succeeds. |
| `copy_of_checkout` / `unbound_copy` | Follow checkout adoption. A marker is only a note; never route from it without the person's confirmed host. |
| `conflict` / `not_inspected` / `stale_review` | Inspect base, local, and host versions, decide take/keep/revise, then sync. Reinspect when the host changes. |
| `file_edited` | Review the current file and use revise instead of replaying keep for an earlier file. |
| `resolution_not_replaceable` | Sync to settle the possibly sent decision before deciding whether to discard it. |
| `deletions_held` | Show the exact IDs. Let the person run the acceptance command in their own terminal, or restore the deletes. Agents never simulate acceptance. |
| `pulled.refused_deletions` | Confirm the shrink in the app before applying the token-bound take-host-deletions command. |
| `unsafe_id` / `case_collision` | The person renames those documents in the app. Other safe documents can still sync. |
| `sync_busy` | Wait and retry. Never remove the lock while another process holds, takes, or releases it. |
| `lock_orphaned` | Confirm no Superbee command is still running, then remove only the lock the receipt names. |
| `unknown` / `write_outcome_unknown` | Preserve the local files and retry the same intent so the command can reconcile the outcome. |
| Definition, artifact, verification, View-save, or metadata refusal | Use the interface named by the receipt; definitions cannot be changed from this checkout. Do not work around the refusal. |
| `export_incomplete` | Repeat the same export into its intended destination. |
| `unsent_changes` on in-place export | Sync first, or obtain agreement that keep-unsent leaves those edits local permanently. |

When access has been withdrawn or the host is read-only, local edits are not proof of remote
persistence. Report the unsent IDs and preserve them. `SUPERBEE_NO_AUTOPULL` and
`SUPERBEE_NO_TURN_SYNC` can suppress automatic network work for a shell, but explicit sync still
requires the intended person's access.

[Checkout procedure and conflict choices](../guides/work-in-hosted-checkout.md)

[Publish, adopt, or export](../guides/move-bundle-between-local-and-hosted.md)

[Hosted operations and identity](../reference/hosted-cli-access.md)

# Prepared recovery additions

These additions apply to [the prepared release](../releases/next-release.md), with matching host
capabilities and access:

| Receipt | Recovery |
| --- | --- |
| `ambiguous_host` on a new hosted write | Select the intended host explicitly with `--host`; keep bound checkout selection intact. |
| `definitions_refused` | Ask the person managing bundle access for model-edit permission. Do not infer an admin-role requirement or use generic operations as a bypass. |
| `definition_incompatible` | Preserve the convention file, inspect the named instance findings, fix those documents, and sync again. |
| `index.md` conflict | Inspect the front-page versions; take, keep, or revise one deliberate result, then sync outgoing decisions. |
| `too_large` | Preserve the file; account for request encoding and the host's declared bound. Split only with the person's agreement. |
| `not_sendable`, `symlink`, or `unsafe_path` on the root | Correct the intended plain UTF-8 file without changing the bundle edition; never send through a link or directory. |
| `export_source_changed` | Retry the same export after concurrent source writes settle. |
| Interrupted staged publish / unknown creation outcome | Retry the same approved intent and target; preserve local files and inspect progress/receipts. |

The older definition-refusal row above describes the current stable release. Prepared capability
extensions are explained in [the checkout guide](../guides/work-in-hosted-checkout.md).
