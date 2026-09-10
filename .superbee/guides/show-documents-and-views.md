---
type: Guide
title: Show documents and Views to a human
description: >-
  Display authoritative Markdown and safely launch interactive Views through the
  local browser or an MCP Apps host.
superbee_updated_by: release-docs-review
---
# Outcome

Display one bundle document as rendered Markdown, browse a complete bundle, or launch an
interactive View for a human. The command-line browser path works independently of an AI host.
The MCP path is available when the current host exposes Superbee's installed MCP Apps integration.

This guide is verified against
[the current stable release evidence](../sources/current-release.md). The examples assume that the
CLI is installed and that the intended bundle resolves in the current project.

# Choose the presentation

| Human need | Use |
| --- | --- |
| Read one authoritative Markdown document | `superbee doc open <id>` or MCP `show_document` |
| Browse documents, relationships, activity, and registered Views | `superbee ui --open` |
| Use an interactive bundle representation | A registered View in the local UI or MCP `show_view` |
| Show temporary interactive HTML created during the conversation | MCP `show_view` in transient mode |

A document is inert Markdown rendered by Superbee's bounded reader. A View contains executable HTML
and runs inside Superbee's constrained View runtime. Choose a document when interaction is
unnecessary.

# Open a document in the browser

Confirm the selected bundle and document before opening it:

```sh
superbee bundle locate
superbee doc read <id>
superbee doc open <id>
```

For a local bundle, `doc open` verifies the document, starts or reuses a managed loopback-only UI
for the selected bundle and actor, opens the document in the default browser, and returns. The
reader remains available after the launching command exits. Inspect and stop it explicitly:

```sh
superbee ui --status
superbee ui --stop
```

Use the same bundle and actor as the original launch when stopping it. If you passed `--actor`
or `--dir` to `doc open`, pass those values to `ui --stop` too.

The command prints a local URL. If the browser does not open automatically, copy that
URL into a browser on the same computer. The URL contains a live session credential, so keep it
private. The credential expires when the local UI process stops.

To browse the complete selected bundle, run:

```sh
superbee ui --open
```

`ui --open` and remote `doc open --remote <url>` remain foreground commands. Keep their terminal
running during use and press Ctrl-C when finished.

The bundle UI includes rendered documents, cross-links, backlinks, activity, sharing state, and
registered Views. Inspect the available Views from the terminal with:

```sh
superbee view list
```

For an explicit local bundle, add `--dir <path>` to each command. For a deployed remote bundle, use
`--remote <url>` on `doc open` or `ui`. Remote access is always explicit.

# Show a document through an MCP Apps host

First verify the current host integration:

```sh
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
```

Restart the named host after any Skill, hook, or MCP change reported by setup. Continue only after a
fresh setup run reports the required capabilities ready.

In a host that exposes the Superbee MCP tools and their App reader, ask the agent:

> Show document `<id>` from Superbee workspace `<label>`.

The agent can call `list_workspaces` when the label is unknown, then call `show_document` with the
exact workspace and document ID. `show_document` returns the authoritative document through
Superbee's fixed Markdown reader. It does not execute bundle-authored HTML and does not require View
authorization.

An MCP registration installed without `--dir` uses the private workspace catalog. The workspace
must be selected explicitly for each document or bundle-capable View. A catalog entry makes a
workspace available to MCP; it does not select that workspace for the current project. Fixed
`--dir` MCP registration remains a compatibility mode and omits the workspace argument.

# Show a View through an MCP Apps host

Ask the agent to list registered Views for the exact workspace, then launch one by its exact ID:

> List the Superbee Views in workspace `<label>`, then show `<view-id>`.

The agent uses `list_views` and `show_view`. A transient View instead supplies fresh HTML with
`mode: transient` and an explicit access level.

The access level controls what the executable View may request:

- `none` receives no bundle data. An explicit transient `none` View may be bundleless.
- `bundle-read` permits bounded reads after approval of the exact source and access.
- `bundle-propose` adds narrow mutation proposals. Each proposed write still requires a separate
  human confirmation and a current document version.

Registered MCP Views use bundle access and an explicitly selected workspace. The local browser UI
can also launch registered `none` Views. Approval applies to one exact View identity, byte version,
and access level. Reopen and review the current launch when its source or access changes.

The host decides how MCP App panels appear. Tool registration alone does not prove that a particular
host version will render an App panel. Use `superbee doc open <id>` or `superbee ui --open` when the
host exposes text-only MCP results or lacks MCP Apps presentation.

# Verify the result

For a document, confirm that the title and body match:

```sh
superbee doc read <id> --out -
```

For a registered View, confirm that it is available and valid:

```sh
superbee view list
superbee status
```

`status` reports invalid View registrations and missing View entry blobs. The browser and MCP
launchers also recheck the admitted bytes and access before use.

# Recover from common failures

| Symptom | Recovery |
| --- | --- |
| `doc open` reports a missing or malformed document | Run `superbee list` and `superbee doc read <id>`. Correct the ID or document frontmatter before opening it. |
| A browser does not open | Use the printed local URL while the UI is available. Check that a system browser opener is installed. |
| The wrong bundle appears | Run `superbee bundle locate`. Retry with the intended explicit `--dir <path>`. |
| Superbee tools are absent in the AI host | Rerun host-scoped `superbee setup`, apply its one proposed command with approval, restart when requested, and verify again. |
| The MCP workspace is absent | Run `superbee catalog list`, then explicitly register the intended local bundle with `superbee catalog add <label> --dir <path>`. Retry `list_workspaces`. |
| A View ID is unknown | Run `superbee view list` or MCP `list_views`, then use an exact listed ID. |
| A View changed or its approval is stale | Close the failed launch, inspect the current View and access, then launch and approve the current bytes. |
| A registered View has no entry or has invalid registration fields | Run `superbee status` and correct the reported registry document or entry blob. |

See [Troubleshoot setup and bundle resolution](../troubleshooting/setup-and-bundle-resolution.md)
for selection and installation failures. See
[View lifecycle and trust](../architecture/view-lifecycle-and-trust.md) for the complete execution,
approval, and revocation model.

# Evidence

The managed local lifecycle is defined by the [stable UI implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.6/packages/cli/src/commands/ui.ts)
and [managed-authority tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.6/packages/cli/test/ui-managed-authority.test.ts).

The browser procedure is grounded in the tagged
[`doc open` implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/ui.ts)
and its
[Tagged integration tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/ui.test.ts).
MCP behavior is grounded in the tagged
[`show_document` and `show_view` server](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/mcp-app/src/server.ts)
and
[Tagged server tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/mcp-app/test/server.test.ts).
