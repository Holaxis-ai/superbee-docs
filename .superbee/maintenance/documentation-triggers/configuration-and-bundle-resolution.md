---
type: Documentation Trigger
title: Configuration and bundle resolution change trigger
superbee_updated_by: openai/codex
---
# Affected pages

[Configuration and bundle resolution](../../reference/configuration-and-bundle-resolution.md)

# Source paths

- `packages/cli/src/bundle.ts`
- `packages/cli/src/config.ts`
- `packages/cli/src/catalog.ts`
- `packages/cli/src/credentials.ts`
- `packages/cli/src/env-policy.ts`
- `packages/cli/src/mcp-workspace-resolver.ts`
- `packages/cli/src/private-state-bundle-boundary.ts`
- `packages/cli/src/user-state.ts`
- `packages/cli/src/commands/bundle.ts`
- `packages/cli/src/commands/catalog.ts`
- `packages/cli/src/commands/mcp.ts`
- `packages/mcp-app/src/server.ts`
- `packages/cli/test/bundle.test.ts`
- `packages/cli/test/bundle-locate.test.ts`
- `packages/cli/test/catalog.test.ts`
- `packages/cli/test/catalog-command.test.ts`
- `packages/cli/test/mcp-workspace-resolver.test.ts`
- `packages/cli/test/private-state-bundle-boundary.test.ts`
- `packages/cli/test/remote-auth.test.ts`

# Product events

- `stable-release-identity`
- `bundle-selection-precedence`
- `project-binding-contract`
- `conventional-bundle-directory`
- `remote-selection-contract`
- `workspace-catalog-schema`
- `private-state-location`
- `mcp-workspace-selection`

# Review action

Run the current stable package's `version`, `bundle --help`, and `catalog --help` receipts. Recheck
the tagged resolution, catalog, private-state, credential, and MCP selection tests. Update this page
when any target precedence, binding filename or shape, conventional path, receipt field, catalog
schema, private-state path, or recovery behavior changes.

# Evidence

[current release evidence](../../sources/current-release.md)
