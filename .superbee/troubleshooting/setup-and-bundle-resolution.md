---
type: Guide
title: Troubleshoot setup and bundle resolution
description: >-
  Diagnose installation, host setup, workspace selection, and local bundle
  health from their owning command receipts.
superbee_updated_by: openai/codex
---
# Outcome

Identify whether a failure comes from the installed CLI, host setup, project bundle selection, or
bundle health, then use the owning command's recovery guidance. This page is written for the
current stable release and its supported platforms.

Start with [Install and set up Superbee](../get-started/install-and-setup.md) if Superbee has never
worked in this host. The examples below use macOS or Linux shell commands. Check
[the current release](../releases/current.md) before assuming another platform is supported.

# Collect the four useful receipts

Run these from the project where Superbee should be active:

```sh
superbee version
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
superbee bundle locate
superbee status
```

Each command answers a separate question:

| Command | Question |
| --- | --- |
| `version` | Which package, source commit, and installed executable are running? |
| `setup` | Which host capability needs the next action? |
| `bundle locate` | Which exact local bundle would a bare command use? |
| `status` | Is the selected bundle structurally healthy? |

If `bundle locate` fails, continue with the bundle-selection symptoms below. If it succeeds, use the
reported path in an explicit `--dir <path>` while diagnosing subsequent commands.

# `superbee` is missing or the wrong build runs

Inspect the runtime and npm prefix:

```sh
command -v node
command -v superbee
npm prefix --global
superbee version
```

Install the persistent CLI when it is absent:

```sh
npm install -g superbee
```

Open a fresh terminal and run `superbee version` again. Persistent Skills, hooks, and MCP
registrations require the durable global installation. If setup emits an `inspect` command for an
npm-prefix or runtime mismatch, run that command first. Repeated installation into a different npm
prefix will not repair the executable used by the host.

# Setup keeps returning another command

Setup is a read-only conductor. It reports one next action in dependency order. A partially
configured host normally requires several cycles:

1. Read the reported capability, reason, and `next.command`.
2. Approve the exact change when it mutates configuration.
3. Run that command unchanged, filling only an explicit placeholder such as a catalog label.
4. Restart the host when the `restart` field names an affected integration.
5. Rerun the same host-scoped setup command.

The setup journey is complete when a fresh run reports both `ready: true` and `complete: true`.

If setup reports `foreign`, `unmanaged`, `blocked`, or a newer compatibility contract, run the
read-only status command it provides. Preserve unknown files and registrations until their owner is
understood. Setup refuses to replace foreign configuration automatically.

If setup reports validated legacy private state, inspect and run:

```sh
superbee setup migrate-state
```

This copies recognized private operational records into the current Superbee state root. Bundles
and legacy bytes stay in place.

# No local bundle is found

Run `superbee bundle locate` from the intended project root. A local command resolves the bundle in
this order:

1. an explicit `--dir <path>`;
2. the nearest project binding, `.superbee.json` or the compatible `.agentstate.json`;
3. the nearest enclosing bundle or conventional `.superbee/` or `.agentstate-lite/` directory.

Choose the intended ownership and sharing boundary before creating a bundle. For a confirmed new
local workspace, follow [Create your first durable workspace](../get-started/first-durable-workspace.md).
For an existing bundle elsewhere on disk, point the project to it with one committed local binding:

```json
{
  "bundle": "../shared-project/.superbee"
}
```

A relative binding path is resolved from the directory containing the binding file. If a binding
points to a missing directory, correct its path or restore the intended bundle. Create a new bundle
at that target only after confirming that the missing target was meant to be new.

# The wrong bundle is selected

Inspect the selection receipt:

```sh
superbee bundle locate --json
```

The `selected_by` value identifies `explicit-dir`, `project-binding`, or `discovery`. Retry the
original command with `--dir <intended-path>` to prove the intended bundle works before changing a
binding.

Check every ancestor between the current directory and the filesystem root for `.superbee.json` or
`.agentstate.json`. The nearest binding wins. A private workspace catalog entry has no role in bare
CLI selection and never becomes ambient project context.

Two binding files at the same directory level are an explicit conflict. Keep the one that expresses
the current project decision and move the other outside the project. Two conventional bundle
directories at the same level also cause a conflict. Confirm which bundle owns the project before
moving either one.

# A binding reports malformed JSON, an unavailable path, or a URL

A binding must be a regular JSON file with one non-empty local filesystem path:

```json
{
  "bundle": "../shared-project/.superbee"
}
```

Fix invalid JSON or the `bundle` field named in the error. URL-valued bindings are rejected because
remote access requires an explicit choice on each command:

```sh
superbee <command> --remote <url>
```

Use `--dir <path>` to bypass a faulty binding temporarily while repairing the committed project
configuration.

# Setup is ready, yet the AI host has no Superbee tools

Inspect the exact host registration:

```sh
superbee mcp status --host <codex|claude-code|claude-desktop|opencode>
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
```

Restart the host after MCP, Skill, or hook changes. Run setup again in the fresh session. Host setup
verifies registration state; successful MCP App rendering still depends on the host version and its
MCP Apps support. Use the browser presentation path in
[Show documents and Views to a human](../guides/show-documents-and-views.md) when the host does not
render App panels.

# The MCP server cannot find the intended workspace

Inspect the private catalog:

```sh
superbee catalog list
```

Register the intended local bundle explicitly:

```sh
superbee catalog add <label> --dir <path>
```

Then ask the agent to call `list_workspaces` and select that exact label or ID. Catalog registration
does not change the current project's bundle and does not authorize reading another workspace as
project context.

# The selected bundle opens, then a command fails

Run:

```sh
superbee status --limit 0
```

Resolve malformed frontmatter first. Then inspect the category named by the command or report, such
as unresolved links, Kind warnings, invalid View registrations, or missing View entry blobs.
`status` reports findings and exits successfully after analysis, so automation should inspect its
structured fields instead of using only the process exit code.

Use the exact command help for the failing surface:

```sh
superbee <command> --help
```

For document or View presentation failures, continue with the
[presentation recovery guide](../guides/show-documents-and-views.md).

# Evidence

These procedures are verified against
[the current stable release evidence](../sources/current-release.md), the tagged
[`0.1.3` setup planner](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/src/setup-plan.ts),
[`0.1.3` setup tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/test/setup-plan.test.ts),
[`0.1.3` bundle resolver](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/src/bundle.ts),
and
[`0.1.3` locator tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/test/bundle-locate.test.ts).
Bundle-health behavior is grounded in the tagged
[`status` implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/src/commands/status.ts)
and
[`status` tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/test/status.test.ts).
