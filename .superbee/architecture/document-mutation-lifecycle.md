---
type: Diagram
title: Document mutation lifecycle
description: >-
  How an optimistic document update becomes durable state and is optionally
  published through Git.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T13:02:30.934Z'
---
# Question answered

How does a guarded document edit become saved state, and when is that state shared?

# Read and update one document

1. Select the intended local bundle or explicit remote route.
2. Read its document and version together.
3. Recompute the candidate from a fresh read inside the mutation transaction.
4. Check edition rules, Kind conformance, attribution, and semantic no-op status.
5. Persist with the chosen backend's version precondition.
6. Return the resulting version and whether content changed.

The [doc update adapter](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/cli/src/commands/doc/update.ts#L285-L470) constructs the
request. Core's [mutateDocument](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/core/src/document-mutation.ts#L396-L620) owns the
transaction and [versionedMutation](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/core/src/mutation.ts#L1-L130) owns the bounded
optimistic loop. A hard `--expected-version` comparison refuses stale state; it cannot silently
become an unconditional write. A semantic no-op does not manufacture a change for attribution.

# Share the saved result

For a dedicated Git board, sync commits saved edits, fetches and converges with its selected
upstream, preserves conflicting local bytes, runs any declared check, then pushes a safe result.
Lost push races trigger bounded refetch/convergence/check retries. The
[sync orchestration](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/cli/src/commands/sync/orchestrate.ts#L1-L108) composes those
owners. In-tree documentation uses the repository's ordinary Git workflow instead.

# Try the optimistic boundary

```sh
superbee doc read <id>
superbee doc update <id> --title "Reviewed decision" --expected-version <head_version> --actor openai/codex
superbee doc history <id>
```

A changed update returns a new version. Reusing a stale version refuses the edit. Use the actor
identity of the person or agent performing the operation. Inspect the receipt before treating saved
state as shared state.


# Evidence

[pinned implementation source](../sources/superbee-codebase-main.md)

[Current package evidence](../sources/current-release.md).
