---
type: Documentation Trigger
title: View contract and access change trigger
description: Operational source and product-event triggers for the View contract reference.
superbee_updated_by: openai/codex
---
# Affected pages

[View contract and access](../../reference/view-contract-and-access.md)

# Source paths

- `packages/core/src/page.ts`
- `packages/view-runtime/src/authorization.ts`
- `packages/view-runtime/src/catalog.ts`
- `packages/view-runtime/src/index.ts`
- `packages/view-runtime/src/bridge.ts`
- `packages/view-runtime/src/action-bridge.ts`
- `packages/view-runtime/src/transient-save.ts`
- `packages/ui-server/src/pages.ts`
- `packages/ui-server/src/server.ts`
- `packages/ui/src/views/PageFrame.tsx`
- `packages/mcp-app/src/contract.ts`
- `packages/mcp-app/src/server.ts`
- `packages/mcp-app/src/view.ts`

# Product events

- `view-access-model`
- `view-launch-authority`
- `view-catalog-contract`
- `mcp-app-host-contract`

# Review action

Re-run the registered and transient View contract checks against the current stable package. Update
the reference when registry grammar, admission, access, bridge operations, approval, saving,
invalidation, or host tool inputs change.

# Evidence

[current release evidence](../../sources/current-release.md)

[View lifecycle and trust](../../architecture/view-lifecycle-and-trust.md)
