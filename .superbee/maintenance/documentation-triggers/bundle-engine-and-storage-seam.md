---
type: Documentation Trigger
title: Bundle engine and storage seam change trigger
description: >-
  Operational change triggers for core semantic ownership and backend
  capabilities.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Bundle engine and storage seam](../../architecture/bundle-engine-and-storage-seam.md)

# Source paths

- `packages/core/src/types.ts`
- `packages/core/src/bundle.ts`
- `packages/core/src/document-mutation.ts`
- `packages/core/src/backend.ts`
- `packages/core/src/memory-backend.ts`
- `packages/core/src/remote-backend.ts`
- `packages/core/src/versioning.ts`
- `packages/server/src/router.ts`
- `docs/WIRE-PROTOCOL.md`

# Product events

- `storage-backend-contract`
- `core-semantic-ownership`
- `backend-capability`
- `query-head-pushdown`
- `version-and-history-contract`

# Review action

Re-pin the reviewed source, rerun adapter parity and wire tests, inspect every cited range, rebuild
the static diagram, and update the ownership and capability matrix. Any semantic move across the
core/backend boundary requires explicit review.

# Evidence

[pinned Superbee implementation source](../../sources/superbee-codebase-main.md)
