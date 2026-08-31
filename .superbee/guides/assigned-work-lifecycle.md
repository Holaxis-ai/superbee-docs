---
type: Guide
title: Assigned work lifecycle
description: >-
  Safely claim shared Task work, attach durable evidence, and close it with
  guarded updates.
superbee_updated_by: openai/codex/root
---
# Goal

Claim one existing Task safely, make the work visible, attach reviewable evidence, and close the
Task without overwriting another worker's update. This how-to is for agents and humans working in a
shared Superbee bundle that declares the `Task` Kind.

The commands below are verified against [the current stable release](../sources/current-release.md).
Use a stable actor name for the whole assignment, such as `openai/codex/root`.

# Prerequisites

- Resolve the intended bundle with `superbee bundle locate`.
- Confirm that `superbee kinds` lists `Task` and its declared workflow fields.
- Agree on the actor name that should appear in attribution and assignment.
- Treat the Task body, links, and current version as the handoff. Chat alone is not durable state.

# 1. Find eligible work

List open Tasks and inspect the candidate before changing it:

```sh
superbee list --type Task --open --limit 20
superbee doc read tasks/example
superbee link show tasks/example
```

Check the goal, acceptance criteria, current assignee, dependencies, and linked context. Choose one
bounded Task. If the Task is already assigned, coordinate with that assignee or select another Task.

# 2. Claim the exact version you inspected

Read the current version token, then use it as a compare-and-swap precondition:

```sh
TASK_VERSION="$(superbee doc read tasks/example --field head_version)"
superbee doc update tasks/example \
  --assignee openai/codex/root \
  --progress_status in_progress \
  --expected-version "$TASK_VERSION" \
  --actor openai/codex/root
```

A successful receipt means this worker owns the claimed version. A `STALE_HEAD` error exits with
code 5 and means the Task changed after inspection. Read it again and decide whether it is still
eligible. Never retry an old claim token automatically.

# 3. Work from the durable brief

Read the claimed Task again and keep its acceptance criteria in scope:

```sh
superbee doc read tasks/example
superbee link show tasks/example
```

Put reusable findings in the appropriate bundle document. Link evidence or supporting context to
the Task so another worker can resume without reconstructing the conversation:

```sh
superbee link add tasks/example sources/example-evidence \
  --text evidence \
  --actor openai/codex/root
```

For produced HTML, use `superbee artifact create`; for a source, design, decision, or context note,
write the corresponding document and link it. Git commits, pull requests, executed commands, and
test receipts belong in the Task body when they are part of acceptance.

# 4. Record the delivery result

Export the complete body, add a concise delivery section in an editor, and update with the version
that was current when editing began:

```sh
superbee doc read tasks/example --body-out task-body.md
TASK_VERSION="$(superbee doc read tasks/example --field head_version)"
superbee doc update tasks/example \
  --body-file task-body.md \
  --expected-version "$TASK_VERSION" \
  --actor openai/codex/root
```

Include the result, evidence locations, verification performed, and any remaining limitation. The
body update must preserve existing outbound links unless their removal is deliberate and reviewed.

# 5. Close only after acceptance is satisfied

Read the latest Task, confirm every criterion, and close that version:

```sh
TASK_VERSION="$(superbee doc read tasks/example --field head_version)"
superbee doc update tasks/example \
  --progress_status done \
  --expected-version "$TASK_VERSION" \
  --actor openai/codex/root
superbee doc read tasks/example
```

Use the bundle's declared terminal value. A pull request that still needs merge or deployment is
usually evidence of delivery in progress, not proof that a live-site criterion is complete.

# Recovery

| Symptom | Response |
| --- | --- |
| `STALE_HEAD` while claiming | Re-read the Task. If another worker claimed it, stop or coordinate. |
| `STALE_HEAD` while recording evidence | Re-read, merge both valid updates, and write against the fresh version. |
| Unknown `assignee` or `progress_status` field | Inspect `superbee kinds`; use only fields declared by this bundle's Task convention. |
| Work needs a different scope | Update the Task or create and relate a follow-up before continuing. |
| The Task was closed too early | Reopen it with a fresh version token and state the remaining acceptance gap. |

# Evidence and next actions

The guarded mutation behavior is defined by the tagged
[`doc update` implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/doc.ts)
and core versioned writes. Query behavior is covered by
[Query, links, and backlinks](query-links-and-backlinks.md). Produced files are covered by
[Artifacts and byte channels](artifacts-and-byte-channels.md).
