---
type: Documentation Trigger
title: Host and platform support
description: >-
  Review host and operating-system support when package constraints or setup
  integration behavior changes.
superbee_updated_by: openai/codex
---
# Affected pages

[Host and platform support](../../reference/host-and-platform-support.md)

[Start here](../../learn/start-here.md)

[Model recurring domain concepts](../../guides/model-recurring-domain-concepts.md)

[Choose privacy and bundle boundaries](../../guides/choose-privacy-and-bundle-boundaries.md)

[Share and synchronize a Git-backed bundle](../../guides/share-and-synchronize-git-bundle.md)

[Preserve context between sessions](../../guides/preserve-context-between-sessions.md)

# Source paths

- `packages/cli/package.json`
- `packages/cli/src/setup-plan.ts`
- `packages/cli/src/commands/setup.ts`
- `packages/cli/src/mcp-install-targets.ts`
- `packages/cli/src/host-config.ts`
- `packages/cli/test/host-config-root-agreement.test.ts`
- `packages/cli/src/mcp-registration.ts`
- `packages/cli/test/mcp-registration.test.ts`
- `packages/cli/src/commands/skill.ts`
- `packages/cli/src/commands/hook.ts`
- `packages/cli/test/setup-plan.test.ts`

# Product events

- `stable-release-identity`
- `supported-platforms`
- `supported-hosts`
- `setup-plan`
- `skill-installation`
- `mcp-installation`
- `hook-installation`

# Review action

Check the released package metadata, generated setup plans, and live-host evidence. Update the
support matrix only for behavior established by the current stable release.

# Evidence

[current release evidence](../../sources/current-release.md)
