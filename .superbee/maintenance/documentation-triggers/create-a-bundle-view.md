---
type: Documentation Trigger
title: Bundle View authoring change trigger
description: >-
  Operational change triggers for durable View authoring across local UI and MCP
  hosts.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Create a bundle View](../../guides/create-a-bundle-view.md)

# Source paths

- `packages/cli/references/views/references/view-authoring-v0.md`
- `packages/cli/src/commands/view.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/src/ui/view-authorizations.ts`
- `packages/view-runtime/src/**`
- `packages/ui-server/src/**`
- `packages/ui/src/views/**`
- `packages/mcp-app/src/**`

# Product events

- `view-authoring-contract`
- `view-registration`
- `view-access-model`
- `view-approval-and-revocation`
- `mcp-view-launch`

# Review action

Author one self-contained View, promote and register it, validate it, exercise local UI and MCP
launches, resize it, update its bytes, and test each access level including stale proposal refusal.

# Evidence

[current release evidence](../../sources/current-release.md)

[View lifecycle and trust](../../architecture/view-lifecycle-and-trust.md)
