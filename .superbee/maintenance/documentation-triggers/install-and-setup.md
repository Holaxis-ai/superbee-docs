---
type: Documentation Trigger
title: Install and setup change trigger
description: Operational change triggers for the Install and setup documentation page.
superbee_updated_by: 'process:node22-docs'
generated:
  by: 'process:node22-docs'
  at: '2026-10-13T13:13:13.035Z'
---
# Affected pages

[Install and setup](../../get-started/install-and-setup.md)

# Source paths

- `packages/superbee/package.json`
- `scripts/ci-lanes.json`
- `scripts/node-runtime-policy.mjs`
- `packages/cli/package.json`
- `packages/cli/src/setup-plan.ts`
- `packages/cli/src/commands/setup.ts`
- `packages/cli/src/host-integrations.ts`

# Product events

- `node-runtime-policy`
- `npm-latest`
- `package-platform-metadata`
- `supported-hosts`
- `skill-installation`
- `setup-capabilities`
- `setup-completion-fields`
- `persistent-install-command`

# Review action

Re-run installation and host setup with the current package, then update only behavior confirmed by the receipts.


Check supported Node majors and the minimum patch against package engines and runtime policy.
Keep immutable release requirements scoped to their recorded versions.

# Evidence

[current release evidence](../../sources/current-release.md)

[current runtime requirements](../../reference/host-and-platform-support.md)
