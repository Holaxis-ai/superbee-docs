---
type: Documentation Trigger
title: Install and setup change trigger
description: Operational change triggers for the Install and setup documentation page.
superbee_updated_by: openai/codex
---
# Affected pages

[Install and setup](../../get-started/install-and-setup.md)

# Source paths

- `packages/cli/package.json`
- `packages/cli/src/setup-plan.ts`
- `packages/cli/src/commands/setup.ts`
- `packages/cli/src/host-integrations.ts`

# Product events

- `npm-latest`
- `package-platform-metadata`
- `supported-hosts`
- `setup-capabilities`
- `setup-completion-fields`
- `persistent-install-command`

# Review action

Re-run installation and host setup with the current package, then update only behavior confirmed by the receipts.

# Evidence

[current release evidence](../../sources/current-release.md)
