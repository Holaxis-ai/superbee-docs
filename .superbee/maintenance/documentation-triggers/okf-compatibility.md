---
type: Documentation Trigger
title: OKF compatibility
description: >-
  Review OKF compatibility when the specification, edition policy, document
  semantics, or migration behavior changes.
superbee_updated_by: openai/codex
---
# Affected pages

[OKF compatibility](../../reference/okf-compatibility.md)

# Source paths

- `packages/core/src/bundle.ts`
- `packages/core/src/backend.ts`
- `packages/core/src/frontmatter.ts`
- `packages/core/src/document-write-policy.ts`
- `packages/core/src/document-mutation.ts`
- `packages/core/src/paths.ts`
- `packages/core/src/links.ts`
- `packages/core/src/kinds.ts`
- `packages/core/src/query-selection.ts`
- `packages/core/src/freshness.ts`
- `packages/core/test/dual-backend.test.ts`
- `packages/core/test/okf-v0-2-read-compat.test.ts`
- `packages/core/test/okf-v0-2-write-contract.test.ts`
- `packages/core/test/progress-status.test.ts`
- `packages/cli/src/commands/status.ts`
- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/list.ts`
- `packages/cli/src/commands/new.ts`
- `packages/cli/src/commands/doc/update.ts`
- `packages/cli/src/kind-write.ts`
- `packages/cli/test/status.test.ts`
- `packages/cli/test/new-cli-integration.test.ts`
- `packages/cli/test/doc-cli-integration.test.ts`
- `packages/cli/test/doc.test.ts`
- `packages/cli/src/commands/doc/read.ts`
- `packages/markdown-renderer/src/index.tsx`

# Product events

- `stable-release-identity`
- `okf-specification`
- `okf-authoring-editions`
- `document-normalization`
- `workflow-progress-compatibility`
- `document-byte-channels`
- `filesystem-concept-discovery`
- `okf-relationship-projection`
- `attested-computation-boundary`

# Review action

Compare the current stable package with the pinned official OKF specification. Recheck edition
authoring, permissive consumption, reserved files, standard metadata, link resolution, workflow
progress compatibility, normalization, and presentation bounds. Update the page only for behavior
established by released source and tests.

# Evidence

[current release evidence](../../sources/current-release.md)

[official OKF v0.2 specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/4bc03b7560caa862cdeebccbeb2bced68940c9f0/okf/SPEC.md)
