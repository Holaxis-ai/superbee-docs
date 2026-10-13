---
type: Release
title: Superbee 0.4.2
description: >-
  Superbee adds hosted access management and bundle retirement, a coordinated
  Git-to-hosted move, named Git boards and optional sync checks, expanded
  additive recipe evolution, and verified portable exports. The npm distribution
  now requires supported Node 22, 24, or 26 release lines.
version: 0.4.2
channel: latest
published_at: '2026-10-13'
resource: 'https://www.npmjs.com/package/superbee/v/0.4.2'
superbee_updated_by: release-docs-automation
generated:
  by: 'process:superbee'
  at: '2026-10-13T12:51:56.956Z'
---
# Superbee 0.4.2

Superbee adds hosted access management and bundle retirement, a coordinated Git-to-hosted move, named Git boards and optional sync checks, expanded additive recipe evolution, and verified portable exports. The npm distribution now requires supported Node 22, 24, or 26 release lines.

This release was published on 2026-10-13 as `superbee@0.4.2` under
the npm `latest` tag.

# What changed

- Workspace admins can preview and apply access grants or revocations for existing workspace members. Bundle owners or admins can retire a hosted bundle after a person confirms its ID at the terminal.
- A Git board published to hosted gains a moved marker on its shared branch. Current CLIs stop pushing to that board and direct teammates to the hosted checkout; older writers require upgrade or branch protection.
- Standalone named board-research checkouts target their own upstream. An optional trusted Git-configured sync check can hold an outgoing push. Lost push races refetch, converge, and retry up to five times.
- Recipe evolution accepts a new outbound link declaration and allowed values on a field declared by the same plan. Existing edge and instance checks remain enforced.
- The package exposes superbee/portable-export and superbee/bundle-descriptor for trusted offline consumers. Publication refuses recognized private operational-state files in a bundle.
- Local history attribution and writer identity handling are corrected; hosted conflict receipts are written atomically and Git path/status handling preserves path identities.
- Node support is ^22.14.0 || ^24.0.0 || ^26.0.0. macOS and Linux remain the supported npm platforms.

# What you need to do

Check node --version before upgrading and use a supported Node release line. Follow the installation and upgrade guides, verify superbee version, and rerun setup for your AI host. Before moving a team Git board to hosted, upgrade all writers and automations, review publication, share the destination with members, and point writers at their hosted checkouts.

# Compatibility

Existing OKF bundle editions and ordinary document workflows are retained. Native Windows npm execution remains excluded; WSL2 uses the Linux path. Hosted access and retirement require a compatible host and the stated person permissions. Node 20 and odd-numbered Node release lines are outside the package engine range. The npm package and source tag are verified; the GitHub v0.4.2 release receipt was absent at documentation review.

# Recovery

Preserve unsent work and inspect partial receipts. Fix a failed sync check, then rerun sync; never assume a held push erased a local commit. Follow moved-board recovery commands before carrying later Git edits into hosted. Export a copy before retirement and let the person confirm in their own terminal. For installation recovery, use the upgrade guide and a prior verified package only on its supported Node/platform range.

# Verified evidence

[Inspect the package, source, and verification evidence](../sources/superbee-release-0.4.2.md).
