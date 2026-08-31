---
type: Guide
title: Create a bundle View
description: Author one safe responsive View for the local UI and MCP Apps hosts.
superbee_updated_by: openai/codex/root
---
# Goal

Author one durable, self-contained View that launches from both the local Superbee UI and an MCP
Apps host. This how-to is for bundle authors who already have a valid bundle and understand what
information the View should present.

View behavior is verified against [the current stable release](../sources/current-release.md).

# Decide whether a View is warranted

Use an ordinary document for durable prose, decisions, or instructions that render well as
Markdown. Use a View when interaction, visual grouping, live queries, or a bounded proposal flow
materially improves the human task.

Choose the least capable access level:

| Access | Intended use | Bundle capability |
| --- | --- | --- |
| `none` | Static diagram or self-contained explainer | No document data; registered View navigation only |
| `bundle-read` | Dashboard or live browser | Bounded read, render, edge, and subscription bridge |
| `bundle-propose` | Human-reviewed workflow control | Read bridge plus one narrow scalar-field proposal flow |

Every `bundle-propose` mutation is presented by trusted shell chrome and requires a separate human
Apply decision against the current target version. The View cannot commit directly.

# Prerequisites

- Confirm `superbee kinds` declares `View`. Install a View-bearing recipe if it does not.
- Keep HTML, CSS, and JavaScript in one file with no external resources.
- Design for narrow and expanded host panels.
- Bound queries and show loading, empty, partial, over-limit, stale, and error states.

# 1. Start from a working View

List installed View blobs and export a relevant example:

```sh
superbee blobs --prefix views/
superbee pull \
  --doc-key views/review-workflow/reviews.html \
  --out my-view.html
```

For `bundle-read` and `bundle-propose`, use Superbee's `postMessage` bridge. Request canonical
document rendering with `render-document`; do not embed a second Markdown parser. Treat `change`
events as invalidation signals and refetch current data.

# 2. Promote the exact HTML bytes

```sh
superbee promote my-view.html --doc-key views/my-view.html
```

Keep the returned blob version. The registry binds that exact byte version to the View identity.
Updating the HTML later requires `promote --expected-version <current-version>`.

# 3. Create the registry document

```sh
superbee new "View" my-view \
  --title "My view" \
  --entry views/my-view.html \
  --access bundle-read \
  --description "A live, bounded view of this bundle."
```

The View Kind places the document beneath `views-registry/` and records `entry_version`. Use
`type: View`, `entry`, `entry_version`, and `access`; the retired `Page` and `bridge` names do not
register current Views.

# 4. Validate and launch locally

```sh
superbee status
superbee view list
superbee ui --open
```

Confirm the View appears in the expected access group, loads with no external network dependency,
and remains usable at narrow and wide sizes. For a proposal View, start the UI with an actor:

```sh
superbee ui --open --actor openai/codex/root
```

Exercise one proposal and confirm the trusted shell shows before and after values, rejects a stale
target, and applies only after human confirmation.

# 5. Verify the same registry in an MCP host

Run host setup until the MCP capability is ready, then restart the host if setup requires it. Ask
the host to list the exact workspace's Views and show `views-registry/my-view`. The MCP launcher and
local UI must use the same registry ID, HTML bytes, access, and bridge contract.

Panel presentation is controlled by the host. If the host returns text without an App panel, use
`superbee ui --open` to verify the View while separately checking host integration status.

# Trust and runtime model

The local UI serves the iframe with `sandbox="allow-scripts"` and no same-origin privilege. A strict
View content security policy blocks ordinary direct network connections. The iframe receives a
short-lived nonce for its own admitted HTML, never the UI session credential. Data passes only
through the shell's bounded bridge.

Approval is tied to the View identity, exact HTML version, and declared access. Changed bytes or a
broader access declaration require a new decision. Closing the UI process revokes its session and
nonce. Persistent, ambient write grants are outside the View contract.

# Recovery

| Symptom | Response |
| --- | --- |
| View is missing from `view list` | Run `status`; correct its type, safe `views/` entry, access, or missing blob. |
| Registry version does not match the blob | Re-promote intentionally or recreate/update the registry from the current receipt. |
| Bundle calls return `FORBIDDEN` | Confirm the registry declares exactly `bundle-read` or `bundle-propose`; `none` fails closed. |
| A proposal is unavailable | Use local `--dir` UI with an actor; v1 proposals exclude remote mode and unsupported mutations. |
| A proposal is stale | Refresh the target and let the human review a newly prepared action. |
| Host panel does not render | Verify setup and restart requirements, then use the local UI as the independent reader. |

# Evidence and next actions

The full message protocol travels with the tagged
[View authoring reference](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/references/views/references/view-authoring-v0.md).
See [View contract and access](../reference/view-contract-and-access.md) for lookup details and
[View lifecycle and trust](../architecture/view-lifecycle-and-trust.md) for the system boundary.
