---
type: Documentation Trigger
title: Claims and evidence example change trigger
description: Operational change triggers for the runnable claims recipe tutorial.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Research claims and evidence](../../examples/claims-and-evidence.md)

# Source paths

- `packages/cli/references/recipes/claims/**`
- `packages/cli/src/commands/new.ts`
- `packages/cli/src/commands/doc.ts`
- `packages/cli/src/commands/link.ts`
- `packages/core/src/document-mutation.ts`

# Product events

- `claims-recipe`
- `claim-lifecycle`
- `claim-provenance-fields`
- `claim-supersession`
- `claim-citation-backlinks`

# Review action

Execute the tutorial from an empty directory using the packed stable package. Verify active,
challenged, locked, deprecated, evidence, citation backlink, guarded update, and supersession steps.
Replace illustrative values only when the model or command contract changes.

# Evidence

[current release evidence](../../sources/current-release.md)
