---
type: Documentation Trigger
title: Release notes change trigger
description: >-
  Operational events and source changes that require the reader-facing release
  archive and current release guidance to be reconciled.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Release notes](../../releases/release-notes.md)

[Current release](../../releases/current.md)

# Source paths

- `packages/cli/package.json`
- `.github/workflows/release.yml`
- `.github/workflows/release-finalize.yml`

# Product events

- `npm-latest`
- `stable-release-identity`
- `stable-release-verified`

# Review action

Run `npm run docs:release:status`. When an update is required, inspect the exact npm package,
GitHub release, source tag, release verification, and product changes. Author the reader-facing
summary and operational guidance, run the release updater, query every returned impact event,
inspect the rendered archive and current-release page, and run the complete repository check.

# Evidence

[Current release evidence](../../sources/current-release.md)

[Documentation operating model](../../design/docs-operating-model.md)
