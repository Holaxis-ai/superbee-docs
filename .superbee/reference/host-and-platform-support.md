---
type: Reference
title: Host and platform support
description: >-
  Verified operating-system and AI-host integration support for the current
  stable Superbee release.
superbee_updated_by: 'process:node22-docs'
generated:
  by: 'process:node22-docs'
  at: '2026-10-13T13:12:16.142Z'
---
# Scope

Use this page to check whether the current stable Superbee release supports your operating system
and which integrations it can configure for your AI host. The facts below are verified against
[the current stable release evidence](../sources/current-release.md).

Run `superbee setup` in the host you want to configure. Setup inspects one host, reports the current
state, and proposes at most one action. A successful read-only plan does not prove that a live host
accepted the change. Restart that host when instructed, then rerun setup until it reports
`ready: true` and `complete: true`.

# Operating systems

| Platform | Current stable support | Requirement or limit |
| --- | --- | --- |
| macOS | Supported | Node.js 22, 24, or 26 (22.14.0 minimum) and npm are required. |
| Linux | Supported | Node.js 22, 24, or 26 (22.14.0 minimum) and npm are required. |
| Native Windows | Unsupported | Use WSL2 for the Linux CLI; native npm installation fails with `EBADPLATFORM`. |

Treat behavior present only on `main` as unreleased until the stable package evidence includes it.

# Node.js requirements

Use a supported Node.js 22, 24, or 26 release. The minimum is **22.14.0**; Node.js 24 is the
default development runtime. The package engine range is `^22.14.0 || ^24.0.0 || ^26.0.0`.
Node.js 20 and odd-numbered majors such as 23 and 25 are outside this support policy.

The [runtime policy](https://github.com/Holaxis-ai/superbee/blob/fa30ce771996f71f0d0b7f1db8c4d5414115f7ce/scripts/ci-lanes.json) and
[package engines](https://github.com/Holaxis-ai/superbee/blob/fa30ce771996f71f0d0b7f1db8c4d5414115f7ce/packages/superbee/package.json) govern these requirements.
The [CI floor smoke](https://github.com/Holaxis-ai/superbee/blob/fa30ce771996f71f0d0b7f1db8c4d5414115f7ce/.github/workflows/ci-tests.yml) runs the installed package on
Node.js 22.14.0.

These are the current project's runtime requirements. The [current release guide](../releases/current.md) and linked stable release evidence record
an older package with a Node.js 20 engine range; historical release requirements remain attached
to those versions. Use the runtime baseline above for new installations and upgrades.

# AI host integrations

| Host | Stable platform path | Agent Skill | MCP registration | SessionStart hook | Setup selector |
| --- | --- | --- | --- | --- | --- |
| Codex | macOS and Linux | Required | Required | Recommended | `codex` |
| Claude Code | macOS and Linux | Required | Required | Recommended | `claude-code` |
| Claude Desktop | macOS | Not available | Required | Not available | `claude-desktop` |
| OpenCode | macOS and Linux | Required | Required | Recommended | `opencode` |

Inspect one host explicitly:

```sh
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
```

The current setup conductor has no supported selector for Cursor or other hosts. The CLI can still
operate in a supported terminal environment, but that does not establish persistent Skill, MCP, or
hook integration for an unlisted host.

# What each integration contributes

OpenCode discovers the installed Superbee Skill through its Claude-compatible discovery path.
Rerun setup after upgrading so it can propose the required Skill installation or refresh.
This behavior is covered by the [stable setup implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.6/packages/cli/src/setup-plan.ts).

| Integration | Contribution |
| --- | --- |
| Installed CLI | Gives agents and humans the `superbee` command for bundle, document, structure, synchronization, and presentation operations. |
| Agent Skill | Teaches a supported coding agent when and how to use Superbee. |
| MCP registration | Lets a compatible host invoke Superbee's document and View presentation tools. |
| SessionStart hook | Orients a supported coding agent to the current project and selected bundle at session start. |
| Private workspace catalog | Makes a bundle available for explicit selection when an MCP session is not bound to a project. It does not activate that bundle in unrelated projects. |

# Verification and recovery

After applying a proposed setup command:

1. Restart the named host if setup says a restart is required.
2. Run the same host-scoped setup command in the restarted host.
3. Continue only when the result reports both `ready: true` and `complete: true`.

If setup cannot find the intended bundle, inspect selection with `superbee bundle locate`. Do not
create another bundle as a repair step. Continue with
[Setup and bundle resolution](../troubleshooting/setup-and-bundle-resolution.md) for symptom-first
recovery.

[Install and set up Superbee](../get-started/install-and-setup.md)

[CLI overview](cli-overview.md)

# Release contracts

The npm distribution supports macOS and Linux only. Native Windows npm upgrades fail with `EBADPLATFORM`; forcing installation does not restore
runtime support. WSL2 follows the Linux installation. The separate
[experimental Windows source build](https://github.com/Holaxis-ai/superbee-windows-cli) is unsupported
and is not a replacement package on npm. The core library's other storage backends are a separate
integration contract and do not restore native Windows CLI distribution.

The four AI host selectors stay `codex`, `claude-code`, `claude-desktop`, and `opencode` on supported
CLI platforms. Hosted Superbee is a storage/account destination, not a fifth AI host selector.
`setup hosted` signs in and chooses the default workspace. Optional turn-end sync is available for
Claude Code and Codex after explicit `hook install --turn-end-sync`; Git boards also require
`--git-boards`. Host registration readiness still requires the host restart and a fresh check.

Current stable release evidence.

# Distribution scope

The npm package targets `darwin` and `linux`, including WSL2's Linux environment. Use the Node.js
requirements above for new installations and upgrades. Native Windows remains excluded.
The separately installed stable package was probed on macOS only; Linux, native Windows, and live AI
host restart acceptance are not claimed by the release evidence.
