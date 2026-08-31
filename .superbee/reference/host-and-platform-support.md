---
type: Reference
title: Host and platform support
description: >-
  Verified operating-system and AI-host integration support for the current
  stable Superbee release.
superbee_updated_by: openai/codex/root
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
| macOS | Supported | Node.js 20 or newer and npm are required. |
| Linux | Supported | Node.js 20 or newer and npm are required. |
| Windows | Supported | Node.js 20 or newer and npm are required. Private state uses the user's LocalAppData boundary. |

Treat behavior present only on `main` as unreleased until the stable package evidence includes it.

# AI host integrations

| Host | Stable platform path | Agent Skill | MCP registration | SessionStart hook | Setup selector |
| --- | --- | --- | --- | --- | --- |
| Codex | macOS, Linux, and Windows | Required | Required | Recommended | `codex` |
| Claude Code | macOS, Linux, and Windows | Required | Required | Recommended | `claude-code` |
| Claude Desktop | macOS and Windows | Not available | Required | Not available | `claude-desktop` |
| OpenCode | macOS, Linux, and Windows | Not available | Required | Recommended | `opencode` |

Inspect one host explicitly:

```sh
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
```

The current setup conductor has no supported selector for Cursor or other hosts. The CLI can still
operate in a supported terminal environment, but that does not establish persistent Skill, MCP, or
hook integration for an unlisted host.

# What each integration contributes

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
