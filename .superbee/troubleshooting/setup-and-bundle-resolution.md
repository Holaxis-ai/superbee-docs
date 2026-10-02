---
type: Guide
title: Troubleshoot setup and bundle resolution
description: >-
  Diagnose installation, host setup, workspace selection, and local bundle
  health from their owning command receipts.
superbee_updated_by: 'process:release-docs-preparation'
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T19:53:30.753Z'
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

Set `stable_version` from [the verified stable release](../releases/current.md), following
[the installation guide](../get-started/install-and-setup.md). Then run:

```sh
: "${stable_version:?Set stable_version to the version in the verified stable release}"
npm install -g "superbee@$stable_version"
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

In a fresh clone, a committed binding to `.superbee` can name a directory that does not exist yet.
If the project shares a dedicated `board` branch, run `superbee sync` from the project root to
provision it at the bound path instead of initializing a new bundle. See
[Share and synchronize a Git-backed bundle](../guides/share-and-synchronize-git-bundle.md).

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
[Tagged setup planner](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/setup-plan.ts),
[Tagged setup tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/setup-plan.test.ts),
[Tagged bundle resolver](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/bundle.ts),
and
[Tagged locator tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/bundle-locate.test.ts).
Bundle-health behavior is grounded in the tagged
[`status` implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/status.ts)
and
[`status` tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/status.test.ts).

# Release contracts

Native Windows `EBADPLATFORM` is the distribution boundary, not a missing npm prefix.
Forcing installation will not restore support. WSL2 is the normal Linux route; preserve existing
files before moving work. See [Host and platform support](../reference/host-and-platform-support.md) for the release matrix.

If `home`, `status`, or `bundle locate` reports `copy_of_checkout`, the folder was moved/copied and
is not bound to hosted state here. Do not initialize a replacement or route from the marker.
Follow [Hosted checkout recovery](hosted-checkout.md) for adoption and workspace proof.
`AUTH_REQUIRED`, `choose_workspace`, held deletions, and hosted conflicts also belong to that guide.

For a fresh clone with a conventional shared-board binding, the orientation and setup
retain the shared-board path. Follow the returned sync recovery; `init` is reserved for a confirmed
new local bundle. Unavailable hook launchers are reported as unsupported by setup rather than as a
ready integration.

[Current stable release evidence](../sources/current-release.md).

# Prepared malformed-file recovery

With [the prepared release](../releases/next-release.md), a malformed document can be listed as a
skipped ID while readable documents remain available. Run `doc read <id>` for the named parse
error, preserve the file, and repair its YAML. Complete heads/snapshot reads still fail on malformed
content instead of interpreting the missing record as deletion. Repair the document before using
that bundle as a complete synchronization source.
