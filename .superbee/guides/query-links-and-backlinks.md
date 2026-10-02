---
type: Guide
title: 'Query, links, and backlinks'
description: >-
  Find documents, traverse derived relationships, and regenerate portable
  navigation safely.
superbee_updated_by: 'process:release-docs-preparation'
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T20:45:21.532Z'
---
# Goal

Find the right documents, inspect relationships from either direction, and regenerate portable
navigation without treating indexes as a second data model. This how-to is for active users,
integrators, and View authors.

The examples are verified against [the current stable release](../sources/current-release.md).

# Query document heads

`list` and its alias `query` return document heads newest first by meaningful change time. Filters
combine with AND across flags. Repeated or comma-separated values within one supported field filter
act as a set membership choice.

```sh
superbee list --type Task --open --limit 20
superbee query \
  --type Claim \
  --field progress_status=active,challenged \
  --tag research \
  --prefix claims/ \
  --limit 100
```

Useful filters:

| Filter | Meaning |
| --- | --- |
| `--type <value>` | Exact frontmatter type |
| `--tag <value>` | Document contains the tag |
| `--field key=value` | Scalar or array membership; comma-separated values are OR |
| `--prefix <path>` | Document ID begins with the prefix |
| `--open` | Exclude values declared terminal by the bundle's governing Kind |
| `--limit <n>` | Result cap, default 100; `0` means unlimited |

`--open` depends on the bundle's own Kind registry. Documents with no governing terminal declaration
remain in the result. A head includes metadata and version, not the body. Read the selected document
explicitly when body content matters.

# Add an outbound relationship

```sh
superbee link add claims/retention findings/interview-12 \
  --text evidence \
  --actor openai/codex
```

The link is stored in the source document's Markdown and is idempotent for the same source, target,
and display text. The target does not receive a duplicated field. Superbee derives the backlink
when it scans the graph.

# Inspect one document from both directions

```sh
superbee link show claims/retention
```

The result contains outbound links and derived backlinks. Use an exact text filter when one
relationship label matters:

```sh
superbee link show claims/retention --text evidence --limit 100
```

# Query the whole edge graph

```sh
superbee link list --to claims/retention
superbee link list --from claims/ --text evidence
superbee link list --from projects/alpha/ --to sources/
```

`--from` and `--to` accept an exact document ID or a prefix ending in `/`. Repeat a facet to form a
union within it; supplying both facets intersects them. `--text` is an exact display-text match.
The edge list preserves separate links when one source points to the same target with different
text.

Common graph questions reduce to this operation:

- backlinks: `link list --to <id>`;
- contents of a modeled container: `link list --from <id> --text contains`;
- evidence attached to a claim family: `link list --from claims/ --text evidence`;
- dependencies pointing into one subtree: `link list --to tasks/project-a/`.

# Regenerate portable Markdown navigation

Indexes are generated projections of current document metadata and links. They are useful in Git
and plain file browsers, but they do not govern document identity or relationships.

Check first:

```sh
superbee index generate --check
```

Generate when the check reports ordinary drift:

```sh
superbee index generate --actor openai/codex
```

Superbee updates only files carrying its exact generated ownership marker. An unmarked or malformed
target blocks the whole preflight. Use `--force` only after reviewing a curated index and choosing
to let the generator replace it:

```sh
superbee index generate --force --actor openai/codex
```

The command is local-only and does not sync. It plans all targets first, writes deepest indexes
before parent indexes with compare-and-swap, and reports completed and pending targets if a
concurrent change interrupts the run.

# Verify and recover

```sh
superbee status
superbee link show claims/retention
superbee index generate --check
```

| Symptom | Response |
| --- | --- |
| Expected document is absent | Remove filters one at a time, confirm prefix and Kind values, then read the exact ID. |
| `--open` retains a terminal-looking value | Inspect `superbee kinds`; only declared terminal values are excluded. |
| Backlink is missing | Read the source and inspect `link show`; backlinks are derived from a valid outbound Markdown link. |
| Index check reports refusal | Review the unowned file; adopt it with `--force` only when replacement is intended. |
| Index apply reports partial completion | Recheck the current projection and rerun after resolving the concurrent edit. |

# Evidence and related pages

Query and graph behavior is grounded in the tagged
[`list`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/list.ts),
[`link`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/link.ts), and
[`index`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/index.ts)
commands. See [Research claims and evidence](../examples/claims-and-evidence.md) for a complete
modeled example.

# Release contracts

A View can request graph only when `hello.host.capabilities` declares it. Respect the advertised
document, relationship, reply, and body limits and render partial/over-limit states. OSS graph
returns documents and relationships without model/definition projections; `graph.model` remains
reserved. Typed CLI reads on a hosted checkout use its local folder so unsent changes are included;
generic hosted op calls intentionally refuse those folder-owned read IDs.

Current stable release evidence.

# Newest-first View queries

In the [current release](../releases/current.md), discover `query.newest` in `hello` before
sending a View `query` with `order: "newest"`. The default or `order: "id"` retains ID order.
Newest order uses `generated.at` when present, otherwise legacy `timestamp`; an invalid present
clock is untimed rather than replaced by the fallback. Timed rows precede untimed rows, ties use
canonical ID in UTF-16 code-unit order, and ordering precedes the limit. `count` retains its filtered
meaning. A host without the capability refuses `order` with `USAGE`.

CLI list and home share this newest comparator. View queries have no cursor; narrow the query when
its limit would hide needed rows. See [the View contract](../reference/view-contract-and-access.md).
