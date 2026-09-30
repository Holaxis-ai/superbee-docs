---
type: Documentation Trigger
title: Hosted CLI and checkout change trigger
description: Operational source and release triggers for hosted checkout guidance.
generated:
  by: 'process:release-docs-review'
  at: '2026-09-30T18:39:41.367Z'
superbee_updated_by: 'process:release-docs-review'
---
# Affected pages

[Hosted checkout](../../guides/work-in-hosted-checkout.md)

[Publish, adopt, or export](../../guides/move-bundle-between-local-and-hosted.md)

[Hosted CLI access](../../reference/hosted-cli-access.md)

[Hosted recovery](../../troubleshooting/hosted-checkout.md)

# Source paths

- `packages/cli/src/hosted/**`
- `packages/cli/src/hosted-auth/**`
- `packages/cli/src/commands/checkout*.ts`
- `packages/cli/src/commands/catalog.ts`
- `packages/cli/src/commands/hosted-auth.ts`
- `packages/cli/src/commands/setup-hosted.ts`
- `packages/cli/src/commands/op.ts`
- `packages/cli/src/commands/publish.ts`
- `packages/cli/src/commands/export.ts`
- `packages/cli/src/commands/turn-end.ts`
- `packages/cli/src/mcp-workspace-resolver.ts`
- `examples/references/hosted-checkout.md`

# Product events

- `npm-latest`
- `hosted-cli-access`
- `hosted-checkout-lifecycle`
- `hosted-operation-capabilities`

# Review action

Verify the selected release source and installed help, then inspect compatible host capabilities,
workspace routing, sign-in recovery, local unsent reads, whole-document conflicts, deletion holds,
transfer/adoption receipts, and local MCP parity. Execute disposable fixture journeys and label any
live-host access claim not verified. Generic read operations must not imply definition writes.

# Evidence

[Pending release evidence](../../sources/next-release.md)

[Current stable release evidence](../../sources/current-release.md)

[Documentation operating model](../../design/docs-operating-model.md)
