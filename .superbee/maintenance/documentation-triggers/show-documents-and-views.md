---
type: Documentation Trigger
title: Show documents and Views change trigger
description: >-
  Operational change triggers for the Show documents and Views documentation
  page.
superbee_updated_by: 'process:release-docs-preparation'
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-03T14:55:22.392Z'
---
# Affected pages

[Show documents and Views](../../guides/show-documents-and-views.md)

# Source paths

- `packages/markdown-renderer/src/**`
- `packages/markdown-renderer/test/**`

- `packages/cli/src/commands/ui.ts`
- `packages/cli/test/ui.test.ts`
- `packages/mcp-app/src/server.ts`
- `packages/mcp-app/test/server.test.ts`
- `packages/cli/src/mcp-workspace-resolver.ts`
- `packages/view-runtime/src/**`

# Product events

- `doc-open`
- `ui-server`
- `view-list`
- `mcp-workspace-selection`
- `mcp-app-host-support`
- `view-access-model`
- `stable-release-identity`

# Review action

Run browser and MCP display journeys in supported hosts, then update the procedure and limitations from observed results.

# Evidence

[current release evidence](../../sources/current-release.md)
