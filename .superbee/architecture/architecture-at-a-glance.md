---
type: Diagram
title: Architecture at a glance
description: >-
  How Superbee's private workspace layers become one supported installed
  package.
superbee_updated_by: openai/codex
---
# Question answered

How is Superbee divided into stable semantic, reusable capability, host, and distribution layers, and
which of those boundaries are supported entry points for an installed user?

Superbee keeps bundle meaning and storage contracts in one core. Private workspace packages build
Git collaboration, serving, Views, rendering, publication, and host integrations around that core.
The public `superbee` package then composes and ships those capabilities without asking users to
install or coordinate the internal packages separately.

# One public package, staged code entry points

Stable `0.1.3` exposes the installed `superbee` executable and does not declare import exports. At
the pinned current-main boundary and on npm `next` (`0.1.4-pre.1`), the same package adds the root
`superbee` export, the read-only snapshot API at `superbee/publication`, and its bounded bridge at
`superbee/publication/bridge`. Those import paths remain prerelease behavior until `0.1.4` is promoted
to stable. The package also ships the agent skill, references, and notices. The source boundary is
declared in the
[`superbee` package manifest](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/cli/package.json#L24-L45); the [current release page](../releases/current.md) remains the installed stable authority.

Nine private `@superbee/*` workspaces surround the public `superbee` package workspace. They let
contributors test and evolve responsibilities independently, but they are not separate products or
installation steps. The CLI build emits the executable plus separate publication and bridge modules,
then embeds already-built UI assets; those facts are visible in the
[`build` entry point](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/cli/build.mjs#L71-L95)
and its
[`source-bundle aliases`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/cli/scripts/build-bundle.mjs#L129-L160).

# Four inward-facing layers

| Layer | Packages and responsibility |
| --- | --- |
| Composition and distribution | `superbee` CLI owns the installed command surface, setup, orchestration, and packaging; current main/next also declares the import exports. It composes capabilities but does not redefine their semantics. |
| Host and projection composites | `ui-server`, `mcp-app`, `publication`, and `ui` adapt bundles for local browser use, MCP Apps hosts, read-only snapshots, and human presentation. The CLI embeds the built UI assets and has no runtime package dependency on the UI. |
| Reusable capabilities | `board-git`, `server`, `view-runtime`, and `markdown-renderer` provide Git coordination, the reference HTTP adapter, safe View execution, and Markdown rendering over the semantic base. |
| Semantic and storage base | `core` owns OKF bundle/document meaning, Kinds, links, queries, mutation policy, and storage interfaces. It has no production dependency on another Superbee workspace. |

The package manifests make those inward dependencies reproducible: [`core`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/core/package.json#L2-L6)
defines the base, and its [production dependency block](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/core/package.json#L58-L60)
contains no Superbee workspace;
[`board-git`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/board-git/package.json#L2-L27),
the [`reference server`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/server/package.json#L2-L26),
[`view-runtime`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/view-runtime/package.json#L2-L34),
and [`markdown-renderer`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/markdown-renderer/package.json#L2-L35)
depend inward on it. The
[`UI server`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/ui-server/package.json#L2-L28),
[`MCP App`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/mcp-app/package.json#L2-L35),
and [`publication facade`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/publication/package.json#L2-L24)
compose several of those reusable capabilities. The
[`UI package`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/ui/package.json#L2-L23)
depends, among Superbee workspaces, only on the rendering and View contracts it consumes at runtime.

The visual is a conceptual layer flow, not the full package DAG. A grouped arrow means one or more
packages in the upstream group use the downstream layer; it does not claim that every package has
every possible edge. The dashed publication edge shows that the prerelease snapshot and bridge
modules are built beside the CLI in the same npm artifact. The diagram scales inline with the page;
use **Expand** when its labels need more room on a narrow screen. The table and prose remain the
complete readable equivalent, while the pinned manifests preserve the exact package responsibilities
and dependencies.

# Core architecture constraints

- Core is the semantic authority. Adapters can transport or present bundle state, but they do not
  create a second definition of documents, Kinds, links, or mutation safety.
- Dependencies point inward. Core remains reusable without a CLI, host UI, Git board, or publication
  site; outer packages may combine inner capabilities.
- The CLI is the composition and distribution root. Its aliases allow one self-contained executable
  while the workspace graph remains modular for development.
- Publication is read-only and Views are projections. Both lack write access to the source bundle.

For how these layers meet humans, agents, Git, and public sites, continue to the
[system context](superbee-system-context.md). For the write path and its transaction authorities,
continue to the [document mutation lifecycle](document-mutation-lifecycle.md).

# Change triggers

Re-evaluate this page when any of these source paths changes:

- `package.json`
- `packages/*/package.json`
- `packages/cli/build.mjs`
- `packages/cli/scripts/build-bundle.mjs`
- `packages/cli/scripts/prepare-bundle-inputs.mjs`
- `packages/cli/scripts/embed-ui-assets.mjs`

[pinned implementation source](../sources/superbee-codebase-main.md)
