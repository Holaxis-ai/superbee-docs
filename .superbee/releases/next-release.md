---
type: Reference
title: Upgrade to Superbee 0.3.0
description: 'User actions, compatibility changes, and recovery when upgrading from 0.2.1.'
generated:
  by: 'process:release-docs-review'
  at: '2026-09-30T19:59:54.931Z'
superbee_updated_by: 'process:release-docs-review'
---
# Upgrade scope

This guide summarizes the migration from 0.2.1 to [Superbee 0.3.0](current.md).
[Release source review](../sources/next-release.md) records the fixed source scope.
Hosted capabilities require support and access on the selected host.

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
  transport gain additional contracts described in their reference pages. Hosted Kind
  writes present only in later source are outside this release's scope.

# User actions

Users on supported platforms can install
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
