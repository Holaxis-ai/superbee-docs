---
type: Reference
title: CLI overview
description: >-
  Compact command ownership and output contract for the current stable Superbee
  release.
superbee_updated_by: openai/codex
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

```sh
npm install -g superbee
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
| Documents and links | `doc write`, `doc update`, `doc read`, `doc open`, `doc history`, `doc delete`, `list`, `link` | Create, patch, inspect, display, query, relate, and remove concepts. |
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
shared board through the repository remote. After establishment, ordinary `sync` commits bundle
changes, receives teammates' changes, and pushes without touching code files.

# Output contract

- Default structured output is TOON; `--json` is available for stable machine parsing.
- Errors use structured envelopes and a small exit-code taxonomy.
- Lists report counts and default to compact rows.
- Large document bodies are truncated in model-facing output and name the byte-channel alternative.
- Mutations are idempotent where repeating the same intent is safe.
- `--actor` or `SUPERBEE_ACTOR` supplies advisory attribution; a per-command flag wins.

Raw bytes are never mixed with the structured receipt. Commands that reserve stdout for byte or
protocol transport route diagnostics separately.

# Where command details live

Generated help provides current option tables. Documentation explains which command owns a task,
its safety constraints, and a verified journey; the installed package's help owns its complete flags
and defaults.

[install and set up Superbee](../get-started/install-and-setup.md)

[what Superbee is](../concepts/what-superbee-is.md)

[bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

[current release evidence](../sources/current-release.md)
