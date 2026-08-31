---
type: Guide
title: Verify host setup
description: >-
  Confirm what setup changed and test the CLI, Skill, hook, MCP, and MCP Apps
  surfaces in a restarted host.
superbee_updated_by: openai/codex/root
---
# Outcome

Understand each change proposed by `superbee setup`, verify the installed CLI, Skill, hook, and MCP
registration, then test the MCP tools and App panels in a restarted host. This how-to is for someone
who has completed [Install and set up Superbee](install-and-setup.md) for one supported host.

The commands and expected states below apply to
[the current stable release](../releases/current.md). The examples use user scope, which is the
default for setup.

# What the setup commands change

`superbee setup` is read-only. It inspects one selected host and returns at most one
`next.command`. These are the persistent installation commands it can propose:

| Surface | Command | Change |
| --- | --- | --- |
| CLI | `npm install -g superbee` | Installs the released `superbee` package and a durable global executable. |
| Agent Skill | `superbee skill install --scope user` | Copies the package's `SKILL.md`, references, and ownership manifest into the configured Claude Code and Codex Skill folders. One invocation processes both supported Skill hosts. |
| SessionStart hook | `superbee hook install --scope user` | Adds the managed `session-start` launch to Claude Code and Codex, enables Codex hooks, and writes the managed OpenCode plugin. One invocation processes all three supported hook hosts. |
| MCP | `superbee mcp install --host <host>` | Adds one user-level `superbee` MCP registration to the selected host. The launch uses the durable Node and package paths and carries no bundle directory. |

Skill and hook commands honor `--scope project|user`. MCP registration is always user-level and
host-specific. Setup also inspects Superbee's private operational state, the current project bundle,
and the private workspace catalog. A catalog entry makes a workspace available for explicit MCP
selection. It does not select that workspace as the current project's context.

Use [Host and platform support](../reference/host-and-platform-support.md) for the current stable
host matrix, operating-system limits, and required or recommended surfaces. App panel support must
be tested separately because it also depends on the host version.

Restart the selected host after a Skill, hook, or MCP change. Verification in an already running
session cannot establish that the host loaded the new integration.

# 1. Verify the CLI identity

Run:

```sh
superbee version --json
```

For the stable npm installation, confirm:

- `identity.package.name` is `superbee`;
- `identity.artifact.channel` is `npm-package`;
- `identity.package.version`, `identity.source.commit`, and `identity.artifact.sha256` agree with
  [the current release evidence](../sources/current-release.md); and
- `identity.runtime.launch_confidence` is `certain`.

If the command is missing or the identity disagrees, reinstall from the npm prefix owned by the
running Node installation. Follow the exact inspection command returned by setup when it reports a
prefix or runtime mismatch.

# 2. Verify the Agent Skill

This step applies to Codex and Claude Code:

```sh
superbee skill status --scope user --json
```

Inspect the selected host at `skill.hosts.codex` or `skill.hosts.claude_code`. Its
`canonical.state` should be `installed`, and its compatibility state should be `current`. A
`stale` state means the managed files do not match the running CLI. Run the exact Skill install
command returned by setup and restart the host.

`skill status` compares the installed manifest and bytes with the running package. It does not
observe whether an already running host loaded those bytes. Start a fresh session for that check.
The stable release has no cross-host CLI receipt for Skill activation inside a live session.

# 3. Verify the SessionStart hook

This step applies to Codex, Claude Code, and OpenCode:

```sh
superbee hook status --scope user --json
```

Inspect `hook.hosts.codex`, `hook.hosts.claude_code`, or `hook.hosts.opencode` for the selected host.
Its `state` should be `current`. The managed hook runs `superbee session-start`, which performs a
time-boxed best-effort board pull and renders Superbee orientation at the beginning of an agent
session.

Start a fresh session after installation. The host should receive the SessionStart orientation when
it exposes injected startup context. The CLI status confirms the owned configuration and exact
launch form. The stable release has no cross-host receipt proving that a particular host process
executed the hook.

# 4. Verify the MCP registration

Use the selected host ID:

```sh
superbee mcp status --host <codex|claude-code|claude-desktop|opencode> --json
```

The single row at `mcp_status.hosts[0]` should report `state: "owned_current"`. This state means the
host registration has Superbee's managed shape and matches the durable runtime and package paths.
It does not prove that the host connected to the server.

An `absent` or `owned_stale` registration can be repaired with the host-specific install command
returned by setup. A `foreign`, `known_legacy`, `unverified`, or `unreadable` state requires
inspection. Preserve the existing registration until its owner and launch shape are understood.

# 5. Exercise the MCP tools and App panels

Restart the host, then ask its agent:

> Use Superbee's `list_workspaces` tool. Select the exact workspace label I provide and use
> `show_document` to display the document ID I provide.

Choose the label and document ID before running the test:

```sh
superbee catalog list
superbee list --limit 5 --dir <bundle-path>
```

A successful `list_workspaces` call confirms the host connected to Superbee's bundle-unbound MCP
server. The result contains stable workspace IDs, labels, display names when safe, and availability.
It does not expose filesystem paths. A successful `show_document` call confirms document selection
and the MCP tool result. A rendered Superbee Document Reader panel additionally confirms that the
host loaded the document App resource.

To test the View App resource, first find a registered View:

```sh
superbee view list --dir <bundle-path>
```

Ask the agent to call `list_views` for the selected workspace and then call `show_view` with one
exact returned View ID. A rendered Superbee View panel confirms the View App resource. A View with
`bundle-read` or `bundle-propose` access asks the human to trust its exact current bytes before
bundle data is exposed.

Tool success without an App panel establishes MCP transport and tool execution. It does not
establish MCP Apps rendering. Panel rendering depends on the installed host version and its MCP
Apps support. Use the browser path in
[Show documents and Views to a human](../guides/show-documents-and-views.md) when the host does not
render App panels.

# 6. Read the final setup receipt

Run the same host and scope inspection in the restarted session:

```sh
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user --json
```

A complete setup reports:

- `setup.ready: true` for all required capabilities;
- `setup.complete: true` after recommended capabilities are ready or unavailable for that host;
- no `setup.next`; and
- `setup.verify.command` names the same host and scope you just inspected. Output-format flags such
  as `--json` are not included in that verification command.

`ready: true` can appear while a recommended hook still needs attention. Use `complete: true` as the
end of the full setup loop.

If setup remains incomplete, follow
[Troubleshoot setup and bundle resolution](../troubleshooting/setup-and-bundle-resolution.md).
Continue with [Create your first durable workspace](first-durable-workspace.md) when the selected
host is complete.

# Evidence

This page is grounded in [the stable release evidence](../sources/current-release.md), the tagged
[`setup` planner](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/setup-plan.ts)
and
[`setup` agreement tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/setup-plan.test.ts),
the tagged
[`skill` command](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/skill.ts),
[`hook` command](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/hook.ts),
and
[`MCP registration`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/mcp-registration.ts).
The live tool and panel checks follow the tagged
[`MCP Apps server`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/mcp-app/src/server.ts)
and
[`MCP Apps contract tests`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/mcp-app/test/server.test.ts).
