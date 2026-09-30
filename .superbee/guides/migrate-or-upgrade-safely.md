---
type: Guide
title: Migrate or upgrade safely
description: >-
  Upgrade Superbee or move from AgentState while preserving the intended
  workspace and verifying each compatibility step.
superbee_updated_by: 'process:release-docs-review'
generated:
  by: 'process:release-docs-review'
  at: '2026-09-30T19:54:20.864Z'
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

# Check an OKF v0.2 bundle after upgrading

The current stable release validates authored writes to OKF v0.2 bundles more strictly than earlier
releases. Existing documents stay readable and unchanged values are preserved, but scripts and
agent instructions may need small changes. v0.1 bundles are not affected.

1. Check the actor that writes will use:

   ```sh
   superbee home
   ```

   On a v0.2 bundle, `home` shows the resolved actor and flags one that writes would refuse. Use
   `human:<id>`, `process:<id>`, or `<producer>/<version>`, such as `openai/codex`. Update any
   `--actor` value or `SUPERBEE_ACTOR` setting that uses another spelling, including
   role-qualified paths such as `openai/codex/root`. The refusal message suggests a corrected
   spelling.

2. Replace tag edits made through `doc update`. `doc update --tag` is refused. Use explicit field
   actions instead:

   ```sh
   superbee doc field add <id> tags <tag>
   superbee doc field remove <id> tags <tag>
   ```

   `doc update` also accepts only one value per field flag and refuses a patch that would replace a
   list. Use `doc field replace-all` with `--expected-version` for a complete `tags` or `sources`
   list, or a complete pull, edit, and promote loop for another list field.

3. Review new health findings:

   ```sh
   superbee status
   ```

   `invalid_stale_after` and `invalid_timestamps` name stored values without an explicit UTC
   offset. Superbee leaves them unchanged. Choose the intended instant and repair each one, for
   example with `superbee doc update <id> --stale-after 2026-10-01T00:00:00Z`.

4. Look for an `OKF_WORKFLOW_STATUS_COLLISION` warning. It means a Kind declares workflow values in
   the lifecycle `status` field, and new instances with those values are refused. Move that
   workflow state to `superbee_progress_status` as described in
   [Kind conventions and recipes](../reference/kind-conventions-and-recipes.md), then continue to
   use `--progress_status`.

See [OKF compatibility](../reference/okf-compatibility.md) for the complete v0.2 authoring rules.

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
- A `USAGE` refusal that names an actor, a tag flag, or a timestamp wrote nothing. Apply the
  correction in its message and help, then retry.
- A `legacy_naming` finding affects View registration. Ordinary documents remain readable while
  the View records are repaired.

[install and set up Superbee](../get-started/install-and-setup.md)

[understand bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

[find a command](../reference/cli-overview.md)

[current release](../releases/current.md)

# Evidence

- [Private-state migration implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/user-state-migration.ts)
- [Private-state recovery and migration tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/private-state-recoverability.test.ts)
- [Logical progress-field implementation](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/core/src/kinds.ts)
- [OKF upgrade status tests](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/test/status.test.ts)
- [Legacy View compatibility rules](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/core/src/page.ts)
- [Source-only legacy View migration](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/scripts/migrate-legacy-view-names.mjs)
- [OKF v0.2 actor guidance at v0.2.1](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/cli/src/actor-guidance.ts)
- [OKF v0.2 standard-field validation at v0.2.1](https://github.com/Holaxis-ai/superbee/blob/ff8f9c8681c94204cac23e8ab7bb2981bb256a12/packages/core/src/okf-standard-fields.ts)
- [Stable package contents and platform metadata](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/package.json)

# Journey check

Test this page with one current Superbee installation and one disposable, Kind-governed OKF v0.1
workspace. The reader should preserve the same bundle path, use logical `progress_status`
successfully, and finish with a verified host setup. Test legacy private-state migration only in an
isolated home directory that contains a supported legacy fixture.

# Release contracts

Review the native Windows platform withdrawal before an upgrade: the npm package allows
only darwin/linux, and a forced native Windows install refuses commands. Use WSL2 or evaluate the
unsupported Windows source build; do not remove or migrate existing bundles as an installation
repair. Preserve the previous executable identity and local work before changing environments.

A hosted move is a separate decision from upgrading the CLI. Use
[Publish, adopt, or export](move-bundle-between-local-and-hosted.md) for an explicit transfer;
never treat `init`, a copied checkout marker, or a package reinstall as checkout migration.
Definition changes remain unsupported in hosted checkouts in this release. Design and validate
Kinds locally before publication.

Library integrators upgrading the filesystem API must provide an explicit `FilesystemHostPolicy`
for a non-POSIX host and retain the backend returned by `initBundle` as `{root, backend}`. Core
has no npm OS restriction and its non-filesystem backends remain available. See the pinned
[core migration contract](https://github.com/Holaxis-ai/superbee/blob/bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8/packages/core/README.md).

[Release source review](../sources/next-release.md).
