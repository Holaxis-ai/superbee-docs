---
type: Guide
title: Create your first durable workspace
description: >-
  Use a built-in recipe to turn a workshop brief into related records, a saved
  plan and a reusable follow-up answer.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-05T03:18:32.400Z'
---
# Outcome

Create a local Superbee workspace inside a project, then use an agent to turn a short workshop
brief into three linked task records and an inspectable plan. Ask a second question that uses
those records. You see a bundle's structure, relationships,
queries and human presentation working together before designing a model of your own.

This exercise chooses **work-tracking because it is a built-in recipe**. Its existing Task
convention removes setup and modeling decisions from the first result. Tasks are one example of
Superbee's generic capabilities; another bundle can model research, packages, places, experiments
or a different domain with its own conventions.

The [current release evidence](../sources/current-release.md) names the stable package used here.
It demonstrates a local workflow with invented roles and facts, not accuracy or token savings.

# Before you start

- Complete [Install and set up Superbee](install-and-setup.md).
- Use Codex or Claude Code with the Superbee Skill installed, or use the CLI checkpoints below.
- Choose an empty test project and keep this exercise local.

Run `superbee home`. Initial creation requires a confirmed empty project. If a bundle already
resolves, inspect it and choose a fresh test project. If you are resuming this tutorial, read its
existing records and continue with the follow-up question instead of recreating them.

# 1. Give the agent the workshop brief

Use this complete fictional brief:

| Work | Owner | Initial state | Completion condition | Prerequisite |
| --- | --- | --- | --- | --- |
| Agree the session outline | facilitator | in_progress | Outline names the learning goal, three topics and a short exercise. | None |
| Draft the participant handout | writer | blocked | Handout follows the agreed outline and includes the exercise instructions. | Outline |
| Rehearse the session | facilitator | todo | Facilitator can run the session using the completed handout. | Handout |

Ask your agent:

> In this empty test project, create a local Superbee bundle using the built-in work-tracking
> recipe. Capture these three tasks with their stated owners, states, completion conditions and
> dependencies. Use task IDs outline, handout and rehearse. Create a saved plan with links to the
> task records, explain the intended order, and show me the plan. Keep it local. Preserve existing
> records if this exercise has already been started.

The agent should inspect the project and discover the installed recipe and its Task vocabulary.
The CLI checkpoints are:

```sh
superbee recipes
superbee init --create-only --recipe work-tracking --dir .superbee
superbee kinds
superbee new Task --help
```

The explicit create-only command refuses an occupied, nested, bound, symlinked or concurrently
claimed target. Initialization creates an OKF v0.2 local bundle and applies work-tracking's Task
convention. It does not share the bundle.

# 2. Inspect the three related records

These checkpoints create the supplied records with one-line completion conditions:

```sh
superbee new Task outline \
  --title "Agree the session outline" \
  --progress_status in_progress --assignee facilitator \
  --body "Complete when the outline names the learning goal, three topics and a short exercise." \
  --actor openai/codex
superbee new Task handout \
  --title "Draft the participant handout" \
  --progress_status blocked --assignee writer \
  --body "Complete when the handout follows the agreed outline and includes the exercise instructions." \
  --link "depends on=tasks/outline" --actor openai/codex
superbee new Task rehearse \
  --title "Rehearse the session" \
  --progress_status todo --assignee facilitator \
  --body "Complete when the facilitator can run the session using the completed handout." \
  --link "depends on=tasks/handout" --actor openai/codex
superbee doc read tasks/handout
superbee link show tasks/handout --text "depends on"
superbee status
```

Use the agent's actual actor identity. OKF v0.2 accepts `human:<id>`, `process:<id>` or
`<producer>/<version>`, such as `openai/codex` or `anthropic/claude`. The fictional owner names are
advisory assignments; they are not authenticated accounts or permission grants.

`new` is strict and create-only. If an ID already exists, it refuses with a conflict; read that
record or choose a fresh exercise project. It does not replace earlier work. Each Task lives under
`tasks/`, follows the installed convention and carries its completion condition in ordinary
Markdown. The handout's outbound dependency reaches the outline; its derived backlink identifies
rehearsal as dependent work.

The supplied states and dependencies are authored facts. Superbee does not automatically schedule
the tasks, infer that rehearsal is blocked, or advance a state when a prerequisite finishes.

# 3. Show the useful result

The agent should show a concise plan that links to the same task records. For the direct
checkpoint, save this complete initial document outside the bundle, for example as
`/tmp/workshop-plan.md`:

```md
---
type: Plan
title: Prepare a short community workshop
generated:
  by: openai/codex
---
# Workshop plan

Agree the outline, then draft the handout, then rehearse.

The facilitator owns the outline and rehearsal; the writer owns the handout.
The handout is marked blocked while the outline is in progress.

This is a saved overview of the fictional brief. Inspect the linked task records for
states and dependencies. This overview does not automatically refresh or schedule work.
```

Match `generated.by` to your actual actor. Create and display the plan:

```sh
superbee promote /tmp/workshop-plan.md --doc-key plans/workshop.md --strict
superbee link add plans/workshop tasks/outline --text "Agree the outline" --actor openai/codex
superbee link add plans/workshop tasks/handout --text "Draft the handout" --actor openai/codex
superbee link add plans/workshop tasks/rehearse --text "Rehearse" --actor openai/codex
superbee doc read plans/workshop
superbee doc open plans/workshop --actor openai/codex
```

Omitting `--expected-version` makes this promotion expect-absent creation. An existing plan is
preserved and the command refuses; read that plan instead of repeating the creation steps.
After successful creation, `link add` adds the three record links to the plan. Re-adding the same
target and exact display text is a no-op.
Remove the temporary file after checking the saved result.

Read the plan in Superbee's document reader and follow a task link. Inspect the task's completion
condition and dependencies. In an MCP Apps host, the agent can use the document-display tool
instead. This is an ordinary rendered document; it is not an interactive View or a live board.
See [Show documents and Views](../guides/show-documents-and-views.md) for those presentation paths.

# 4. Ask a second question

Ask the agent:

> What work is assigned to the facilitator, and what must finish before rehearsal? Use the
> existing task records and their dependency links. Show the records supporting your answer.

The equivalent discovery checkpoints are:

```sh
superbee list --type Task --field assignee=facilitator
superbee link show tasks/rehearse --text "depends on"
superbee link show tasks/handout --text "depends on"
```

The answer is **outline and rehearsal belong to the facilitator**. The handout must finish before
rehearsal, and the outline precedes the handout. The agent can answer from the structured records
and relationships without creating another plan. A later session can inspect this same local
bundle. Actual multi-person sharing requires a separate authorized workflow.

Learn more in [Query, links, and backlinks](../guides/query-links-and-backlinks.md). For a focused
continuity workflow, see [preserve context between sessions](../guides/preserve-context-between-sessions.md).
When that workflow needs a later edit, follow
[Updating an existing handoff](../guides/preserve-context-between-sessions.md#updating-an-existing-handoff).

# Next: model your own domain and reuse it

The first exercise borrows a built-in model so you can see a useful result quickly. The advanced
progression is to choose a domain, define its kinds and relationships, use them in a bundle, then
package the definitions for another bundle.

A concrete next journey is a small package inventory from three supplied fictional manifests:
capture package/version/license snapshots, define a Package kind and `depends on` relationships,
query the inventory and show its records. The domain's conventions determine what to capture;
dated observations and relationships can remain part of that model.

Follow [Model recurring domain concepts](../guides/model-recurring-domain-concepts.md) for the
supported sequence. Begin with representative records in the intended local bundle. Inspect a
read-only `kind draft` proposal and apply only the exact accepted plan command, or author reviewed
definitions in an external recipe folder and apply them with `recipe add <path>`.

Once the model is stable, a recipe folder contains a `recipe.md` manifest and `conventions/`
definitions. Keep project instances out of a definitions-only recipe. Apply that folder to another
bundle with `recipe add <path>`, or select it while creating a confirmed new bundle with
`init --create-only --recipe <path> --dir <new-bundle>`. Recipe application does not publish a site.
This advanced journey is separate from the first exercise; you do not need to build it now.

# Keep this exercise local

Sharing is a separate decision. Before publishing a Git board, confirm the intended existing
repository, whether `origin/board` already exists, participants, privacy and repository-specific
permission. Do not run `sync --establish` for this tutorial. The separate establishment workflow
publishes `board` into an existing remote repository; Superbee does not create that repository.
A denial, timeout, SSH failure, or unclear probe leaves both facts unknown, so stop and diagnose
access. If `origin/board` exists, join with `superbee sync --pull-only` instead of establishing
another board. A confirmed absent board requires consent, repository-specific Write access and
branch-create policy clearance before establishment. Repository creation permission is irrelevant
to establishing a board in that existing repository.

Follow [Share and synchronize a Git-backed bundle](../guides/share-and-synchronize-git-bundle.md)
for the complete handoff and recovery procedure.

Use `superbee ui --status` to inspect the reader. Stop only this exercise's reader with the same
bundle and actor used to launch it:

```sh
superbee ui --stop --actor openai/codex
```

Keep the test project or remove it through your usual file workflow after inspecting its contents.
See [Bundle concepts](../concepts/bundles-documents-and-relationships.md),
[What Superbee is](../concepts/what-superbee-is.md), the
[System context](../architecture/superbee-system-context.md) and the
[CLI overview](../reference/cli-overview.md) for orientation and command discovery.

# If a checkpoint fails

- Initial creation refused: inspect the selected workspace and choose a fresh test project.
- Task or plan already exists: read it and continue the exercise without replacing it.
- Field or state refused: inspect `kinds` and `new Task --help`; use the installed recipe's fields.
- Actor refused: use the accepted OKF actor shape named by the error.
- Reader cannot start: follow [document display recovery](../guides/show-documents-and-views.md#recover-from-common-failures).

Plain `superbee init` inside Git selects its top-level `.superbee/` when no existing bundle or
binding selects another target; outside Git, its default is the current directory. This tutorial
uses an explicit local create-only path. The [current release](../releases/current.md) and its
evidence govern the command checkpoints.
