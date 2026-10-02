---
type: Reference
title: CLI overview
description: >-
  Compact command ownership and output contract for the current stable Superbee
  release.
superbee_updated_by: 'process:release-docs-preparation'
generated:
  by: 'process:release-docs-preparation'
  at: '2026-10-02T20:45:22.444Z'
---
# Scope

This is the compact command map verified against
[the current stable release](../sources/current-release.md). It helps an agent or integrator find the
owning command without copying the entire generated manual into documentation.

Run `superbee --help` for the exact current command list and `superbee <command> --help` for one
command's complete syntax. Generated help from the installed package is authoritative for flags and
defaults.

# Invocation and bundle selection

Persistent host integrations use the globally installed command:

Set `stable_version` from [the verified stable release](../releases/current.md), following
[the installation guide](../get-started/install-and-setup.md). Then run:

```sh
npm install -g "superbee@${stable_version:?Set stable_version to the version in the verified stable release}"
superbee setup
```

For bundle commands, selection follows this order:

1. explicit `--remote <url>` for HTTP access, mutually exclusive with `--dir`;
2. explicit local `--dir <path>`;
3. a supported project-local binding;
4. conventional local discovery up the directory tree.

Catalog labels are resolved explicitly and never act as ambient project selection.

# Command map

| Area | Commands | Use |
| --- | --- | --- |
| Bundle | `bundle locate`, `catalog`, `init`, `index generate`, `status` | Resolve, create, inspect, catalog, and validate a bundle. |
| Documents and links | `doc write`, `doc update`, `doc field`, `doc verify`, `doc read`, `doc open`, `doc history`, `doc delete`, `list`, `link` | Create, patch, edit one frontmatter field, record verification, inspect, display, query, relate, and remove concepts. |
| Artifacts | `artifact create`, `promote`, `pull`, `blobs`, `delete` | Move byte-preserving outputs across the model boundary and store produced HTML. |
| Kinds and recipes | `new`, `kinds`, `kind field`, `recipes`, `recipe add` | Inspect or evolve bundle-owned structure and create validated instances. |
| Remote and human presentation | `serve`, `ui`, `mcp`, `view list`, `sync` | Serve or present a bundle, integrate MCP Apps, inspect Views, and exchange a Git-backed board. |
| Session and installation | `version`, `session-start`, `hook`, `skill`, `setup` | Inspect the build, orient sessions, and manage persistent host integrations. |

# High-value lookups

## Orient to the selected workspace

```sh
superbee home
```

`home` summarizes the CLI identity, selected bundle, recent documents, installed Kinds, grounded
capability offers, and relevant integration or release notices.

## Verify selection and health

```sh
superbee bundle locate
superbee status
```

Use `bundle locate` when the selected path is surprising. `status` reports malformed documents,
Kind warnings, unresolved links, orphans, staleness, graph findings, and View-registration health.

## Read without flooding model context

```sh
superbee list
superbee doc read <id>
superbee doc read <id> --out <file>
```

List and default reads are bounded. Use `--fields` on list/query when more columns are required, and
use `--out`, `--body-out`, or `--rendered-out` to send complete bytes to a file or trusted consumer
while keeping model-facing output bounded.

## Create generic or governed documents

```sh
superbee doc write <id> --type <type> --title <title>
superbee kinds
superbee new "<Kind>" <id> --help
```

Use generic `doc write` for one-off domain concepts. Use `new` when the bundle already declares a
Kind whose fields, headings, and relationships should be enforced.

## Change one field or record verification

```sh
superbee doc field add <id> tags <tag>
superbee doc field set <id> title "<title>"
superbee doc verify <id> --actor human:<id>
```

`doc field` changes one frontmatter field without touching the rest of the document. `tags` and
`sources` use `add`, `remove`, `edit`, and version-guarded `replace-all`; `doc update` no longer
changes tags. `doc verify` appends an OKF v0.2 verification event and reports the derived trust
tier. See [OKF compatibility](okf-compatibility.md).

## Present work to a human

```sh
superbee doc open <id>
superbee ui --open
```

`doc open` targets one specified document. `ui` presents the selected bundle, cross-links, backlinks,
activity, sharing state, and registered Views. Both use the same local UI and renderer.

## Share deliberately

```sh
superbee sync --establish
superbee sync
```

`init` is local. `sync --establish` is the separate explicit publication decision that creates a
shared board through the repository remote. The remote repository must already exist; Superbee does
not create it. If `origin/board` already exists, plain `sync` joins it. After establishment,
ordinary `sync` commits bundle changes, receives teammates' changes, and pushes without touching
code files.

# Output contract

- Default structured output is TOON; `--json` is available for stable machine parsing.
- Errors use structured envelopes and a small exit-code taxonomy.
- Lists report counts and default to compact rows.
- Large document bodies are truncated in model-facing output and name the byte-channel alternative.
- Mutations are idempotent where repeating the same intent is safe.
- `--actor` or `SUPERBEE_ACTOR` supplies advisory attribution; a per-command flag wins. In an OKF
  v0.2 bundle the actor must be `human:<id>`, `process:<id>`, or `<producer>/<version>`, and a
  non-conforming actor is refused before any write.

Raw bytes are never mixed with the structured receipt. Commands that reserve stdout for byte or
protocol transport route diagnostics separately.

# Where command details live

Generated help provides current option tables. Documentation explains which command owns a task,
its safety constraints, and a verified journey; the installed package's help owns its complete flags
and defaults.

install and set up Superbee

[what Superbee is](../concepts/what-superbee-is.md)

[bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

current release evidence

# Release contracts

| Area | Additional commands | Task ownership |
| --- | --- | --- |
| Hosted account | `login`, `whoami`, `logout`, `setup hosted` | Start/resume browser sign-in, inspect local session state, clear a session, and select hosted defaults. |
| Hosted bundles | `catalog list --hosted`, `checkout`, `publish --to hosted`, `export` | Discover reachable bundles, bind a working folder, preview an explicit move, or create a local copy. |
| Generic hosted reads | `op list`, `op run` | Discover a host read without a typed CLI verb; results and descriptions remain data. |
| Conflict recovery | `sync --inspect`, `sync --resolve` | Review and record a document decision, then sync separately to share keep/revise. |
| Hosted deletion recovery | `sync --restore-deletes`, `sync --take-host-deletions` | Restore an outgoing hold or accept a confirmed incoming shrink. Outgoing acceptance remains the person's interactive terminal step. |
| Optional session sync | `hook install --turn-end-sync` | Sync at turn end on Claude Code/Codex after agreement; Git boards also require `--git-boards`. |

Use [Hosted CLI access and operations](hosted-cli-access.md) for selection and capability constraints.
The [generated command inventory](cli-commands.md) is captured from the verified installed stable package.

Current stable release evidence.

# Paged-read contract

The current release provides a bounded page channel in the
`doc read` record:

```sh
superbee doc read <id> --offset 0 --json
superbee doc read <id> --offset <next_offset> --expected-version <head_version> --json
```

These are syntax templates: use the returned `range.next_offset` and first page's `head_version`.
Repeat while `next_offset` exists; its absence ends the read. `range.complete` means the whole body
fit in the first page, so it stays false on a later final page. Default pages are bounded by 32,768
UTF-8 bytes. `--max-bytes` accepts 1,024 through 983,040 bytes. Offsets count UTF-16 code units,
never bytes; use the returned offset so Unicode characters are not split.

Keep one version across pages. A changed document returns `CONFLICT` with `reason: version_conflict` (exit 5); restart the read instead
of combining versions. A page is unsuitable as a replacement body. For editing, export the full
body with `--body-out`, then use the receipt's version for `doc update --body-file`.
Paging flags cannot combine with `--out`, `--body-out`, `--rendered-out`, or `--field`.

The generated inventory, page syntax, and bounds are verified against the same current stable
package in release evidence.
