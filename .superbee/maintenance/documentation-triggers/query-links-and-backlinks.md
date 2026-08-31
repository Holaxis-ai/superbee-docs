---
type: Documentation Trigger
title: 'Query, links, and backlinks change trigger'
description: >-
  Operational change triggers for document filtering, graph traversal, and index
  projection.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Query, links, and backlinks](../../guides/query-links-and-backlinks.md)

# Source paths

- `packages/cli/src/commands/list.ts`
- `packages/cli/src/commands/link.ts`
- `packages/cli/src/commands/index.ts`
- `packages/core/src/bundle.ts`
- `packages/core/src/query-selection.ts`
- `packages/core/src/links.ts`
- `packages/core/src/index-projection.ts`

# Product events

- `document-query-contract`
- `terminal-state-filtering`
- `edge-query-contract`
- `backlink-derivation`
- `generated-index-ownership`

# Review action

Run combined filters, declared-terminal filtering, link add/show/list, exact text and prefix queries,
index check, guarded generation, refusal, forced adoption, and partial-concurrency recovery.

# Evidence

[current release evidence](../../sources/current-release.md)
