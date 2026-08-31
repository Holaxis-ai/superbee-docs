---
type: Documentation Trigger
title: Security and trust boundaries change trigger
description: >-
  Operational change triggers for Superbee security, capability, and exposure
  boundaries.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Security and trust boundaries](../../reference/security-and-trust-boundaries.md)

# Source paths

- `SECURITY.md`
- `packages/cli/src/setup/**`
- `packages/cli/src/private-state/**`
- `packages/cli/src/commands/serve.ts`
- `packages/cli/src/commands/ui.ts`
- `packages/ui-server/src/**`
- `packages/view-runtime/src/**`
- `packages/server/src/**`
- `packages/core/src/remote-backend.ts`
- `packages/publication/src/**`
- `packages/board-git/src/**`

# Product events

- `private-state-boundary`
- `local-ui-session-boundary`
- `view-sandbox-boundary`
- `reference-server-security`
- `git-sharing-boundary`
- `public-publication-boundary`
- `security-reporting`

# Review action

Review the source-level trust map and rerun loopback, View containment, proposal confirmation,
remote authentication caveat, setup private-state, Git sharing, and publication admission probes.
Update the matrix when any principal, credential, capability, or exposure boundary changes.

# Evidence

[current release evidence](../../sources/current-release.md)
