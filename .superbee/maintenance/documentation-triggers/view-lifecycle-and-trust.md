---
type: Documentation Trigger
title: View lifecycle and trust change trigger
description: >-
  Operational change triggers for the View lifecycle and trust documentation
  page.
superbee_updated_by: openai/codex
---
# Affected pages

[View lifecycle and trust](../../architecture/view-lifecycle-and-trust.md)

# Source paths

- `packages/core/src/page.ts`
- `packages/view-runtime/src/authorization.ts`
- `packages/view-runtime/src/index.ts`
- `packages/view-runtime/src/bridge.ts`
- `packages/view-runtime/src/action-bridge.ts`
- `packages/ui-server/src/pages.ts`
- `packages/ui-server/src/server.ts`
- `packages/ui/src/views/PageFrame.tsx`
- `packages/cli/src/ui/view-authorizations.ts`
- `packages/cli/src/ui/server.ts`
- `packages/cli/src/commands/mcp.ts`
- `packages/cli/src/mcp-workspace-resolver.ts`
- `packages/mcp-app/src/contract.ts`
- `packages/mcp-app/src/server.ts`
- `packages/mcp-app/src/view.html`
- `packages/mcp-app/src/view.ts`

# Product events

- `view-access-model`
- `view-launch-authority`
- `mcp-app-host-contract`

# Review action

Re-run the View lifecycle and trust review, then update the page and diagram or record that the contract is unchanged.

# Evidence

[pinned implementation source](../../sources/superbee-codebase-main.md)
