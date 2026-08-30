---
type: Documentation Trigger
title: Verify host setup change trigger
description: Operational change triggers for the Verify host setup documentation page.
superbee_updated_by: openai/codex
---
# Affected pages

[Verify host setup](../../get-started/verify-host-setup.md)

# Source paths

- `packages/cli/package.json`
- `packages/cli/src/setup-plan.ts`
- `packages/cli/test/setup-plan.test.ts`
- `packages/cli/src/commands/setup.ts`
- `packages/cli/src/commands/version.ts`
- `packages/cli/src/commands/skill.ts`
- `packages/cli/test/skill-command.test.ts`
- `packages/cli/src/commands/hook.ts`
- `packages/cli/test/hook-reconciliation.test.ts`
- `packages/cli/src/mcp-install-targets.ts`
- `packages/cli/src/mcp-registration.ts`
- `packages/cli/test/mcp-registration.test.ts`
- `packages/mcp-app/src/server.ts`
- `packages/mcp-app/test/server.test.ts`

# Product events

- `npm-latest`
- `stable-release-identity`
- `supported-hosts`
- `setup-capabilities`
- `setup-completion-fields`
- `skill-install-targets`
- `skill-compatibility-contract`
- `session-start-hook-targets`
- `hook-compatibility-contract`
- `mcp-registration-contract`
- `mcp-app-tool-contract`
- `mcp-app-resource-contract`
- `host-mcp-app-support`

# Review action

Run the current stable package's read-only status commands and setup plans in isolated host homes.
Then exercise `list_workspaces`, `show_document`, `list_views`, and `show_view` in each host version
whose live behavior is claimed. Preserve the distinction between managed configuration, a live MCP
connection, and rendered App resources.

# Evidence

[current release evidence](../../sources/current-release.md)
