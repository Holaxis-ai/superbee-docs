---
type: Documentation Trigger
title: Publication snapshot API change trigger
description: >-
  Operational change triggers for the stable publication package exports and
  contracts.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Publication snapshot API](../../reference/publication-snapshot-api.md)

# Source paths

- `packages/cli/package.json`
- `packages/publication/src/**`
- `packages/publication/schema/**`
- `packages/publication/test/**`
- `packages/cli/test/publication-package.test.ts`

# Product events

- `publication-package-export`
- `publication-snapshot-schema`
- `publication-capture-limit`
- `publication-error-code`
- `publication-bridge-admission`

# Review action

Pack and install the public package in an isolated prefix, compile an external TypeScript consumer,
capture a disposable bundle, verify deterministic manifest and object reads, exercise all admission
levels, and confirm every documented error code and default against the exported types.

# Evidence

[current release evidence](../../sources/current-release.md)
