---
type: Source
title: Current release source review
description: >-
  Fixed stable source, prerelease code-equivalence comparison, package
  verification, and bounded acceptance evidence.
generated:
  by: openai/codex
  at: '2026-10-13T13:02:31.739Z'
superbee_updated_by: openai/codex
---
# Current stable source review

This review binds `superbee@0.4.2` to stable tag `v0.4.2` and source commit
`069a42092f39d8261ccd4322c0dc7ff5488aa2c8`. The downloaded package matches npm integrity;
its installed executable reports this clean source identity. See [current package evidence](current-release.md)
for the immutable registry, platform, and artifact receipts.

The source comparison covers the released tree since 0.4.1. The OSS-facing changes include
Node.js support, named Git boards, outgoing sync gates, recipe field declarations, View proposals,
and portable-export APIs. Architecture narratives were reviewed against this same stable source.

# Verification

Disposable local-bundle probes verified work-tracking initialization, three related tasks, field
queries, dependency links, optimistic-version conflict refusal, and preservation on repeated init.
The portable-export and bundle-descriptor subpaths import successfully; an empty archive is rejected.
CLI inventory was regenerated from the installed package.

At review on October 13, npm latest names 0.4.2 and the source tag exists, but GitHub has no
public stable release receipt for v0.4.2. That missing receipt prevents the release conductor's
full external finalization check. No service onboarding, service writes, or live agent-host restart
was exercised. These docs cover local OSS use and Git collaboration.

[Reviewed architecture source](superbee-codebase-main.md)
[Current changes and compatibility](../releases/current.md)
