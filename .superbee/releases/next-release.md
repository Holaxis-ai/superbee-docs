---
type: Reference
title: Pending release changes and merge gates
description: >-
  Source-grounded changes and publication checks for the prepared stable
  release.
generated:
  by: 'process:release-docs-review'
  at: '2026-09-30T18:39:41.218Z'
superbee_updated_by: 'process:release-docs-review'
---
# Status

Superbee 0.3.0 is prepared at `bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8`. This draft describes the
source delta from the documented 0.2.1 release; it is not a stable npm publication announcement.
[Current release](current.md) and [current release evidence](../sources/current-release.md)
remain unchanged until verified publication. See [pending source evidence](../sources/next-release.md).

# Changes users need to review

- Hosted sign-in, workspace discovery, and checkout let an agent work through a local folder,
  then pull and send document edits with the person's access. Conflicts require explicit inspection
  and resolution; large deletion sets retain a separate person-at-terminal acceptance step.
- Hosted catalog entries expose reachable bundles and existing checkout folders. Checkout markers
  identify moved or copied folders without granting routing authority. Adoption rebinds only an
  intended proven origin.
- Previewed publication can move a local or Git bundle to hosted; verified export can create a
  portable local copy or end checkout ownership in place. Publication is an explicit sharing
  decision. Export leaves the host unchanged and carries only the current revision.
- Generic CLI and local MCP operations discover and run host reads without a typed verb. The
  checkout's folder remains the owner of reads that need to include unsent local changes.
- Optional turn-end hooks synchronize hosted work; Git boards require an additional opt-in.
  Agent attribution accompanies writes as unverified descriptive data, never access authority.
- Native Windows support is removed from the public npm package. npm metadata permits macOS and
  Linux, still requiring Node >=20. Native Windows upgrades fail with `EBADPLATFORM`; forcing
  installation does not restore command support. Use WSL2 or evaluate the separately documented
  experimental source build. Existing bundle files are not migrated or removed.
- Kind conventions gain a reading-order declaration named `order`. Governed View actions and wire
  transport gain additional contracts described in their prepared-release sections. Hosted Kind
  writes present only in later source are outside this release's scope.

# User actions

After the stable package is actually published, users on supported platforms can install
`superbee@latest`, verify the embedded package and source identity, and rerun setup for the selected
AI host. Restart when the setup receipt requires it. Windows users should review the platform
migration before attempting an upgrade. Hosted users should confirm the intended host and workspace,
follow browser sign-in, then select an existing checkout or returned hosted reference.

Read [hosted checkout](../guides/work-in-hosted-checkout.md),
[local/hosted transfer](../guides/move-bundle-between-local-and-hosted.md), and
[hosted recovery](../troubleshooting/hosted-checkout.md) before enabling unattended sync.
No generic operation grants authority to bypass a definition or artifact refusal.

# Recovery

Keep a recoverable local bundle and the prior executable identity before upgrading. Reinstalling
0.2.1 restores that CLI but does not undo writes already sent to a host. A hosted conflict should
be settled through inspect and take/keep/revise; a pending delete can be restored. Export is the
supported path to a complete local copy. Neither a copied marker nor a package downgrade migrates
private checkout state by itself.

# Required before this draft can merge

1. Verify public npm `latest` is exactly 0.3.0 and inspect the actual tarball URL, SHA-512 integrity,
   supported OS metadata, and Node requirement.
2. Verify the final non-draft, non-prerelease GitHub release and v0.3.0 source tag bind the same
   prepared source commit. Stop and re-review if they differ.
3. Prepare a fresh release-conductor packet with a new state directory. Fill authored release
   fields and every affected-page disposition from the actual tree delta and executed journeys.
4. Execute isolated installed-package identity, help, local document, Kind-order, View, hosted
   fixture or authorized host, conflict, deletion-hold, and transfer checks as appropriate. Record
   exactly which live host/platform journeys remain untested.
5. Apply the reviewed conductor handoff to pin package/lockfile, generate immutable release and
   evidence records, advance stable identities and archive, and rebuild the generated CLI inventory.
6. Replace draft applicability wording with the verified release boundary, reconcile historical
   stable sections where behavior changed, and include the final release in publication selection.
7. Run the full repository check, inspect Portal and MkDocs output, obtain independent exact-SHA
   review, and pass required CI on the final pushed commit. Keep the PR draft until these gates pass.

The daily freshness workflow discovers and saves review evidence; it does not author or merge this
update. Production activation follows a separately merged docs main commit. This draft performs no
release publication, deployment, or workflow dispatch.
