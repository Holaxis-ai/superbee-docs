---
type: Source
title: Superbee 0.1.3 release evidence
description: >-
  Immutable package, source, compatibility, and disposable-journey evidence for
  the first documentation slice.
resource: 'https://registry.npmjs.org/superbee/-/superbee-0.1.3.tgz'
superbee_updated_by: openai/codex
---
# Evidence identity

| Field | Verified value |
| --- | --- |
| npm package | `superbee@0.1.3` |
| npm dist-tags observed 2026-08-28 | `latest: 0.1.3`, `next: 0.1.3` |
| npm integrity | `sha512-a+2U4mTcv6XD+gsh6XM/ul963mwqq52WiHFxhDkjbMft+mHM3zxE/jTNHTOf17r7gFLCbTTgj/+8tfW6q1uFdQ==` |
| npm tarball | `https://registry.npmjs.org/superbee/-/superbee-0.1.3.tgz` |
| source tag | `v0.1.3` |
| source commit | `f4e1c37349627030f8201ff52028f71a9c92570a` |
| built CLI artifact SHA-256 | `sha256:9d8f070c29e71da4e9499bd55d60099f488d69765c76c2cf7e42b41cc8372061` |
| Node requirement | `>=20` |
| npm platform metadata | excludes `win32` |

# Public authorities

- Package: `https://www.npmjs.com/package/superbee/v/0.1.3`
- Source: `https://github.com/Holaxis-ai/superbee/tree/v0.1.3`
- Release commit: `https://github.com/Holaxis-ai/superbee/commit/f4e1c37349627030f8201ff52028f71a9c92570a`

# Verification performed

The exact npm package was installed into an isolated global prefix and invoked from its installed
binary. Its `version` receipt agreed with the source commit and artifact hash above.

Read-only setup plans were exercised for Codex, Claude Code, Claude Desktop, and OpenCode. Each plan
returned the documented host capability matrix, a single next action, a verification command, and
the integrations requiring restart.

A disposable project then exercised:

1. `init --create-only --dir .superbee` with the default context-notes recipe;
2. generic typed document creation;
3. exact document read;
4. conventional-folder discovery from the project root;
5. `home --no-update-check`; and
6. `status` with zero reported conformance findings.

The document-open behavior is additionally grounded in generated `0.1.3` CLI help and the tagged
implementation, which verifies the document before launching the existing local UI's exact DocPage
route through the shared renderer.

# Limits of this evidence

- The isolated-prefix setup probe intentionally did not mutate real host configuration.
- Live Skill, MCP, hook, and restart success remains host-specific and is verified by rerunning the
  setup conductor in that actual host.
- Windows is not claimed: npm's stable `0.1.3` package metadata excludes `win32`.
- This record establishes released behavior only. Later source on `main` is not stable-package
  evidence until it is published and independently identified.

[supports install and setup](../get-started/install-and-setup.md)

[supports the first durable workspace](../get-started/first-durable-workspace.md)
