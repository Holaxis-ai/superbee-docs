---
type: Diagram
title: Bundle engine and storage seam
description: >-
  How core-owned OKF semantics remain consistent across filesystem, memory, and
  remote storage adapters.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T13:02:30.772Z'
---
# Question answered

Which rules belong to core, and which behaviors may differ between storage adapters?

Core owns document identity, OKF validation, Kind conformance, query predicates, links and backlinks,
and mutation policy. A backend persists documents, reserved files, and blobs through the
[StorageBackend contract](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/core/src/types.ts#L230-L400). An adapter does not introduce
its own interpretation of those records.

# Read, decide, and persist

A bundle carries its backend. Core's [engine exports](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/core/src/engine.ts#L1-L324) provide
reads, writes, queries, and graph operations; the
[document mutation transaction](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/core/src/document-mutation.ts#L396-L620) applies
fresh-read decisions, no-op detection, attribution, validation, and compare-and-swap.

For writes, `expectedVersion: null` requires absence, a token requires that observed version, and
omission permits an unconditional write where the owning interface admits it. Callers should carry
the version from the same backend read into their guarded write.

# Adapter capabilities

| Adapter | Persistence and version checking | History |
| --- | --- | --- |
| FilesystemBackend | Exact file bytes, identity and locking checks, atomic replacement | Current revision at the storage seam; CLI Git history is a separate capability. |
| MemoryBackend | In-process maps with guarded writes | Retained version chain. |
| RemoteBackend | Explicit reference `/v0` HTTP transport with version headers and preconditions | What the server actually supports. |

# Bytes and versions

Version tokens are opaque and belong to a backend. A hand-authored file's on-disk hash can differ
from the token produced by a backend that reserializes the same logical document. Byte-identical
canonical serialization produces the same content hash, but cross-backend token equality is not a
portability promise. The [versioning contract](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/core/src/versioning.ts#L1-L68) states
this distinction. Re-read after changing backends instead of reusing an old token.

# Queries and failure boundaries

Backend head-query optimization must preserve core's predicates. Field, tag, terminal-state, and
source-identity selection are defined by the shared
[query predicate](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/core/src/query-filter.ts#L1-L52); callers choose supported ordering.
Missing or malformed records can have interface-specific reporting, so inspect skipped-document
receipts before inferring deletion.

Unsafe identities and stale versions refuse the operation. Remote reads require a version header.
Guarded remote retries use identified-write support when admitted by the transport; neither a
content token nor a missing response proves whether a write was applied. History and capabilities
must be reported honestly.


# Evidence

[pinned implementation source](../sources/superbee-codebase-main.md)

[Current package evidence](../sources/current-release.md).
