---
type: Source
title: Superbee Portal source
description: Pinned Portal evidence for the public documentation bundle.
resource: 'https://github.com/Holaxis-ai/superbee-portal'
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T13:12:49.329Z'
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

# Consumer package review, October 13

The documentation consumer now pins `@superbee/portal` and `@superbee/portal-cloudflare` to 0.2.10,
`@superbee/portal-webmcp` to 0.3.1, and `@superbee/recipe-studio` to 0.1.3. The lockfile retains
the registry artifact integrity for each installed package. Docs-specific package pins are unchanged.

The installed public exports accept the existing documentation projection, static assets,
WebMCP activation, and Cloudflare handler composition. The consumer still owns its Worker entry
and explicit presentation contribution; content stays in the dedicated public bundle.
The older fixed-source citations above describe their bounded architecture contract. This package
review does not treat a newer package version as evidence that every source-level capability has
moved to another owner, or that a new site endpoint has been deployed.
