---
type: Documentation Trigger
title: Contributor quickstart change trigger
description: >-
  Operational change triggers for the contributor onboarding and verification
  workflow.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Contributor quickstart](../../contributing/quickstart.md)

# Source paths

- `CONTRIBUTING.md`
- `CLAUDE.md`
- `SECURITY.md`
- `package.json`
- `package-lock.json`
- `.github/workflows/**`
- `packages/*/package.json`

# Product events

- `contributor-prerequisite`
- `repository-check-contract`
- `workspace-layout`
- `ci-exact-sha-boundary`
- `security-reporting-process`

# Review action

Complete a clean install, build, typecheck, targeted package test, root test, packed-package probe,
and exact-SHA CI review using the current contributor instructions. Update commands and platform
claims that changed.

# Evidence

[pinned Superbee implementation source](../../sources/superbee-codebase-main.md)
