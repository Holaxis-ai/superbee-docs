---
type: Source
title: Superbee Portal source
description: Pinned Portal evidence for the public documentation bundle.
resource: 'https://github.com/Holaxis-ai/superbee-portal'
superbee_updated_by: openai/codex
---
# Evidence scope

The Superbee Portal repository is authoritative for deterministic human publication artifacts,
complete-bundle validation, read-only publication behavior, target-neutral documentation projection,
Portal and MkDocs consumers, and hosting adapters.

- `source_repository`: `https://github.com/Holaxis-ai/superbee-portal`
- `source_commit`: `7b2cbac2e229963616a01c9d58a6b59423a8bbf6`
- Commit subject: `Merge pull request #23 from Holaxis-ai/codex/documentation-freshness`
- Reviewed on: 2026-08-29

# Evidence contract

Portal core consumes the immutable `superbee/publication` snapshot and owns explicit audience,
complete-bundle exposure, content checks, exact View admission, artifact integrity, and hosting
requirements. `@superbee/docs-projection` owns the bounded host-neutral reader selection.
`@superbee/portal-docs` and `@superbee/docs-mkdocs` consume that projection without redefining bundle
semantics. `@superbee/docs-tooling` composes the pipeline and diagram publication contract.

An architecture page that cites Portal must use exact source URLs at this commit and identify which
Portal source paths or product events should trigger review. The public Superbee bundle remains the
disclosure authority; Portal checks are fail-closed guards, not a general privacy classifier.

[supports the system context](../architecture/superbee-system-context.md)

[supports the mutation lifecycle](../architecture/document-mutation-lifecycle.md)

[supports the public publication boundary](../architecture/public-publication-boundary.md)
