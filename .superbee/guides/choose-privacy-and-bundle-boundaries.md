---
type: Guide
title: Choose privacy and bundle boundaries
description: >-
  Choose one or several bundles, select the intended workspace explicitly, and
  keep publication within its approved disclosure boundary.
superbee_updated_by: openai/codex
---
# Outcome

Choose whether a project needs one Superbee bundle or several, make the intended bundle explicit,
and keep private knowledge outside any bundle approved for public publication. This guide is for
people setting up project authority, agents selecting among registered workspaces, and maintainers
preparing a public bundle.

The local selection procedures are verified against
[the current stable release](../sources/current-release.md). Public snapshot behavior follows the
[pinned publication implementation](../sources/superbee-codebase-main.md), which is reviewed
separately from the stable CLI release.

# Start with the disclosure boundary

Ask four questions before creating durable structure:

| Question | What to decide |
| --- | --- |
| Who may inspect the content? | The people, agents, repositories, and publication consumers approved for the whole bundle. |
| Where may the content travel? | Local disk, a shared Git channel, a public site, or another deliberately chosen destination. |
| Which project owns the context? | The project whose decisions and evidence should govern a bare command. |
| Which work should be interpreted together? | The documents, conventions, relationships, and Views that form one useful knowledge context. |

One bundle is usually enough when those answers remain the same. Use folders, document types,
Kinds, and relationships to organize related work inside it. A topic difference alone rarely earns
the switching and discovery cost of another bundle.

Create a separate bundle when an answer changes materially. Common cases include:

- public documentation and private product strategy;
- separate clients or projects with different participants;
- personal notes and a team-owned workspace;
- research that has a different disclosure policy from the product decisions it may later support;
- knowledge that must follow a different repository or synchronization channel; and
- a focused operational context that would become noisy or misleading if unrelated domain records
  appeared in its searches, Views, or agent sessions.

This split reduces the chance that publication or collaboration carries unrelated private material.
It also limits the concepts an agent has to interpret during one task. The cost is explicit
selection when work moves between bundles and fewer bundle-local relationships across the split.

# Treat a public bundle as public in full

Superbee publication captures the selected bundle as a complete inventory of its concept documents,
reserved OKF files, and blobs. Dot-prefixed implementation entries are excluded from that walk. The
capture contract has no document-level privacy filter.

A site may curate primary navigation or omit operational types from its reader-focused projection.
Those choices affect presentation. The complete Portal artifact still retains the public bundle for
inspection. Keep private strategy, credentials, personal data, embargoed material, and security
findings in a different bundle before capture begins.

Catalog labels, project bindings, hidden navigation, and a label such as `private-work` grant no
access control. They help select and organize local paths. Use filesystem, repository, and hosting
controls appropriate to the chosen participants, and treat their configuration as a separate
security responsibility.

# Confirm the project bundle before writing

From the project where the work should be authoritative, run:

```sh
superbee bundle locate --json
```

The receipt names the canonical local path and explains how it was selected:

| `selected_by` | Meaning |
| --- | --- |
| `explicit-dir` | This command received `--dir <path>`. |
| `project-binding` | The nearest supported project binding selected a declared local bundle. |
| `discovery` | Superbee found the nearest enclosing bundle or conventional project bundle. |

Local resolution uses that order: an explicit `--dir`, then the nearest `.superbee.json` or
compatible `.agentstate.json` binding, then upward discovery. Competing binding files or competing
conventional bundle directories at the same level fail closed. An explicit `--remote <url>` selects
a wire-protocol service and cannot be combined with `--dir`; URL-valued project bindings are
rejected.

For a project that deliberately owns an out-of-tree local bundle, a project-root binding can record
the decision:

```json
{
  "bundle": "../shared-work/.superbee"
}
```

The relative path is resolved from the directory containing the binding file. Review the binding as
project configuration, then rerun `bundle locate --json` from a nested project directory. The
receipt should name `project-binding` and the intended canonical path.

Use `--dir <path>` for a one-command override or while diagnosing a faulty binding. An unavailable
explicit target fails instead of falling back to another workspace.

# Use the catalog as an address book

The private user catalog makes several local bundles available for deliberate selection. Register
each bundle under a purpose-specific label:

```sh
superbee catalog add private-work --dir /path/to/private/.superbee
superbee catalog add public-docs --dir /path/to/public/.superbee
superbee catalog list
```

`catalog add` records the canonical local path. `catalog list` reports whether each registered path
currently resolves. Availability is a point-in-time path check. It does not make that entry the
current project's bundle, enroll it in synchronization, or approve its contents for disclosure.

Resolve one entry and pass its returned path to the command that should use it:

```sh
superbee catalog resolve public-docs --field path
superbee list --dir /path/returned/by/resolve
```

There is no process-wide active catalog workspace. Bare CLI commands continue to use project
resolution. For an MCP host, call `list_workspaces`, choose an available exact label or ID, and pass
that `workspace` value to each workspace-scoped tool. Selection is revalidated before the tool opens
one bundle context, and catalog listings omit filesystem paths.

# Operate several bundles without context drift

Use the same small routine whenever a task crosses a boundary:

1. Name the purpose of the target bundle, such as `private-work` or `public-docs`.
2. Resolve the catalog label or use the reviewed project binding.
3. Run `superbee bundle locate --json` with the intended `--dir` when a receipt would help review.
4. Pass that path explicitly to every command in the cross-bundle step.
5. Read the target bundle's home or status receipt before writing.
6. Copy only material approved for the target bundle's participants and disclosure policy.

Keep a stable project binding for the bundle that should govern ordinary work in that repository.
Use catalog labels for private discovery across projects and explicit `--dir` values for deliberate
switches. A recently used bundle, an available catalog entry, or an agent's memory of a path cannot
override the project receipt.

When information moves from a private bundle into a public one, write a reviewed public explanation
or evidence record suited to that audience. Avoid copying private source text, workstation paths, or
internal relationship targets into the public bundle. Inspect the whole public source before invoking
its publication workflow.

# Publication and sharing are separate decisions

A local bundle can remain local, travel with a code branch, or use a dedicated shared board channel.
The sharing choice determines who receives mutable bundle changes through Git. Public publication
captures an approved source bundle into an immutable, read-only snapshot for downstream consumers.

Choose the sharing participants and repository before establishing a shared channel. Choose the
public audience and inspect the dedicated public bundle before capture. Shared board distribution
and public site publication are separate choices. A public snapshot creates no mutation route back
into the source bundle.

Continue with [Sharing, synchronization, and freshness](../architecture/sharing-synchronization-and-freshness.md)
for Git channel behavior and [Public publication](../architecture/public-publication-boundary.md)
for the capture, projection, Portal, and hosting boundaries.

# Recovery checks

- If `bundle locate` names the wrong bundle, retry the operation with the intended `--dir`, then
  inspect the nearest project binding and conventional bundle directories.
- If a catalog entry is unavailable, restore its registered path or register the intended bundle
  under a new accurate label. Superbee will not substitute another entry.
- If two local bundles contain overlapping claims, decide which project owns each claim before
  copying or linking material. Record the durable claim in its owning bundle.
- If the disclosure boundary is uncertain, pause creation, synchronization, and publication until
  the participants and destination are clear.
- If private material entered a public bundle, remove it from the source and review the publication
  destination and history under the owning repository or hosting process. Navigation changes alone
  cannot retract complete-bundle exposure.

# Evidence

Bundle precedence and failure behavior are grounded in the tagged
[`bundle.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/bundle.ts)
implementation and
[`bundle-locate.test.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/bundle-locate.test.ts).
Catalog registration, availability, and explicit path return are grounded in the tagged
[`catalog.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/catalog.ts),
[`catalog` command](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/commands/catalog.ts),
and
[`catalog-command.test.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/catalog-command.test.ts).
MCP selection is grounded in the tagged
[`mcp-workspace-resolver.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/mcp-workspace-resolver.ts)
and its
[`resolver tests`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/mcp-workspace-resolver.test.ts).

Complete-bundle capture and coherent immutable snapshots are grounded in the pinned
[`capture.ts`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/publication/src/capture.ts)
implementation and
[`publication tests`](https://github.com/Holaxis-ai/superbee/blob/b98c1015213f5de41ef2406866a831888c75e674/packages/publication/test/publication.test.mjs).

[understand bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

[troubleshoot setup and bundle resolution](../troubleshooting/setup-and-bundle-resolution.md)

[current stable release evidence](../sources/current-release.md)
