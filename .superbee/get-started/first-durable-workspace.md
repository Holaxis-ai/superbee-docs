---
type: Guide
title: Create your first durable workspace
description: >-
  Preserve report-format reasoning, recheck changed input in a fresh session,
  and update the saved decision safely.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-05T02:00:47.733Z'
---
# Outcome

Use an agent to preserve why a small reporting project chose CSV, then continue the work in a new
session after the input changes. You finish with an inspectable decision and a later answer that
uses the saved reasoning while checking the current source.

This tutorial uses the [current stable release recorded by these docs](../sources/current-release.md).
It demonstrates continuity and source checking; it does not measure accuracy or token savings.

# Before you start

- Complete [Install and set up Superbee](install-and-setup.md).
- Use Codex or Claude Code with the Superbee Skill installed, or use the CLI checkpoints below.
- Open an empty test project and keep this exercise local.

Run `superbee home`. If it already selects a bundle, use that workspace or choose an empty test
project. Do not initialize a second bundle. A catalog entry elsewhere is not this project's context.

# 1. Give the agent a small, concrete project

Save this file as `report-input.json` in the test project's root, outside any bundle:

```json
{
  "rows": 120,
  "delivery": "spreadsheet",
  "tables": 1
}
```

It represents a weekly report that a colleague wants to inspect in a spreadsheet. The initial
decision is to produce CSV because the deliverable is a simple table and the recipient can inspect
it directly. The file is the authority for the current row count and input shape; the decision's
reason belongs in durable context.

Ask your agent:

> Create a local Superbee workspace in this empty project. Preserve our decision to deliver the
> weekly report as CSV because the recipient needs a spreadsheet and the input is one simple
> table. Cite report-input.json and distinguish its observed values from current state. Revisit the
> decision if the delivery requirement or table structure changes. Use supported Superbee commands
> for writes, keep it local, and show me the saved decision.

The agent should inspect the project before creating anything. The equivalent local initialization
is:

```sh
superbee init --create-only --dir .superbee
```

This creates an OKF v0.2 bundle with the default Context Note recipe. It refuses an occupied,
nested, bound, symlinked, or concurrently claimed target. Nothing is shared by initialization.

# 2. Inspect what became durable

A plain Decision document is sufficient; this example does not need a new Kind. Save this body in
a temporary file outside the bundle, for example `/tmp/report-decision.md`:

```md
# Decision

Deliver the weekly report as CSV so the recipient can inspect it in a spreadsheet.

# Basis and applicability

The initial report-input.json has 120 rows, delivery "spreadsheet", and one table.
Those are observations of the supplied fixture, not a promise about later input.
The current file remains the authority for row count and input shape.

Revisit this decision if the delivery requirement or table structure changes.
```

The CLI checkpoint is:

```sh
superbee doc write decisions/report-format \
  --type Decision \
  --title "Deliver the report as CSV" \
  --body-file /tmp/report-decision.md \
  --actor openai/codex
superbee doc read decisions/report-format
superbee status
superbee doc open decisions/report-format
```

Use the agent's actual actor identity. OKF v0.2 accepts `human:<id>`, `process:<id>`, or
`<producer>/<version>`, such as `openai/codex` or `anthropic/claude`. The receipt identifies the saved
document. In an MCP Apps host, the agent can use Superbee's document-display tool instead of opening
the local reader.

Check that the decision contains the reason and its applicability, and that `status` reports no
malformed document or Kind warning caused by the exercise. A clean status checks structure; compare
the stated observations with `report-input.json` yourself to check their truth.

# 3. Change the source and start a fresh session

Replace the project file `report-input.json` with:

```json
{
  "rows": 750,
  "delivery": "spreadsheet",
  "tables": 1
}
```

Start a new agent session in the same project. Do not paste the earlier conversation. Ask:

> Continue the weekly report project. Find our saved format decision, check report-input.json, and
> tell me the current row count and whether the decision's stated assumptions still hold. Do not
> treat the saved observations as current facts. Show the decision you used.

The observable result is **750 current rows**, with the earlier 120-row observation identified as
historical. The spreadsheet delivery and one-table assumptions still hold. The saved rationale is
available without the first conversation, and the current facts come from the current file.

CLI checkpoints for discovery and retrieval are:

```sh
superbee home
superbee list --type Decision
superbee doc read decisions/report-format
```

The agent still needs to read `report-input.json` with its host's ordinary file-reading capability.
Superbee does not automatically track that file or invalidate conclusions when it changes. If the
agent returns 120 as current, ask it to compare the claim with the source and correct its answer.
An agent that cannot read the source must report that limitation.

# 4. Keep the useful reasoning and update it safely

Ask the agent to add the new observation to the decision while retaining the initial basis:

> Update the saved decision to record that the latest report-input.json has 750 rows and that the
> delivery and table assumptions still hold. Preserve the original observation as history. Export
> the complete body to a temporary file outside the bundle, edit that file, and apply the change
> with the version from the same read and your actor. Then read back and show the result.

For the direct edit cycle and conflict recovery, follow
[Updating an existing handoff](../guides/preserve-context-between-sessions.md#updating-an-existing-handoff).
`doc update` replaces a supplied body in full; it is not a line patch. Never use a truncated preview
as the replacement or prepend YAML frontmatter to a body-only export. Routine agent document writes
should use supported Superbee mutations. Read-only Markdown inspection remains useful.

Remove your temporary body file after checking the saved result. For a concise session handoff,
use [Preserve context between sessions](../guides/preserve-context-between-sessions.md).

# What the example establishes

- The decision and its rationale survive the first session as user-owned Markdown.
- A later participant can discover and inspect that rationale.
- Current input is checked separately from saved observations.
- Source changes prompt a review of the conclusion's assumptions.

This is a small continuity exercise. It does not show that a knowledge bundle improves every task,
that saved reasoning is always correct, or that an agent will always follow the workflow. Use
[recurring domain modeling](../guides/model-recurring-domain-concepts.md) when repeated records earn
shared structure, and [show documents and Views](../guides/show-documents-and-views.md) when people
need a richer presentation.

# Keep this exercise local

Sharing is a separate decision. `superbee sync --establish` publishes a board into an existing
remote repository; it does not create that repository. Do not run it for this tutorial. Before
sharing, confirm the intended repository, whether `origin/board` already exists, participants,
privacy and repository-specific permission. An unknown or denied remote state is not absence.
Follow [Share and synchronize a Git-backed bundle](../guides/share-and-synchronize-git-bundle.md) for
the complete handoff and recovery procedure.

Use `superbee ui --status` to inspect a local reader and `superbee ui --stop` with the same bundle
and actor to stop it when finished. Keep the test project for another exercise or remove it through
your usual file workflow after inspecting its contents.

# If a checkpoint fails

- Creation refused: run `superbee home`; use the existing workspace or a fresh test project.
- Actor refused: use one of the accepted OKF actor shapes from the error.
- Saved claim disagrees with source: correct or qualify it; format validation is not fact checking.
- Version conflict during update: read the complete current body and reconcile the change; do not
  retry blindly with a new token.

Plain `superbee init` inside Git selects its top-level `.superbee/` when no existing bundle or
binding selects another target; outside Git, its default is the current directory. This tutorial
uses the explicit local `--create-only --dir .superbee` path.

# Evidence and next steps

The [current release evidence](../sources/current-release.md) names the applicable package and
source. Its `init`, `doc write`, `doc read`, `doc update`, `list`, and `status` help govern the command
checkpoints. The source-selection exercise uses the complete JSON fixture printed above.

[understand bundles and relationships](../concepts/bundles-documents-and-relationships.md)

[preserve context between sessions](../guides/preserve-context-between-sessions.md)

[find a command](../reference/cli-overview.md)

[learn what Superbee is](../concepts/what-superbee-is.md)

[inspect the system context](../architecture/superbee-system-context.md)

[current release](../releases/current.md)
