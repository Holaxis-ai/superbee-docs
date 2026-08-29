---
type: Guide
title: Install and set up Superbee
description: >-
  Install the released CLI and let the read-only setup conductor verify one
  exact AI host.
superbee_updated_by: openai/codex
---
# Outcome

Install the released Superbee CLI, let Superbee inspect one selected AI host, and finish with the
host's required integrations verified. The setup conductor proposes one change at a time and never
edits host configuration by itself.

This tutorial is verified against
[the current stable release evidence](../sources/current-release.md).

# Before you start

You need:

- Node.js 20 or newer;
- npm;
- a platform listed as supported by the [current release](../releases/current.md); and
- one supported host: Codex, Claude Code, Claude Desktop, or OpenCode.

Use the current release record and npm package metadata to determine platform support. Source and
prerelease support become stable-package capabilities only when the release evidence includes them.

# 1. Install the CLI

Run:

```sh
npm install -g superbee
```

Then inspect the installed identity:

```sh
superbee version
```

The output identifies package `superbee`, channel `npm-package`, and a version and source commit that
agree with the [current release evidence](../sources/current-release.md).

If `superbee` is not found, make sure npm's global binary directory is on `PATH`, then open a fresh
terminal. Do not use `npx` for persistent host integrations: MCP, Skills, and hooks need an
installed executable.

# 2. Ask your agent to conduct setup

In the host you want to use, ask:

> Set up Superbee for this host. Run `superbee setup`, explain the next proposed command, ask
> before applying it, restart the host whenever setup requires it, and rerun setup until it verifies
> the installation.

Without a host flag, `superbee setup` reports private-state health and asks the agent to select one
of the four supported hosts. The selected inspection is explicit:

```sh
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
```

Setup is read-only. It reports capability state and at most one `next.command`. The agent should:

1. explain what the proposed command will change;
2. obtain your approval when it mutates configuration;
3. run it unchanged, filling only a placeholder that setup explicitly identifies;
4. restart the named host after Skill, MCP, or hook changes; and
5. rerun the same host-scoped setup command.

Repeat until setup reports both `ready: true` and `complete: true`.

# What setup verifies

| Capability | Codex | Claude Code | Claude Desktop | OpenCode |
| --- | --- | --- | --- | --- |
| Installed npm CLI | required | required | required | required |
| Agent Skill | required | required | not available | not available |
| MCP registration | required | required | required | required |
| SessionStart orientation hook | recommended | recommended | not available | recommended |
| Current project bundle | recommended | recommended | recommended | recommended |
| Private workspace catalog | required for bundle-unbound MCP selection | required for bundle-unbound MCP selection | required for bundle-unbound MCP selection | required for bundle-unbound MCP selection |

The catalog makes a workspace available for explicit selection. It never makes that workspace the
active context of an unrelated project.

# Legacy installations

If setup returns `superbee setup migrate-state`, inspect and run the returned command. It copies only
validated private catalog, remote-credential, and immutable View-approval state into Superbee's
current private-state root. It does not move bundles or delete legacy bytes.

Existing `.agentstate-lite/` bundles and supported `.agentstate.json` bindings remain usable in
place. After setup has replaced the named legacy integrations, the old global package can be removed:

```sh
npm uninstall -g @holaxis/aslite
```

# Verification

Setup is complete only when a fresh run for the same host and scope reports no required action. After
a host restart, ask the agent to run the verification command again. The previous session cannot
verify the restarted host.

Continue with [Create your first durable workspace](first-durable-workspace.md).
