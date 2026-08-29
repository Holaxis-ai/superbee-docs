---
type: Guide
title: Migrate or upgrade safely
description: >-
  Upgrade Superbee or move from AgentState while preserving the intended
  workspace and verifying each compatibility step.
superbee_updated_by: openai/codex
---
# Outcome

Upgrade the installed Superbee CLI and reconnect its host integrations while keeping the existing
workspace intact. Legacy AgentState installations can move their private operational state into
Superbee without relocating bundle content.

This guide is verified against [the current stable release evidence](../sources/current-release.md),
the tagged migration implementations and tests linked below, and a disposable governed OKF v0.1
journey in this documentation repository.

# Choose the path that matches your starting point

| Starting point | Supported path |
| --- | --- |
| A current Superbee installation | Upgrade the global package, verify its identity, and rerun setup for the host. |
| An AgentState or `aslite` installation | Install Superbee, follow any state-migration action reported by setup, then reconnect the host. |
| An existing `.superbee/` or `.agentstate-lite/` workspace | Keep the workspace in place and let normal project discovery find it. |
| An OKF v0.1 bundle | Continue using it. Run status before considering any format change. |

# Before changing the installation

Commit or back up any workspace that contains uncommitted work. Then record the current executable
and resolved workspace:

```sh
superbee version
superbee home
superbee status
```

If `superbee home` resolves an unexpected workspace, stop and correct the project binding or current
directory first. An upgrade should never be used to switch a project's active bundle.

# Upgrade Superbee

The [current release record](../releases/current.md) is the authority for Node.js and platform
support. Confirm that it lists your environment before installing the package.

Install the current stable package:

```sh
npm install -g superbee
```

Confirm the installed package and source identity:

```sh
superbee version
```

The version and artifact channel should agree with
[the current release record](../releases/current.md).

Now inspect the host integration you use:

```sh
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
```

Setup returns at most one action. Review that command, approve any configuration change, run it
unchanged, and restart the named host when instructed. Repeat the same setup command until it
reports `ready: true` and `complete: true`.

# Move from AgentState or aslite

Install Superbee first, then run:

```sh
superbee setup
```

When setup reports this action, review and run it:

```sh
superbee setup migrate-state
```

The command copies validated private catalog entries, remote credentials, and immutable View
approvals into Superbee's current private-state directory. Existing bundles stay where they are.
Legacy private-state bytes remain available for recovery.

Continue with host-specific setup and restart the host when requested. Once the Superbee setup is
complete and a fresh session can reach the expected workspace, the old global package can be
removed:

```sh
npm uninstall -g @holaxis/aslite
```

# Keep existing workspaces in place

Superbee discovers both `.superbee/` and existing `.agentstate-lite/` workspace directories.
Supported `.agentstate.json` project bindings also remain readable. Use the resolved workspace:

```sh
superbee home
superbee status
```

Avoid running `superbee init` in a project that already resolves a workspace. Initialization creates
a new workspace and does not upgrade an existing one.

# Work with an OKF v0.1 bundle

OKF v0.1 bundles remain supported. When a document's governing Kind declares the v0.1 workflow
field `status`, Superbee accepts the logical name `progress_status` and maps it to that declared
storage field:

```sh
superbee list --type Task --field progress_status=todo
superbee doc update tasks/<id> --progress_status done
```

This compatibility mapping does not apply to ungoverned documents or Kinds that do not declare the
workflow field. Run `superbee kinds` to inspect the governing conventions before relying on it.

Run `superbee status` before changing the bundle edition. An `okf_upgrade` section identifies
registered Kinds that declare the v0.1 physical field `status`. It does not detect raw `status`
fields on ungoverned documents, saved queries, or View code. Audit those surfaces separately. The
current CLI keeps the v0.1 bundle usable and does not perform the multi-document conversion.

Keep the existing `okf_version` while that finding is present. Editing `index.md` alone would leave
the bundle internally inconsistent.

# Check legacy Views

`superbee status` reports `legacy_naming` when a bundle still uses the retired `Page` type or
`bridge` capability field. A `Page` document no longer registers as a View. A `View` with only
`bridge` still registers with `access: none`, so it may launch without the bundle capability the
author expected. When both fields exist, current `access` wins and the stale `bridge` field is
ignored.

The remedy printed by the current stable package names a repository script that the npm package does
not contain. Treat this as a source-only migration. Preserve and back up the bundle, then use a
reviewed checkout pinned to the source tag named in the current release record:

```sh
git clone --branch <current-stable-source-tag> --depth 1 \
  https://github.com/Holaxis-ai/superbee.git /tmp/superbee-migration
cd /tmp/superbee-migration
npm ci
npm run build
node scripts/migrate-legacy-view-names.mjs --dir <bundle-root> --dry-run
```

Review the dry-run receipt and the affected registrations. Run the same script without `--dry-run`
only after the proposed type, capability, convention, and reference changes are understood. Then
run `superbee status` and launch each affected View. Avoid independent hand edits to executable View
registrations because the type, entry, and access fields form one trust decision.

# Verify the result

Run all four checks from the project that owns the workspace:

```sh
superbee version
superbee home
superbee status
superbee setup --host <codex|claude-code|claude-desktop|opencode> --scope user
```

The installation is ready when:

- `version` reports the intended stable package;
- `home` resolves the expected workspace;
- `status` shows no new malformed documents or migration findings; and
- host setup reports `ready: true` and `complete: true` after the required restart.

Open one known document as the final human check:

```sh
superbee doc open <document-id>
```

# If verification fails

- An unexpected workspace usually means the current directory or project binding points elsewhere.
  Inspect `superbee home` before changing files.
- A repeated `migrate-state` offer means legacy private state still needs inspection. Keep both
  state directories and use the recovery guidance returned by setup.
- An `okf_upgrade` finding leaves the v0.1 bundle supported. Continue using the logical
  `progress_status` interface for workflows governed by a compatible Kind until a reviewed bundle
  migration is available.
- A `legacy_naming` finding affects View registration. Ordinary documents remain readable while
  the View records are repaired.

[install and set up Superbee](../get-started/install-and-setup.md)

[understand bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

[find a command](../reference/cli-overview.md)

[current release](../releases/current.md)

# Evidence

- [Private-state migration implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/src/user-state-migration.ts)
- [Private-state recovery and migration tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/test/private-state-recoverability.test.ts)
- [Logical progress-field implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/src/kinds.ts)
- [OKF upgrade status tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/test/status.test.ts)
- [Legacy View compatibility rules](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/src/page.ts)
- [Source-only legacy View migration](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/scripts/migrate-legacy-view-names.mjs)
- [Stable package contents and platform metadata](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/cli/package.json)

# Journey check

Test this page with one current Superbee installation and one disposable, Kind-governed OKF v0.1
workspace. The reader should preserve the same bundle path, use logical `progress_status`
successfully, and finish with a verified host setup. Test legacy private-state migration only in an
isolated home directory that contains a supported legacy fixture.

# Re-evaluate this page when

- the npm installation or update command changes;
- setup changes its host or private-state migration flow;
- workspace discovery drops a legacy path;
- Superbee adds an automated OKF edition migration; or
- legacy View migration becomes a packaged command.
