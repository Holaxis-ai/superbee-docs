---
type: Reference
title: Prepare for Superbee 0.4.0
description: >-
  Planned changes, compatibility, and recovery from 0.3.0 or the published pre.4
  package.
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T20:06:39.967Z'
superbee_updated_by: 'process:release-docs-preparation'
---
# Release status

This is preparation for Superbee 0.4.0, based on the published `0.4.0-pre.4` package and its fixed
source. Stable 0.4.0 publication has not been verified. [The current stable record](current.md)
continues to document 0.3.0. [Preparation evidence](../sources/next-release.md) records the
prerelease identity, source comparison, and verification limits.

At the recorded registry check, both npm `latest` and `next` resolve to `0.4.0-pre.4`. A dist-tag is
a moving package selector; it does not make a prerelease stable. Use an explicit version from the
verified stable record for stable installation. Readers deliberately evaluating this prerelease can
install `superbee@0.4.0-pre.4` on macOS or Linux with Node.js 20 or newer.

# Changes since 0.3.0

- Hosted checkouts can change Kind conventions through `kind` and convention-only recipes when the
  host permits that person to change the bundle model. The host validates compatibility against
  existing documents. Artifact, verification, and View-save refusals still apply.
- The root `index.md` can sync as the bundle's front page when the host advertises root writes.
  Conflicting front pages use inspect and take/keep/revise. Changing the bundle's OKF edition is
  refused; subdirectory indexes and `log.md` remain held.
- Hosted publication can stage larger bundles in bounded parts. Paged export and checkout read
  beyond one response's document limit when the host supports it. These operations retain explicit
  destination selection, access checks, verification, and retry of the same intent.
- Sync and publication honor the host's advertised document-write bound. Oversize writes are held
  or blocked; agents should preserve content and resolve the limit with the person.
- `doc read --offset` returns bounded body pages with a version guard. Follow `range.next_offset`
  while it exists. A later final page still has `range.complete: false`; only a whole-body first
  page sets it true. Complete byte channels remain available for editing.
- View queries can request `order: "newest"` when `query.newest` is advertised. CLI list and home
  use the same meaningful-change ordering. Malformed document listings name skipped records;
  complete heads and snapshots still fail rather than silently implying deletion.
- Local UI View delivery fetches and verifies approved bytes in the trusted shell before mounting
  the sandboxed View. View authors should refresh data through the bridge instead of reloading
  their own frame. A delivery receipt does not prove visible rendering.
- Malformed frontmatter holds all outgoing dedicated-board work, including valid pending edits.
  The receipt names held documents and exits 5. Repair the YAML, check `status`, and retry;
  preserve committed history and put its correction on top. A malformed fresh establishment
  snapshot exits 2 before publication or move. See [Git recovery](../guides/share-and-synchronize-git-bundle.md).
- Plain `init` in a Git work tree uses its top-level `.superbee/` unless an existing bundle or
  project binding selects another target. Initialization stays local; establishing a board is a
  separate publication decision.
- A new hosted write with several stored or remembered host candidates requires explicit host selection. A bound
  checkout continues to use its stored host. After a committed sync send, the folder takes the
  host's returned canonical bytes.

# Compatibility and user actions

The prepared stable candidate changes only package version metadata and README installation text
relative to pre.4. The comparison shows no executable-code rollback. Stable and prerelease
artifacts will have different package/source identities; verify the actual stable tarball after
publication rather than assuming byte identity.

From 0.3.0, keep existing bundle files and their declared OKF edition. Node >=20, macOS/Linux
support, and the native Windows exclusion continue. WSL2 follows the Linux installation path.
Review [hosted checkout changes](../guides/work-in-hosted-checkout.md),
[transfer limits and retry behavior](../guides/move-bundle-between-local-and-hosted.md), and
[paged reads](../reference/cli-overview.md) before updating automation. Check host capabilities;
the CLI version alone does not establish production host support or grant model-edit permissions.

From pre.4, the prepared stable version requires no functional rollback or bundle migration based
on the reviewed source delta. Once stable evidence exists, install its explicit verified version,
inspect `superbee version`, rerun setup for the chosen AI host, and restart when instructed.

# Recovery

Keep a recoverable bundle and the previous executable identity. Reinstalling an earlier CLI does
not undo sent hosted writes or model changes. Preserve held and refused files, inspect conflicts,
and retry interrupted staged publication or export with the same target. Export is the supported
route to a portable local current-revision copy. Never shorten someone else's document to satisfy a
write bound or replace a full body with a read page.

# Finalization gate

Before this preparation becomes the current release, verify the non-prerelease GitHub release,
dereferenced `v0.4.0` tag, npm package integrity, and installed clean source identity. Review any
source difference from this candidate. Then use the repository's release-documentation conductor
to pin the stable package, regenerate the CLI inventory, create immutable release/evidence records,
and reconcile the current release and archive. Fresh site checks and reviewed publication follow.
