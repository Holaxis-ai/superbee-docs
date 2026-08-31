---
type: Guide
title: Contributor quickstart
description: >-
  Prepare a checkout, make a bounded source change, run the right proofs, and
  verify exact-SHA CI.
superbee_updated_by: openai/codex/root
---
# Goal

Prepare a Superbee development checkout, make one bounded change, run the relevant proofs, and hand
off the exact commit for CI review. This how-to is for contributors with Node.js, npm, and Git.

The workflow follows the repository's tagged
[`CONTRIBUTING.md`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/CONTRIBUTING.md).

# Supported development environment

- Node.js 20 or newer.
- npm with the repository lockfile.
- Git.
- macOS, Linux, or Windows for the public package; individual scripts can document narrower needs.

Use the repository's existing branch and worktree conventions. Preserve unrelated local changes.

# 1. Install the exact dependency graph

From the repository root:

```sh
npm ci
```

`npm ci` is the reproducible starting point. Do not replace the lockfile or run broad dependency
upgrades as part of an unrelated change.

# 2. Orient before editing

Read the repository instructions and locate the owning package:

```sh
git status --short --branch
sed -n '1,240p' CLAUDE.md
find packages -maxdepth 2 -name package.json -print
```

Use `rg` to find the public contract, implementation, and tests for the behavior. Superbee keeps
semantics in core and treats CLI, HTTP, UI, MCP, setup, and publication as interfaces over those
semantics. Change the narrowest owning layer and preserve cross-interface parity.

# 3. Establish a clean baseline

Run the repository-wide compile checks before the change:

```sh
npm run build
npm run typecheck
```

If either fails on the starting commit, record that baseline before editing. Do not hide a known
failure by weakening checks.

# 4. Make the smallest coherent change

Update the governing implementation, its public contract or help, and its behavior proof together.
Common coupled surfaces include:

- command behavior, executable help, structured output, and CLI tests;
- storage semantics, all relevant backend adapters, wire contract, and parity tests;
- recipe definitions, parser or planner behavior, built-in references, and recipe journeys;
- View bridge shape, runtime enforcement, authoring reference, and UI or MCP host tests;
- publication schema, generated types, packed exports, and external-consumer tests.

Generated files stay generator-owned. Run the documented generator and commit its deterministic
output; never patch a generated projection as the only source change.

# 5. Run targeted proofs first

Use the owning workspace's test command while iterating. Examples:

```sh
npm test --workspace @superbee/core
npm test --workspace superbee
npm test --workspace @superbee/publication
```

Then run the root checks that cover affected boundaries:

```sh
npm run build
npm run typecheck
npm test
```

Follow any additional command named in `CONTRIBUTING.md`, the package manifest, or changed schema.
When the behavior crosses packaging, test the packed `superbee` tarball from an isolated prefix and
invoke that installed executable rather than the adjacent development checkout.

# 6. Review the exact diff and commit

```sh
git diff --check
git status --short
git diff
git commit -m "Describe the verified behavior"
```

Confirm every changed file belongs to the intended behavior. Include generated artifacts only when
their source changed and their checks pass.

# CI boundary

GitHub Actions is authoritative for the exact pushed commit SHA. A local green run proves the local
worktree; it does not prove a different remote revision. After pushing, verify that the required
workflow ran against the intended SHA and preserve the workflow URL in the pull request or release
evidence.

Do not amend or force-push while another reviewer is validating an earlier SHA without clearly
resetting that review boundary.

# Security and disclosure

Follow the private vulnerability-reporting process in
[`SECURITY.md`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/SECURITY.md). Keep credentials,
private-state contents, and exploitable details out of commits, public issues, test fixtures, and
Superbee bundles.

# Recovery

| Symptom | Response |
| --- | --- |
| `npm ci` changes tracked files | Stop and inspect the lockfile and generated outputs; a clean install should not silently redefine them. |
| Baseline test already fails | Reproduce on the base commit and record it separately from the proposed change. |
| Targeted tests pass but root tests fail | Treat the cross-package failure as part of the change until proved unrelated. |
| Packed package behaves differently | Fix the export, asset, build, or packaging boundary and repeat the isolated install. |
| CI ran on another SHA | Push the intended commit and verify a fresh run bound to that exact SHA. |

# Next actions

Architecture contributors should begin with [Architecture at a glance](../architecture/architecture-at-a-glance.md)
and [Bundle engine and storage seam](../architecture/bundle-engine-and-storage-seam.md). CLI changes
must also review [CLI commands](../reference/cli-commands.md) and its documentation trigger.
