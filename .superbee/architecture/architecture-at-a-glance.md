---
type: Diagram
title: Architecture at a glance
description: >-
  How the installed CLI composes the command runtime, shared semantics, host
  adapters, and publication APIs.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T12:56:33.455Z'
---
# Question answered

How does Superbee separate bundle semantics, reusable capabilities, host adapters, and the package
people install?

Superbee keeps OKF meaning in core and composes it through a reusable command runtime. The public
`superbee` distribution bundles that runtime with its browser UI, MCP integration, and trusted
publication interfaces. Installing the CLI requires one package.

# Installed and reusable entry points

The [distribution manifest](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/superbee/package.json#L24-L65) declares the executable,
`superbee/publication`, `superbee/publication/bridge`, `superbee/bundle-descriptor`, and
`superbee/portable-export`. The root module is the executable entry; trusted Node.js consumers should
use the declared API subpaths and their types.

The [command runtime](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/cli/package.json#L1-L43) is a separate `@superbee/cli` library.
Core, the reference server, Markdown rendering, and browser-local integration also have library
manifests. A source export or package manifest does not establish that a given library version was
published or accepted by a production host. Follow the release evidence for the package you use.

# Four ownership layers

| Layer | Responsibility |
| --- | --- |
| Distribution and command composition | `superbee` packages the executable and declared APIs; `cli` owns command dispatch, setup, and orchestration. |
| Host adapters and publication | `ui-server`, `mcp-app`, `ui`, `publication`, and `bundle-descriptor` adapt shared semantics for people, agent hosts, and immutable publication. |
| Reusable capabilities | `board-git`, `server`, `view-runtime`, `markdown-renderer`, and `browser-local` provide Git coordination, HTTP transport, View execution, rendering, and browser working-copy behavior. |
| Semantic and storage base | `core` owns OKF documents, validation, links, queries, mutation policy, storage interfaces, and portable-export verification. |

The [distribution build](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/superbee/build.mjs#L18-L115) bundles source dependencies and
copies declarations into the installed artifact. It embeds built UI assets, rather than requiring
users to coordinate separate UI and runtime installations. Core's
[manifest](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/core/package.json#L155-L176) keeps production dependencies outside the
Superbee workspace graph. The diagram groups responsibilities; it is not an exhaustive dependency
map or inventory of published versions.

# Keep semantics with their owner

A host can select capabilities, authorize a person, and present work. It must use core for document
meaning and the common View policy for admitted proposals. A View submits a proposal; a trusted host
confirms and applies it. Publication captures approved content read-only and does not turn a public
site into a write channel.

Continue with [the storage seam](bundle-engine-and-storage-seam.md),
[the mutation lifecycle](document-mutation-lifecycle.md), or
[the system context](superbee-system-context.md).


# Evidence

[pinned implementation source](../sources/superbee-codebase-main.md)

[Current package evidence](../sources/current-release.md).
