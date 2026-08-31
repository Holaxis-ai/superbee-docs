---
type: Diagram
title: Bundle engine and storage seam
description: >-
  How core-owned OKF semantics remain consistent across filesystem, memory, and
  remote storage adapters.
superbee_updated_by: openai/codex/root
---
# Question answered

Which semantics belong to Superbee's bundle engine, which behaviors belong to a storage backend,
and how can filesystem, memory, and remote adapters differ without changing user-visible meaning?

This explanation is pinned to Superbee source commit
`77c20318205156d5020a16763e2791845f17826c`. The
[pinned source record](../sources/superbee-codebase-main.md) establishes the reviewed tree.

# Core owns meaning

The bundle engine owns canonical document identity, safe IDs, OKF parsing and serialization,
non-empty types, Kind validation, link and backlink derivation, query predicates, freshness, and
mutation policy. The storage seam receives already validated IDs and persists documents, reserved
files, and blobs. That ownership is explicit in the
[`StorageBackend` contract](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/core/src/types.ts#L215-L239).

Keeping semantics above the backend prevents a database, filesystem, or HTTP service from quietly
inventing its own aliasing, query matches, workflow rules, or link model. A new adapter implements
storage capabilities and can optimize transport, but it does not become a second OKF engine.

# StorageBackend contract

The seam provides:

- ordered single and batch document reads with opaque content-addressed versions;
- write and delete operations with optional compare-and-swap;
- document existence, listing, and honest version history;
- versioned reads and writes for reserved `index.md` and `log.md` files;
- raw-byte blob read, write, list, existence, and delete operations;
- optional head-query push-down and capability reporting.

The full method and CAS contract is defined in
[`types.ts`](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/core/src/types.ts#L239-L390).
`expectedVersion: null` means expect-absent creation, a version token means compare against the
current head, and omission permits an unconditional write. Deletes are hard, idempotent when absent,
and can be guarded by a current version.

# One semantic path, several adapters

| Capability | FilesystemBackend | MemoryBackend | RemoteBackend |
| --- | --- | --- | --- |
| Persistence | Canonical files beneath one bundle root | In-process maps | Conforming `/v0` HTTP server |
| CAS | Cross-process mutation lock plus on-disk hash | Atomic against the in-process map | HTTP preconditions enforced by the server |
| History | Current revision only | Retained version chain | Whatever the server honestly returns |
| Blob content type | Inferred from key on read | Explicit override retained | Transported by server headers |
| Batch reads | Local batch over files | Local batch over maps | One `docs:read-many` request |
| Query push-down | Core fallback | Core fallback | Optional filtered head projection over `GET /docs` |
| Transient retry | No network retry | No network retry | Bounded retry for network and selected 5xx results |

Filesystem implementation and locking begin in
[`backend.ts`](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/core/src/backend.ts#L137-L205).
Memory behavior and retained history are visible in
[`memory-backend.ts`](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/core/src/memory-backend.ts#L93-L180).
The HTTP adapter and its retry/error boundary are defined in
[`remote-backend.ts`](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/core/src/remote-backend.ts#L220-L301).

# Query optimization cannot redefine matches

Core's ordinary scan lists IDs, batch-reads documents, applies one predicate, and sorts by ID. When
a backend implements `queryHeads`, it can push type, prefix, and tag selection closer to storage and
return only frontmatter heads. Core still reapplies the canonical predicate, so an adapter may
over-return but must not under-return for a filter it claims to honor. The engine decision is in
[`bundle.ts`](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/core/src/bundle.ts#L367-L425),
and the wire projection is in
[`remote-backend.ts`](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/core/src/remote-backend.ts#L379-L437).

This makes push-down a performance hint. Field equality, terminal-state filtering, malformed-document
handling, and other product semantics remain in core or the calling interface.

# Version identity and honest history

Document versions are content-addressed tokens shared across adapters for the same canonical
content. Blob versions hash raw bytes. Attribution does not change the content version. A caller can
therefore carry a version from a read into a guarded write without learning backend internals.

History is capability-dependent. A filesystem bundle returns only its current revision through the
storage API. Memory and hosted backends can retain a chain. Interfaces must report that difference
honestly instead of manufacturing history from timestamps or Git. Git history and board sync are
separate publication and collaboration domains.

# Failure boundaries

- An unsafe ID is rejected before backend access.
- A stale or expect-absent mismatch becomes a typed `VersionConflict`.
- A missing known document is an error; probing a missing blob returns `null` at the seam.
- Batch read is all-or-nothing for the requested known set.
- Remote 4xx responses, including conflicts, are real results and are not retried.
- A lost response to a guarded remote write can surface as a conservative conflict on retry.
- Backend capabilities can differ, but validation, graph, and query meaning cannot.

# Diagram and prose equivalent

The registered static diagram shows callers entering one core engine, the engine owning validation,
query, graph, and mutation semantics, and the storage contract fanning out to filesystem, memory,
and remote adapters. Its nonvisual equivalent is the ownership statement, capability table, and
failure list above.

# Implications for contributors

Add product semantics to core and exercise them across adapters. Add storage-specific optimization
behind the seam, declare its capability, and keep core's postconditions. A new remote host must
implement the wire contract, version headers, and preconditions before it can claim parity.

See [Wire protocol and reference server](../reference/wire-protocol-and-reference-server.md),
[Document mutation lifecycle](document-mutation-lifecycle.md), and
[Query, links, and backlinks](../guides/query-links-and-backlinks.md).
