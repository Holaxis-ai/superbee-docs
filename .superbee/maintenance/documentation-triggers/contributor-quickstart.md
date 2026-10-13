---
type: Documentation Trigger
title: Contributor quickstart change trigger
description: >-
  Operational change triggers for the contributor onboarding and verification
  workflow.
superbee_updated_by: 'process:node22-docs'
generated:
  by: 'process:node22-docs'
  at: '2026-10-13T13:13:13.410Z'
---
# Affected pages

[Contributor quickstart](../../contributing/quickstart.md)

# Source paths

- `packages/superbee/package.json`
- `scripts/ci-lanes.json`
- `scripts/node-runtime-policy.mjs`
- `CONTRIBUTING.md`
- `CLAUDE.md`
- `SECURITY.md`
- `package.json`
- `package-lock.json`
- `.github/workflows/**`
- `packages/*/package.json`

# Product events

- `node-runtime-policy`
- `contributor-prerequisite`
- `repository-check-contract`
- `workspace-layout`
- `ci-exact-sha-boundary`
- `security-reporting-process`

# Review action

Complete a clean install, build, typecheck, targeted package test, root test, packed-package probe,
and exact-SHA CI review using the current contributor instructions. Update commands and platform
claims that changed.


Check supported Node majors and the minimum patch against package engines and runtime policy.
Keep immutable release requirements scoped to their recorded versions.

# Evidence

[pinned Superbee implementation source](../../sources/superbee-codebase-main.md)

[current runtime requirements](../../reference/host-and-platform-support.md)
