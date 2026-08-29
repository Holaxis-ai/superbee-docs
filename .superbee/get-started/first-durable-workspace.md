---
type: Guide
title: Create your first durable workspace
description: >-
  Create a local bundle, preserve one decision, verify it, and open it for a
  human.
superbee_updated_by: openai/codex
---
# Outcome

Create a local Superbee workspace inside a project, preserve one real decision, and open the saved
document in Superbee's Markdown reader. The result survives the agent session and remains ordinary,
user-owned Markdown.

This tutorial is verified against the current stable release recorded in
[the current release evidence](../sources/current-release.md).

# Before you start

- Complete [Install and set up Superbee](install-and-setup.md).
- Open an empty test project or a project that does not already resolve a Superbee or legacy
  AgentState bundle.
- Decide that this workspace should remain local for now.

If `superbee home` already finds a bundle, stop and use that workspace. Do not initialize another.
A catalog entry elsewhere is not permission to use that bundle as this project's context.

# 1. Create the local workspace

From the project root, run:

```sh
superbee init --create-only --dir .superbee
```

`--create-only` refuses an occupied, nested, bound, symlinked, or concurrently claimed target rather
than opening or changing it. A successful default initialization creates an OKF v0.2 bundle and
adds the built-in context-notes recipe. The conventional `.superbee/` directory is then discovered
from anywhere below the project root.

Initialization is local. Nothing is published or synchronized by this command.

# 2. Preserve one decision

Ask your agent:

> Preserve this decision in the current Superbee workspace: keep the workspace local until we
> explicitly decide to share it. Then show me the saved document.

The agent can create a plain typed document without first inventing a schema. An equivalent CLI
write is:

```sh
superbee doc write decisions/keep-local \
  --type Decision \
  --title "Keep this workspace local" \
  --body "Do not publish or synchronize this bundle without an explicit decision."
```

Superbee attributes writes when the agent supplies its actor identity. Repeating an identical write
returns a no-op and creates no duplicate.

# 3. Verify the saved result

Read the document:

```sh
superbee doc read decisions/keep-local
```

Check the workspace:

```sh
superbee status
```

For the verified path, status reports zero malformed documents, unresolved links, Kind warnings,
and conformance debt.

Now display the document to a human:

```sh
superbee doc open decisions/keep-local
```

`doc open` verifies the ID, starts Superbee's existing local UI, and opens the document through
the shared bounded Markdown renderer. The server stays in the foreground; stop it with Control-C
when you are done. In an MCP Apps host, the agent may instead invoke Superbee's document-display tool
so the same content appears inside the conversation.

# What now persists

The `.superbee/` folder now contains:

- an OKF bundle declaration;
- the context-note convention installed by the default recipe; and
- `decisions/keep-local.md`, an ordinary typed Markdown document.

A later agent can discover and read that decision without reconstructing it from chat. Any Markdown
tool can inspect the file even without Superbee.

# Do not share it accidentally

This tutorial stops with a local workspace. `superbee sync --establish` is a separate explicit act
that publishes a shared board through the repository's remote. Do not run it until the user has
chosen the participants, privacy boundary, and repository.

# If creation is refused

- Run `superbee home` to see whether the project already resolves a workspace.
- If a valid workspace already exists, use it.
- If both `.superbee/` and `.agentstate-lite/` exist at the same project level, move the workspace
  you do not intend to use outside the project; Superbee refuses to guess.
- Use `superbee recipe add <recipe>` to add capability to an existing workspace. Do not rerun init
  to force a recipe into it.

[current release evidence](../sources/current-release.md)

[learn what Superbee is](../concepts/what-superbee-is.md)

[understand bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

[find a command](../reference/cli-overview.md)

[inspect the system context](../architecture/superbee-system-context.md)
