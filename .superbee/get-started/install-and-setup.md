---
type: Guide
title: Install and set up Superbee
description: >-
  Install the released CLI and let the read-only setup conductor verify one
  exact AI host.
superbee_updated_by: openai/codex
---
# Outcome

Install the released Superbee CLI, let Superbee inspect one exact AI host, and finish with the
host's required integrations verified. The setup conductor proposes one change at a time and never
edits host configuration by itself.

This tutorial is verified against `superbee@0.1.3`, released from source commit
`f4e1c37349627030f8201ff52028f71a9c92570a`.

# Before you start

You need:

- Node.js 20 or newer;
- npm;
- macOS or Linux for the released `0.1.3` package; and
- one supported host: Codex, Claude Code, Claude Desktop, or OpenCode.

The published `0.1.3` package explicitly excludes Windows. Windows support may exist in newer source
or prerelease work, but it is not a stable-package capability until the npm release metadata says so.

# 1. Install the CLI

Run:

```sh
npm install -g superbee
```

Then inspect the installed identity:

```sh
superbee version
```

For this verified release, the output identifies package `superbee` version `0.1.3`, channel
`npm-package`, and source commit `f4e1c37349627030f8201ff52028f71a9c92570a`.

If `superbee` is not found, make sure npm's global binary directory is on `PATH`, then open a fresh
terminal. Do not use `npx` for persistent host integrations: MCP, Skills, and hooks need a durable
installed executable.

# 2. Ask your agent to conduct setup

In the host you want to use, ask:

> Set up Superbee for this exact host. Run `superbee setup`, explain the next proposed command, ask
> before applying it, restart the host whenever setup requires it, and rerun setup until it verifies
> the installation.

Without a host flag, `superbee setup` reports private-state health and asks the agent to select one
of the four supported hosts. The selected inspection is explicit:

```sh
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
```

Setup is read-only. It reports capability state and at most one `next.command`. The agent should:

1. explain what that exact command will change;
2. obtain your approval when it mutates configuration;
3. run it unchanged, filling only a placeholder that setup explicitly identifies;
4. restart the named host after Skill, MCP, or hook changes; and
5. rerun the same host-scoped setup command.

Repeat until setup reports both `ready: true` and `complete: true`.

# What setup verifies

| Capability | Codex | Claude Code | Claude Desktop | OpenCode |
| --- | --- | --- | --- | --- |
| Durable npm CLI | required | required | required | required |
| Agent Skill | required | required | not available | not available |
| MCP registration | required | required | required | required |
| SessionStart orientation hook | recommended | recommended | not available | recommended |
| Current project bundle | recommended | recommended | recommended | recommended |
| Private workspace catalog | required for bundle-unbound MCP selection | required for bundle-unbound MCP selection | required for bundle-unbound MCP selection | required for bundle-unbound MCP selection |

The catalog makes a workspace available for explicit selection. It never makes that workspace the
active context of an unrelated project.

# Legacy installations

If setup returns `superbee setup migrate-state`, inspect and run that exact command. It copies only
validated private catalog, remote-credential, and immutable View-approval state into Superbee's
current private-state root. It does not move bundles or delete legacy bytes.

Existing `.agentstate-lite/` bundles and supported `.agentstate.json` bindings remain usable in
place. After setup has replaced exact legacy integrations, the old global package can be removed:

```sh
npm uninstall -g @holaxis/aslite
```

# Verification

Setup is complete only when a fresh run for the same host and scope reports no required action. If
the host was restarted, ask the agent to run the verification command again rather than relying on
the previous session's result.

Continue with [Create your first durable workspace](first-durable-workspace.md).

[release evidence](../sources/superbee-release-0.1.3.md)

# Re-evaluate this page when

- npm's `latest` version or package platform metadata changes;
- the supported host list changes;
- setup's capability requirements or completion fields change; or
- the durable installation command changes.
