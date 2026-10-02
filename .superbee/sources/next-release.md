---
type: Source
title: Current release source review
description: >-
  Fixed stable source, prerelease code-equivalence comparison, package
  verification, and bounded acceptance evidence.
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T20:45:24.656Z'
superbee_updated_by: 'process:release-docs-preparation'
---
# Current stable source review

This review binds Superbee 0.4.0 to `b2911c7f26c60d6648ad2d53a1962259cb8b3a08`. It compares the
actual released tree with the last documented stable source,
`bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8`, and excludes later main changes and unmerged feature
discussions. [Current package evidence](current-release.md) owns stable installation identity.

| Field | Verified value |
| --- | --- |
| Stable package | `superbee@0.4.0` |
| Stable source tag / commit | `v0.4.0` / `b2911c7f26c60d6648ad2d53a1962259cb8b3a08` |
| npm integrity | `sha512-1mFPE6gko5gCAslUmSckUm61J4hDbdKJ5L8cZ7ItyRnYBhxd8UwH5UlPfBAcJkxWKZBzJNL5DwIOSeejb0kMFA==` |
| Tarball SHA-256 / bytes | `72a3142ecad138aa26aabb006e36be6a544e90899d60c996c271baa9ba3700c3` / `2009612` |
| Executable SHA-256 | `sha256:d23736375aadf4bfb6206a1aec0e1206371883bfcd69e62c54ad95d7f523d5eb` |
| Node / platforms | `>=20`; `darwin`, `linux` |

The stable npm tarball matches registry integrity and the GitHub asset digest and size.
Lifecycle-disabled isolated installation reports the stable package, clean source above and
`npm-package` channel. npm `latest` names stable; `next` still names `0.4.0-pre.4` at the publication
check. The [stable GitHub release](https://github.com/Holaxis-ai/superbee/releases/tag/v0.4.0)
is public and non-prerelease. Its [release workflow](https://github.com/Holaxis-ai/superbee/actions/runs/37056974718)
completed successfully at the same source.

# Comparison with the published prerelease

Published `0.4.0-pre.4` is fixed at `2f12937e983b904d7a5c529ab12c546b682bd883`.
The stable tree changes only package version metadata, its lockfile entry, and two README files.
There are no executable source changes in that comparison and no evidenced functional rollback
or required bundle migration. Stable and prerelease package/source identities and artifact hashes
differ; code equivalence does not establish byte identity.

# Fixed public implementation authorities

- [Command specifications](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/command-spec.ts).
- [Paged read bounds and Unicode offsets](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/body-pages.ts).
- [Paged read, byte channels, and version preconditions](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/commands/doc/read.ts).
- [Paging, UTF-8, and stale-version tests](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/test/doc.test.ts).
- [Plain init and Git target selection](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/commands/init.ts).
- [Git initialization tests](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/test/init-hint.test.ts).
- [Hosted model permissions and recipe refusals](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/hosted/refusals.ts).
- [Hosted model write tests](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/test/hosted-definition-writes.test.ts).
- [Front-page reconciliation](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/hosted/root-sync.ts).
- [Sync limits, canonical bytes, and front-page tests](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/test/hosted-sync.test.ts).
- [Staged publication and bounds](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/commands/publish.ts).
- [Staged retry tests](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/test/publish-staged.test.ts).
- [Paged export](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/commands/export.ts).
- [Export chain verification](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/hosted/export-archive.ts).
- [Checkout capability and document limits](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/commands/checkout.ts).
- [Explicit hosted write target selection](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/hosted-auth/session.ts).
- [View protocol and query.newest](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/docs/VIEW-PROTOCOL.md).
- [Shell-owned View byte delivery](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/view-runtime/src/view-host.ts).
- [Wire list, malformed rows, heads, and snapshot contract](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/docs/WIRE-PROTOCOL.md).
- [Shared newest-first ordering](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/core/src/query-order.ts).

- [Git outgoing frontmatter holds](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/commands/sync/orchestrate.ts).
- [Fresh snapshot frontmatter preflight](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/src/commands/sync/establish.ts).
- [Worktree and committed frontmatter hold tests](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/test/sync.test.ts).
- [Malformed fresh establishment test](https://github.com/Holaxis-ai/superbee/blob/b2911c7f26c60d6648ad2d53a1962259cb8b3a08/packages/cli/test/sync-establish.test.ts).

# Verification limits

Installed stable-package probes run on macOS with Node.js 26.8.2 and no production credentials.
They check identity, Unicode body paging and absent-next termination, changed-page version refusal,
complete body export, incompatible paging/byte-channel flags, malformed-file listing, plain Git
init target without board creation, and shipped hosted-transfer and checkout help.

Hosted model changes, root writes, staged publication, canonical sync bytes, paged export,
Git publication holds, and View runtime behavior are grounded in the fixed source and committed
tests linked above. Production OAuth, hosted writes/transfer, live AI-host restart, native Windows,
Linux acceptance, and exhaustive host rendering were not executed. Independently pinned
architecture and rendering dependencies retain their stated scope.

[Current changes, compatibility, and recovery](../releases/current.md)
