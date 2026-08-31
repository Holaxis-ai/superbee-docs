---
type: Reference
title: CLI commands
description: >-
  Generated current command inventory plus stable invocation and output
  conventions.
superbee_updated_by: openai/codex/root
---
# Scope

This reference is a searchable inventory of the public command graph in the current stable
Superbee CLI. Use `superbee <command> --help` for every option, default, safety precondition, and
example attached to one command.

The inventory is generated from executable help and checked for drift. It is verified against
[the current stable release](../sources/current-release.md).

# Invocation and selection

```sh
superbee <command> [options]
superbee <command> --help
```

For local operations, `--dir <path>` selects a bundle explicitly. `--remote <url>` selects the HTTP
backend explicitly and is mutually exclusive with `--dir`. Without either, local selection follows
the resolution order documented in
[Configuration and bundle resolution](configuration-and-bundle-resolution.md).

# Generated command inventory

The text between the markers is owned by `npm run cli-reference:build`. Do not edit it by hand.

<!-- BEGIN GENERATED CLI INVENTORY -->

Generated from the current stable package's executable help. 34 command entries are present.

| Group | Command signature |
| --- | --- |
| Bundle | `bundle locate [--dir <path>]` |
| Bundle | `catalog (add <label> [--dir <path>] \| list \| resolve <label-or-id> [--field path])` |
| Bundle | `init [--dir <path>] [--okf-version <v>] [--recipe <name-or-path>] [--create-only]` |
| Bundle | `index generate [--dir <path>] [--check] [--force] [--actor <name>]` |
| Bundle | `status [--limit <n>] [--dir <path>] [--remote <url>]` |
| Documents & links | `doc write <id> --type <t> [--title <t>] [--body <s> \| --body-file <p>] [--actor <n>] [--dir <path>] [--remote <url>]` |
| Documents & links | `doc update <id> [--<field> <value> ...] [--title <t>] [--tag <t>] [--type <t>] [--body <s> \| --body-file <p>] [--expected-version <v>] [--actor <n>] [--dir <path>] [--remote <url>]` |
| Documents & links | `doc read <id> [--out (<path> \| -) \| --body-out (<path> \| -) \| --rendered-out (<path> \| -) \| --field <name>] [--dir <path>] [--remote <url>]` |
| Documents & links | `doc open <id> [--dir <path> \| --remote <url>] [--port <n>] [--actor <name>]` |
| Documents & links | `doc history <id> [--limit <n>] [--dir <path>] [--remote <url>]` |
| Documents & links | `doc delete <id> [--expected-version <v>] [--dir <path>] [--remote <url>]` |
| Documents & links | `list [--type <t>] [--tag <t>] [--field <k=v>] [--prefix <p>] [--open] [--limit <n>] [--dir <path>] [--remote <url>]` |
| Documents & links | `link (add <from> <to> [--text <t>] [--actor <n>] \| show <id> [--limit <n>] [--text <t>] \| list [--from <id\|prefix/>] [--to <id\|prefix/>] [--text <t>] [--limit <n>]) [--dir <path>] [--remote <url>]` |
| Artifacts | `artifact create <file> --title <title> [--description <text>] [--supersedes <id>] [--actor <n>] [--dir <path>] [--remote <url>]` |
| Artifacts | `promote <file> --doc-key <key> [--content-type <mime>] [--expected-version <v>] [--dir <path>] [--remote <url>]` |
| Artifacts | `pull --doc-key <key> --out (<path> \| -) [--dir <path>] [--remote <url>]` |
| Artifacts | `blobs [--prefix <p>] [--limit <n>] [--dir <path>] [--remote <url>]` |
| Artifacts | `delete --doc-key <key> [--expected-version <v>] [--dir <path>] [--remote <url>]` |
| Kinds | `new "<Kind>" <id> --<field> <value> [...] [--body <markdown> \| --body-file <path>] [--link "<type>=<target-id>" ...] [--no-prefix] [--actor <n>] [--dir <path>] [--remote <url>]` |
| Kinds | `kinds [--dir <path>] [--remote <url>]` |
| Kinds | `kind field "<Kind>" (add <name> [--required] [--values <a,b,c>] \| remove <name>) [--dir <path>] [--remote <url>]` |
| Kinds | `recipes [--dir <path>] [--remote <url>]` |
| Kinds | `recipe add <name-or-path> [--dir <path>] [--remote <url>]` |
| Kinds | `recipe evolve <name-or-path> [--apply <plan-token>] [--actor <name>] [--dir <path>] [--remote <url>]` |
| Remote | `serve [--dir <path>] [--host <h>] [--port <p>]` |
| Remote | `ui [--dir <path> \| --remote <url>] [--port <p>] [--open]` |
| Remote | `mcp [install\|status\|uninstall \| --dir <path>]` |
| Remote | `view list [--limit <n>] [--dir <path> \| --remote <url>]` |
| Remote | `sync [--establish [--yes] \| --pull-only \| --show-incoming <id> [--out <file>]] [--dir <path>] [--limit <n>]` |
| Session | `version [--check] [--tag latest\|next] [--json]` |
| Session | `session-start [--dir <path>] [--no-update-check]` |
| Session | `hook install\|status\|uninstall [--scope project\|user]` |
| Session | `skill install\|status\|uninstall [--scope project\|user]` |
| Session | `setup [migrate-state\|harden-state\|quarantine-state] [--host codex\|claude-code\|claude-desktop\|opencode] [--scope project\|user] [--json]` |

<!-- END GENERATED CLI INVENTORY -->

# Output modes

Ordinary successful receipts use compact TOON by default. Add `--json` when the command supports it
and a machine needs JSON. Parse the selected structured form; avoid scraping descriptive help text.

Two commands deliberately reserve stdout for bytes:

- `doc read --out -`, `--body-out -`, or `--rendered-out -` writes the requested bytes to stdout;
- `pull --out -` writes canonical document or raw blob bytes to stdout.

In those modes receipts and errors move to stderr. `mcp` also reserves stdout for JSON-RPC and sends
diagnostics to stderr. See [CLI errors and exit codes](cli-errors-and-exit-codes.md) for failures.

# Command-family map

| Family | Primary responsibility |
| --- | --- |
| Bundle | Resolve, initialize, catalog, validate, and generate portable navigation |
| Documents and links | Create, patch, read, open, query, version, delete, and relate documents |
| Artifacts | Produce Artifact records and move canonical documents or opaque bytes |
| Kinds | Inspect and evolve bundle-declared conventions and reusable recipes |
| Remote | Serve the reference protocol, launch the UI, expose MCP Apps, list Views, and sync Git boards |
| Session | Report build identity and install, inspect, or remove host integration |

# Stability and evidence

The command graph comes from tagged
[`command-spec.ts`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/command-spec.ts)
and the packed executable help. Descriptions and defaults can change between pre-1.0 releases.
Always pair automated usage with the release evidence and the exact command's help.
