---
type: Source
title: Current release source review
description: >-
  Fixed stable source, prerelease code-equivalence comparison, package
  verification, and bounded acceptance evidence.
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-03T15:06:42.676Z'
superbee_updated_by: 'process:release-docs-preparation'
---
# Current stable source review

This review binds Superbee 0.4.1 to `98669939db2f0549375cd43efa81c729088c309c` and compares its released tree directly with the
previous documented stable source, `b2911c7f26c60d6648ad2d53a1962259cb8b3a08`. Later main commits
and separately owned tooling proposals are outside this release. [Current package evidence](current-release.md)
owns the stable installation identity.

| Field | Verified value |
| --- | --- |
| Stable package | `superbee@0.4.1` |
| Stable tag / commit | `v0.4.1` / `98669939db2f0549375cd43efa81c729088c309c` |
| npm integrity | `sha512-lfX3zmJLLgEnf4DM8ScwktBnDZ/b08K/kRImq33BcvJ5zI0aNuiq3riC+mDRDeOBu6Fdr+ZubK3SyaNw8JNr9w==` |
| Tarball SHA-256 / bytes | `e0de5f69c5768c397d298f951ec04e7868c14c7805d7665d79a28aeb93160ebd` / `2012105` |
| Executable SHA-256 | `sha256:38c0671a80a2e69a807d6364447597b805f61a8180614d5902a58022d45ee0d2` |
| Node / platforms | `>=20`; `darwin`, `linux` |

The downloaded stable tarball matches npm integrity and the GitHub asset digest and size.
Lifecycle-disabled isolated installation reports the version and clean source above, with
`npm-package` channel. At verification, npm `latest` names `0.4.1` and `next` names `0.4.1-pre.1`.
The [public stable GitHub release](https://github.com/Holaxis-ai/superbee/releases/tag/v0.4.1)
was published on October 3, 2026; its
[finalizer](https://github.com/Holaxis-ai/superbee/actions/runs/37126754136) succeeded at this source.

# Changes since the previous stable release

The complete released-tree diff contains 40 paths. The reader-facing implementation changes are
hosted first-run selection and sign-in receipts, private-state write diagnostics and permission
repair, and bounded same-page Markdown fragment metadata. CI, contributor policy, dependency,
release metadata, and shipped Skill/reference changes were reviewed for their impact without
expanding the documented feature set.

On a first run, `whoami` and `logout` succeed without selecting a host or creating private state.
A host-dependent command with no selected host or saved session returns `AUTH_REQUIRED` (exit 4)
and `not_signed_in`, with a sign-in command. Bundle commands given only `SUPERBEE_HOST` or
`SUPERBEE_ACCESS_TOKEN` retain `USAGE` and require `--host`. Login itself still needs host selection.
Device sign-in reports `waiting_for_confirmation`, its URL/code and resume command; `whoami` can
list pending flows before a default host exists. Refused state writes name the private path and
permission remedy. An existing `0700` private root avoids a redundant permission write.

A valid fragment-only Markdown target is emitted on an inert span as `data-aslite-fragment`.
Admission requires the bounded anchor-ID shape; a host adapter must map it to a known heading
before creating navigation. This does not establish live adapter behavior or permit arbitrary
HTML, images, or URL targets.

# Comparison with the published prerelease

Published `0.4.1-pre.1` is fixed at `4a5287c7396dec3418fed30d90a9f472e1df9f96`.
The stable comparison changes two READMEs, package version metadata, and its lockfile entry.
It contains no executable source change. Bundle formats and editions retain their existing
contracts; no new bundle migration is required by this patch. Source, package and artifact
identities differ between stable and prerelease even when executable source is unchanged.

# Fixed public implementation authorities

- [First-run sign-in commands and local status](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/cli/src/commands/hosted-auth.ts).
- [Sign-in state, explicit host selection, and pending flows](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/cli/src/hosted-auth/session.ts).
- [Private-state permission refusal and existing-root repair](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/cli/src/user-state.ts).
- [First-run and permission-recovery tests](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/cli/test/cli-first-run.test.ts).
- [Hosted catalog selection](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/cli/src/commands/catalog.ts).
- [Checkout host selection](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/cli/src/commands/checkout.ts).
- [Export host selection](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/cli/src/commands/export.ts).
- [Hosted publish preview and sign-in refusal](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/cli/src/commands/publish.ts).
- [Bounded Markdown fragment admission](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/markdown-renderer/src/index.tsx).
- [Fragment shape, bounds, percent-decoding, and inert-render tests](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/markdown-renderer/test/fragment-links.test.mjs).
- [Shipped hosted workflow guidance](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/superbee/references/hosted-checkout.md).
- [Package version, platform, and engine metadata](https://github.com/Holaxis-ai/superbee/blob/98669939db2f0549375cd43efa81c729088c309c/packages/superbee/package.json).

# Page review and verification limits

The complete source-path and release-event query selects 26 maintained pages after linking the
two document-rendering pages to their renderer source triggers. Eleven have an update disposition, including idempotent CLI-inventory regeneration; fifteen
retain their documented contract with an explicit reason. The upgrade guide is an additional
reviewed page because it explains the changed exit/status contract for existing automation. The coverage plan records the coupled
release scope and the independently retained architecture/diagram boundaries.

Installed-package probes ran on macOS with Node.js 26.8.2 and disposable local homes/bundles.
They verified identity and package bytes, successful first-run status/logout, absent private-state
creation by those reads, `AUTH_REQUIRED` first-run guidance, login and environment-selection
`USAGE` refusals, `RUNTIME`/`state_dir_not_writable` on an EACCES state write, and shipped help.
Browser-confirmation receipts and fragment admission are grounded in the fixed source and
committed tests above. Production OAuth, hosted writes/transfers, live AI-host restart,
Linux/native Windows execution, and live adapter fragment activation were not performed.
Architecture and rendering dependency pins retain their independent scope.

[Current changes, compatibility, and recovery](../releases/current.md)
