---
type: Source
title: Superbee codebase source
description: >-
  Pinned implementation evidence for maintained Superbee architecture
  documentation.
resource: 'https://github.com/Holaxis-ai/superbee'
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T12:56:34.505Z'
---
# Evidence scope

This source pins the implementation reviewed for maintained Superbee architecture pages. The
reviewed tree is the source of the installed stable npm package. Package-integrity probes and the
missing GitHub release receipt are recorded separately in [current release evidence](current-release.md).

- `source_repository`: `https://github.com/Holaxis-ai/superbee`
- `source_commit`: `069a42092f39d8261ccd4322c0dc7ff5488aa2c8`
- Source tag: `v0.4.2`
- Commit subject: `Merge pull request #438 from Holaxis-ai/release/0.4.2-pre4-stable`
- Reviewed on: 2026-10-13

# Review scope

The review reconciled distribution versus command-library ownership, opaque per-backend version
identity, extracted engine and query owners, local and reference HTTP mutation, Git named boards,
sync checks and push-race retries, hosted move routing, host-specific View proposals, and publication
inventory exclusions. It inspected the pinned source contracts and updated citations, triggers,
and diagram narratives. It did not execute a fresh product CI suite or live hosted acceptance.

# Maintained explanations

[Architecture at a glance](../architecture/architecture-at-a-glance.md)

[Bundle engine and storage seam](../architecture/bundle-engine-and-storage-seam.md)

[Document mutation lifecycle](../architecture/document-mutation-lifecycle.md)

[Public publication boundary](../architecture/public-publication-boundary.md)

[Sharing, synchronization, and freshness](../architecture/sharing-synchronization-and-freshness.md)

[View lifecycle and trust](../architecture/view-lifecycle-and-trust.md)

# Evidence contract

Each page cites files and line ranges at this commit and has operational source-path triggers.
The architecture freshness job compares newer source against this reviewed baseline; an affected
path requests semantic review rather than silently advancing the pin. Diagrams are source-bound
publication artifacts rebuilt through the owning diagram command.
