---
type: Source
title: Pending Superbee release evidence
description: >-
  Public source identity and verification limits for the prepared stable
  release.
generated:
  by: 'process:release-docs-review'
  at: '2026-09-30T18:39:40.427Z'
superbee_updated_by: 'process:release-docs-review'
---
# Identity and publication status

The prepared release is Superbee 0.3.0 at source commit
`bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8`, merged through
[release preparation PR 355](https://github.com/Holaxis-ai/superbee/pull/355).
The comparison baseline is the currently documented stable release 0.2.1 at
`ff8f9c8681c94204cac23e8ab7bb2981bb256a12`. Compare the two source trees; the histories diverged,
so commit lists alone do not establish a newly introduced behavior.

This is source preparation evidence. It records no stable npm publication date, tarball,
integrity, or completed installed-package journey for 0.3.0. The stable authorities remain
[current release evidence](current-release.md) and [current release](../releases/current.md).
The planned docs must stay in draft until those authorities can be advanced from verified npm
`latest`, the final GitHub release, and the matching source tag.

# Public implementation authorities

All links below pin the prepared release commit, independently of subsequent `main` changes.

- [Distribution platforms and Node requirement](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/superbee/package.json): Node >=20; darwin and linux.
- [Windows upgrade guidance](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/superbee/README.md).
- [Shipped command specifications](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/cli/src/command-spec.ts).
- [Hosted checkout instructions shipped with the Skill](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/examples/references/hosted-checkout.md).
- [Hosted setup](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/cli/src/commands/setup-hosted.ts).
- [Hosted generic reads](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/cli/src/commands/op.ts).
- [Checkout sync, conflict decisions, and delete acceptance](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/cli/src/hosted/sync.ts).
- [Definition and artifact refusal policy](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/cli/src/hosted/refusals.ts).
- [Wire contract](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/docs/WIRE-PROTOCOL.md).
- [View protocol](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/docs/VIEW-PROTOCOL.md).
- [Kind convention parser](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/core/src/kinds.ts).

# Verification boundary

The draft is authored from the public source tree and its committed tests. No production hosted
sign-in, hosted write, native Windows execution, or installed stable-package journey is claimed
by this record. Later source changes are outside its scope. Hosted operations are discovered from
the chosen host; the OSS release does not promise deployment or access on that host.

Before merge, prepare a fresh release-conductor packet for the published stable package, verify its
integrity and embedded source identity, complete every affected-page review, run disposable
package journeys, apply the reviewed release manifest, rebuild the generated CLI inventory, and
run the complete repository check and exact-SHA CI. Preserve bounded untested host claims in the
final immutable release evidence.
