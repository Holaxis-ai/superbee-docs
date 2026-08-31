---
type: Documentation Trigger
title: CLI commands and errors change trigger
description: >-
  Operational change triggers for generated command and structured failure
  references.
superbee_updated_by: openai/codex/root
---
# Affected pages

[CLI commands](../../reference/cli-commands.md)

[CLI errors and exit codes](../../reference/cli-errors-and-exit-codes.md)

# Source paths

- `packages/cli/src/command-spec.ts`
- `packages/cli/src/reference.ts`
- `packages/cli/src/errors.ts`
- `packages/cli/src/output.ts`
- `packages/cli/src/cli.ts`
- `packages/cli/src/commands/**`
- `packages/cli/AXI-CONTRACT.md`

# Product events

- `cli-command-graph`
- `cli-generated-help`
- `cli-error-taxonomy`
- `cli-exit-status`
- `cli-output-channel`

# Review action

Run `npm run cli-reference:build`, inspect executable help and error mapping from the packed stable
package, and exercise ordinary, raw-byte, JSON, TOON, and MCP output channels. Any unexplained
generated-reference drift blocks publication.

# Evidence

[current release evidence](../../sources/current-release.md)
