---
type: Source
title: Superbee 0.4.0 preparation evidence
description: >-
  Published pre.4 identity, fixed source comparison, and verification limits for
  stable preparation.
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T19:52:25.807Z'
superbee_updated_by: 'process:release-docs-preparation'
---
# Preparation identity

The current stable documentation is 0.3.0, whose source is
`bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8`. This preparation reviews its actual tree difference
against the published pre.4 source below. Stable 0.4.0 is not recorded as published.

| Field | Observed value |
| --- | --- |
| Published evaluation package | `superbee@0.4.0-pre.4` |
| Source tag | `v0.4.0-pre.4` |
| Dereferenced source commit | `2f12937e983b904d7a5c529ab12c546b682bd883` |
| npm integrity | `sha512-JdRNR9fjX0Y4p+XUkTzATs0XAm8+s2mQy4puWqEh1g9Vc38LpLd5wdDFx/xLEtpd5aFkTQyy0/XFI8TF/g86Ow==` |
| Tarball SHA-256 | `7bf2985ad55aa6c088d3ef2f150e9ef293efe39a5bbfa2295a41a4c9e79fdc42` |
| Node / platforms | `>=20`; `darwin`, `linux` |

The downloaded public tarball matches the registry's SHA-512 integrity. Lifecycle-disabled isolated
installation reports `superbee 0.4.0-pre.4`, `npm-package`, the clean source commit above, and
executable digest `sha256:08306f2fa0a23f38fd0145d87f295dfd3115b8265c1fa4b3060e95269b9e87b5`.

# Release state and candidate comparison

At the 2026-10-02 check, npm `latest` and `next` both name `0.4.0-pre.4`; npm has no `0.4.0`
version and GitHub has no `v0.4.0` tag. The
[pre.4 GitHub release](https://github.com/Holaxis-ai/superbee/releases/tag/v0.4.0-pre.4) is published
and marked prerelease. These observations are a dated receipt, not a future availability promise.

The prepared candidate at `b2911c7f26c60d6648ad2d53a1962259cb8b3a08`, in
[PR 383](https://github.com/Holaxis-ai/superbee/pull/383), differs from pre.4 only in
`packages/superbee/package.json`, its lockfile version entry, and two READMEs. No executable source
changes are present in that comparison. A stable package will still need independent integrity and
embedded identity verification. No stable tarball identity is inferred from this prerelease.

# Fixed public implementation authorities

- [Command specifications](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/command-spec.ts).
- [Paged read bounds and Unicode offsets](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/body-pages.ts).
- [Paged read, byte channels, and version preconditions](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/commands/doc/read.ts).
- [Paging, UTF-8, and stale-version tests](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/test/doc.test.ts).
- [Plain init and Git target selection](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/commands/init.ts).
- [Git initialization tests](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/test/init-hint.test.ts).
- [Hosted model permissions and recipe refusals](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/hosted/refusals.ts).
- [Hosted model write tests](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/test/hosted-definition-writes.test.ts).
- [Front-page reconciliation](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/hosted/root-sync.ts).
- [Sync limits, canonical bytes, and front-page tests](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/test/hosted-sync.test.ts).
- [Staged publication and bounds](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/commands/publish.ts).
- [Staged retry tests](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/test/publish-staged.test.ts).
- [Paged export](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/commands/export.ts).
- [Export chain verification](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/hosted/export-archive.ts).
- [Checkout capability and document limits](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/commands/checkout.ts).
- [Explicit hosted write target selection](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/cli/src/hosted-auth/session.ts).
- [View protocol and query.newest](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/docs/VIEW-PROTOCOL.md).
- [Shell-owned View byte delivery](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/view-runtime/src/view-host.ts).
- [Wire list, malformed rows, heads, and snapshot contract](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/docs/WIRE-PROTOCOL.md).
- [Shared newest-first ordering](https://github.com/Holaxis-ai/superbee/blob/2f12937e983b904d7a5c529ab12c546b682bd883/packages/core/src/query-order.ts).

# Verification limits

Installed-package probes run on macOS with Node.js 26.8.2 and no production credentials. They check
identity, Unicode body paging and termination, stale-page version refusal, complete body export,
incompatible paging/byte-channel flags, malformed-file listing, plain Git init target selection,
and shipped help for hosted transfer and checkout.

Hosted model changes, root writes, staged publication, canonical sync bytes, paged export, and
View runtime behavior are grounded in the fixed source and committed tests linked above. This
update does not claim that it executed production OAuth, hosted writes or transfer, live AI-host
restart, native Windows, or Linux acceptance. The independently pinned architecture and site
rendering dependencies are retained. Later main commits and unmerged feature PRs are excluded.

[Current stable package evidence](current-release.md)

[Preparation and migration guidance](../releases/next-release.md)
