---
type: Documentation Trigger
title: Artifacts and byte channels change trigger
description: 'Operational change triggers for document, blob, and Artifact byte channels.'
superbee_updated_by: openai/codex/root
---
# Affected pages

[Artifacts and byte channels](../../guides/artifacts-and-byte-channels.md)

# Source paths

- `packages/cli/src/commands/artifact.ts`
- `packages/cli/src/commands/promote.ts`
- `packages/cli/src/commands/pull.ts`
- `packages/cli/src/commands/blobs.ts`
- `packages/cli/src/commands/delete.ts`
- `packages/core/src/backend.ts`
- `packages/core/src/memory-backend.ts`
- `packages/core/src/remote-backend.ts`
- `packages/core/src/content-type.ts`

# Product events

- `artifact-contract`
- `document-blob-routing`
- `byte-stream-output`
- `blob-content-type`
- `object-delete-contract`

# Review action

Re-run document and blob promote, update, pull, list, delete, stdout-purity, and Artifact recovery
journeys locally and over the reference server. Update the page when routing, CAS, content-type, or
partial-completion behavior changes.

# Evidence

[current release evidence](../../sources/current-release.md)
