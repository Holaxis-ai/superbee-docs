---
type: Source
title: Superbee 0.3.0 source review
description: Fixed release source and the verification limits for Superbee 0.3.0.
generated:
  by: 'process:release-docs-review'
  at: '2026-09-30T19:59:13.369Z'
superbee_updated_by: 'process:release-docs-review'
---
# Release source review

Superbee 0.3.0 is published as npm `latest`. The release tag resolves to
`bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8`, the source prepared through
[PR 355](https://github.com/Holaxis-ai/superbee/pull/355).
[Current release evidence](current-release.md) owns the verified package, tarball integrity,
publication date, and embedded identity. This review compares its tree with 0.2.1 at
`ff8f9c8681c94204cac23e8ab7bb2981bb256a12`; the histories diverged.

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

Claims are grounded in the fixed release tree and its committed tests, with disposable installed
package journeys recorded below. No production hosted sign-in/write or
native Windows execution is claimed. Hosted operations are discovered from the chosen host; the
OSS release does not establish host deployment or access. Later `main` changes, including hosted
definition writes, are outside this release.

# Installed package journeys

The isolated published executable completed 29 command probes on macOS with Node.js 26.8.2:

- Identity reports 0.3.0, the clean source commit above, and npm-package channel.
- Fresh `init --create-only --recipe none`, document creation, complete `--body-out`, and guarded
  replacement succeed. Reusing the stale version returns `STALE_HEAD` with exit 5 and preserves
  the successful replacement.
- Three promoted Kind Conventions enumerate in declared order 10, 20, then undeclared.
- Hosted account, checkout, operation, publication, export, sync, and hook help is available.
- Local `op list` is empty; local `op run documents.history.v1` returns `NOT_IMPLEMENTED` (exit 2).
- An in-process hosted fixture hydrates a checkout and retains an unsent title edit through folder
  reads. Its operation listing discovers history; generic `documents.read.v1` is refused (exit 2)
  with folder-owned read guidance. Fixture transport refuses external or unconfigured requests.

These probes use no production credentials. Live OAuth, hosted sync writes, conflict/deletion-hold
acceptance, transfer, Linux, and Windows execution were not repeated in this update.
