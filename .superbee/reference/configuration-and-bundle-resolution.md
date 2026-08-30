---
type: Reference
title: Configuration and bundle resolution
superbee_updated_by: openai/codex
---
# Scope

Use this reference to determine which bundle a Superbee command will open, how a project can declare
one local bundle, and how the private workspace catalog participates in explicit selection. The
behavior is verified against [the current stable release](../sources/current-release.md).

This page covers target selection. Bundle creation, synchronization, publication, and host setup
have separate commands and safety decisions.

# Selection summary

Remote and local selection use separate entry points:

| Caller input | Result |
| --- | --- |
| `--remote <url>` | Open the named HTTP or HTTPS wire-protocol service. |
| `--dir <path>` | Resolve one local target explicitly. |
| No target flag | Resolve a committed project binding, then try local discovery. |
| `--remote <url>` together with `--dir <path>` | Fail with a `USAGE` error because the caller named two targets. |

The local precedence order is:

1. explicit `--dir <path>`;
2. the nearest present `.superbee.json` or compatible `.agentstate.json` project binding, which
   blocks resolution when malformed or unreadable; and
3. the nearest enclosing or conventional local bundle found by walking upward from the current
   directory.

The private workspace catalog does not participate in bare CLI resolution. An agent or user must
resolve a catalog entry and pass its path with `--dir`, or select its label or ID through a
catalog-aware MCP tool.

# Inspect the resolved local target

Run the locator from the project and directory where the command will execute:

```sh
superbee bundle locate --json
```

A successful receipt has this shape:

```json
{
  "schema_version": 1,
  "locator": {
    "kind": "local-path",
    "path": "/canonical/path/to/bundle"
  },
  "selected_by": "project-binding",
  "binding_file": "/path/to/project/.superbee.json",
  "available": true
}
```

`binding_file` appears only when a project binding selected the target. `selected_by` is one of
`explicit-dir`, `project-binding`, or `discovery`. The locator path is canonical and can be passed
back to an ordinary command with `--dir`.

`bundle locate` resolves local bundles only. It never reads or selects an HTTP remote.

# Explicit local selection

Use `--dir` when one invocation must operate on a known local bundle:

```sh
superbee list --dir /path/to/bundle
superbee bundle locate --dir /path/to/bundle --json
```

An existing directory passed with `--dir` is an exact bundle boundary even when the optional root
`index.md` is absent. A project directory can also serve as shorthand for its indexed direct
`.superbee/` or compatible `.agentstate-lite/` child. An `index.md` in the explicitly named
directory takes precedence over those children.

An unavailable explicit target fails. Superbee does not substitute an ancestor bundle for a
misspelled or moved `--dir` path.

# Project-local bindings

Place one `.superbee.json` file in the project when ordinary commands should use a local bundle at
another path:

```json
{
  "bundle": "../shared-knowledge/.superbee"
}
```

The binding rules are exact:

- `bundle` must be a non-empty filesystem path in a JSON object. The followed binding path must
  resolve to a bounded regular file; a symlink to such a file is accepted.
- A relative path resolves from the directory containing the binding file.
- Superbee walks upward from the current directory. The nearest binding wins.
- `.agentstate.json` remains accepted as a legacy project binding.
- Finding both binding filenames at the same directory level is a conflict, even when their targets
  match.
- A malformed or unreadable nearer binding blocks resolution. Superbee does not fall through to a
  farther binding or discovered bundle.
- A binding target is an exact declared directory and does not require `index.md`.
- URL values are rejected. Remote access requires `--remote <url>` on the command.

Project bindings are repository configuration. Commit a binding only when collaborators should use
the same relative bundle relationship. Keep machine-specific absolute paths out of shared project
configuration.

# Local discovery

Without `--dir` or a project binding, Superbee walks from the current directory toward the
filesystem root. At each directory level it checks, in order:

1. `index.md` in that directory, which identifies an enclosing bundle;
2. `.superbee/index.md`; and
3. `.agentstate-lite/index.md` for compatibility.

The nearest matching level wins. An enclosing bundle wins over a conventional child at the same
level. If both conventional child directories are indexed at one level, resolution fails and asks
the operator to choose which project bundle to keep.

Discovery requires `index.md`. Explicit `--dir` and project bindings can identify index-free bundle
directories because the caller or repository already declared the boundary.

# Explicit remote selection

Pass an HTTP or HTTPS service on every command that should use a remote bundle:

```sh
superbee list --remote https://example.invalid/superbee
```

Superbee normalizes the URL and opens the wire-protocol bundle named `default` on that service.
Local project bindings, local discovery, and the private catalog do not override an explicit
remote.

The retired `AGENTSTATE_LITE_REMOTE` environment variable cannot activate a remote. When no
explicit target flag suppresses it, its presence produces a migration error directing the caller
to `--remote <url>`.

For a gated remote, `SUPERBEE_API_KEY` supplies a session-specific credential. The compatible
`AGENTSTATE_LITE_API_KEY` name remains accepted. Both names may be present only when their trimmed
values agree; different non-empty values fail with `USAGE` before a request. If neither environment
value is present, Superbee can use an already provisioned credential keyed by the remote origin.
Credential selection does not change which bundle is selected.

# Private workspace catalog

The catalog is an explicit address book for local bundles:

```sh
superbee catalog add research --dir /path/to/research/.superbee
superbee catalog list --json
superbee catalog resolve research --field path
```

`catalog add` resolves and records a canonical absolute local path. Labels use 1 to 64 lowercase
letters, numbers, dots, dashes, or underscores. They begin and end with a letter or number, and the
`bnd_` prefix is reserved for generated IDs.

Catalog behavior has these boundaries:

- Registration is explicit. The catalog never scans for workspaces.
- Labels, IDs, and canonical paths are unique.
- `catalog list` derives current path availability without selecting an entry.
- `catalog resolve` accepts one label or generated ID, revalidates its path, and returns that exact
  entry.
- A resolved path must be passed to ordinary commands with `--dir`.
- A bare catalog-aware MCP server can list available entries and requires the selected workspace
  label or ID on workspace-scoped tools.
- Catalog entries do not change project bindings, synchronization state, or disclosure policy.

The catalog is user-scoped private operational state. Its relevant files are internal product data:

| Path | Purpose |
| --- | --- |
| `~/.superbee-state/state.json` | Ownership and schema marker for the private state root. |
| `~/.superbee-state/catalog.json` | Schema-versioned local catalog with labels, IDs, and absolute paths. |
| `~/.superbee-state/okf-config.json` | Origin-keyed remote API credentials when provisioned. |
| `~/.superbee-state/catalog.lock` | Temporary catalog mutation lock. |

Superbee creates private-state directories and files with restricted permissions. Use Superbee
commands and emitted recovery instructions instead of committing, copying, or casually editing
these files. A project bundle must remain outside every guarded private-state root.

# Failure and recovery table

| Symptom | Meaning | Recovery |
| --- | --- | --- |
| `--remote and --dir are mutually exclusive` | The invocation named a remote and a local target. | Choose one target and rerun the command. |
| `no OKF bundle found` | No binding or discoverable indexed bundle exists above the current directory. | Confirm the intended ownership boundary. Create a confirmed greenfield bundle or join the existing shared bundle. |
| `no local bundle directory` | An explicit or bound path is unavailable. | Restore or correct the intended path. Use `--dir` with a verified target while repairing a committed binding. |
| `conflicting project bindings` | Both binding filenames exist at one directory level. | Keep the one reviewed project decision and move the other outside the project. |
| `malformed project binding` | The selected binding is unreadable, invalid JSON, or has an invalid `bundle` value. | Fix or remove the named file, then rerun `bundle locate --json`. |
| `project binding ... cannot use remote URL` | A binding contains URL intent. | Put a local path in the binding or pass the URL explicitly with `--remote`. |
| Both conventional bundle directories are indexed | `.superbee/index.md` and `.agentstate-lite/index.md` compete at one level. | Decide which bundle owns the project, then move the other directory outside the project. |
| Catalog entry reports `available: false` | Its recorded canonical path no longer resolves. | Restore that path or register the intended bundle under a new accurate label. Superbee will not substitute another entry. |
| `workspace catalog is busy` | Another process owns the catalog mutation lock. | Let that operation finish and retry. |
| A stale catalog lock names an absent PID | An interrupted operation left a lock older than the stale threshold. | Confirm the named PID is absent, remove only the reported lock file, and retry. |
| `invalid workspace catalog` | The private catalog bytes fail the strict schema. | Preserve the file for inspection, then follow the emitted repair-or-move guidance. |
| `AGENTSTATE_LITE_REMOTE ambient remote selection is retired` | A legacy environment default tried to select a remote. | Remove the variable and pass `--remote <url>` on the intended command. |

The current stable catalog has no remove or relabel command. An unavailable entry therefore remains
visible until its recorded path is restored or the private catalog is deliberately repaired. Use an
explicit `--dir` path to continue bounded work without changing ambient project context.

# Governing evidence

The package identity and stable verification boundary are recorded in
[the current release evidence](../sources/current-release.md). Bundle precedence, bindings, remote
selection, and private-state exclusion are grounded in the tagged
[`bundle.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/bundle.ts)
and
[`bundle resolution tests`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/bundle.test.ts).
Locator receipts are grounded in the tagged
[`bundle locate` command](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/commands/bundle.ts)
and
[`locator tests`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/bundle-locate.test.ts).
Catalog storage, validation, and availability are grounded in the tagged
[`catalog.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/catalog.ts),
[`catalog` command](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/commands/catalog.ts),
and
[`catalog tests`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/catalog.test.ts).
Private state and stored remote credentials are grounded in the tagged
[`user-state.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/user-state.ts)
and
[`credentials.ts`](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/credentials.ts).

[choose privacy and bundle boundaries](../guides/choose-privacy-and-bundle-boundaries.md)

[troubleshoot setup and bundle resolution](../troubleshooting/setup-and-bundle-resolution.md)

[share and synchronize a Git-backed bundle](../guides/share-and-synchronize-git-bundle.md)

[CLI overview](cli-overview.md)
