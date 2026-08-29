---
type: Diagram
title: Document mutation lifecycle
description: >-
  How an optimistic document update becomes durable state and is optionally
  published through Git.
superbee_updated_by: openai/codex
---
# Question answered

How does a Superbee document read and optimistic update become durable bundle state, and when does
that state become a separately shared Git commit?

# Audience and scope

This explanation is for contributors and integrators who need to change document behavior or add a
storage adapter without bypassing Superbee's mutation guarantees. It follows one representative
`doc read` / `doc update` / `doc history` sequence across local and explicit remote routes.

Bundle initialization, Kind authoring, and the exceptional first-time board-establishment flow are
outside this slice. Git synchronization appears only to clarify that local persistence and shared
publication are different transactions.

# The short version

The CLI selects one explicit local or remote bundle route and translates arguments into a candidate
document. Core owns the transport-neutral mutation transaction: it freshly reads the current bytes
and version, recomputes the candidate, detects semantic no-ops, applies edition-aware attribution,
and performs a compare-and-swap write through `StorageBackend`. A local backend couples its version
check to an atomic filesystem replacement; a remote backend maps the same version contract to HTTP
preconditions. Only after that transaction succeeds does the CLI emit the new version receipt.

Git sharing runs as a separate transaction after storage. A later `sync` commits and converges the
persisted local bundle through its own partial-success-aware flow.

# Lifecycle and owners

| Stage | Owning boundary | What it guarantees |
| --- | --- | --- |
| Dispatch | CLI command registry and `doc update` adapter | One public handler, fail-closed argument parsing, explicit local/remote routing, candidate construction, Kind-field and link-loss policy. |
| Transaction | Core `mutateDocument` and `versionedMutation` | Fresh-read decisions, edition policy, semantic no-op detection, actor attribution, hard or retrying optimistic concurrency. |
| Persistence | `StorageBackend` | Versioned document reads, CAS writes, deletion, history capability, reserved-file and blob operations. |
| Local persistence | `FilesystemBackend` plus identity and lock primitives | Exact-path identity, same-identity serialization, private runtime locks, complete temporary bytes, atomic replacement. |
| Remote transport | `RemoteBackend` and the `/v0` router | `If-Match`/`If-None-Match` parity, required version headers, typed HTTP conflicts, and reuse of the core engine on the server side. |
| Receipt and history | CLI output plus backend `versions` | The resulting version token and honest backend-specific history; local filesystem history promises only its current revision. |
| Optional sharing | CLI `sync` and `board-git` | A separate commit, fetch/rebase, conflict-export, push, and awareness transaction with explicit partial-success receipts. |

The [CLI dispatcher](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/cli/src/cli.ts#L96-L144)
centralizes public command ownership. The
[`doc update` adapter](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/cli/src/commands/doc/update.ts#L298-L448)
resolves the route, constructs the candidate, delegates the mutation, and emits the receipt. It does
not implement compare-and-swap itself.

# Core owns the mutation transaction

[`mutateDocument`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/core/src/document-mutation.ts#L289-L460)
is the shared transaction policy for create, overwrite, and patch. A normal patch can retry bounded
version contention. Passing `--expected-version` requests one hard comparison against the version
the caller previously observed; a stale token fails and cannot become an unconditional write.

Each retry reruns the complete decision against a fresh document/version pair. This matters because
the lower-level
[`versionedMutation` primitive](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/core/src/mutation.ts#L18-L110)
provides version safety, while the caller remains responsible for rechecking mutable domain rules
inside that decision. Core owns transaction consistency. Command-specific domain rules remain with
their caller.

A semantic no-op returns the existing version with `changed: false`; automatic actor attribution
does not manufacture a write. A substantive change receives edition-aware attribution before the
backend CAS.

# Local and remote parity

The
[`StorageBackend` contract](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/core/src/types.ts#L215-L288)
keeps OKF semantics above storage. With a local route, the filesystem backend derives the version
from the serialized bytes and performs the version check and atomic replacement inside the same
identity-keyed critical section. Exact identity rejects aliases and symlinks; process-local
serialization and a same-user cross-process lock protect concurrent writers. Lock files live in
private user state, never in the portable bundle.

With explicit `--remote`, the same core transaction runs over `RemoteBackend`. A read must return a
real version header, an update sends `If-Match`, create-only sends `If-None-Match: *`, and HTTP 412
becomes the same typed version conflict. The reference router sends writes back through the core
engine. The reference `serve` command itself is loopback development infrastructure and does not
claim production authentication.

# Persistence and Git publication are separate

A successful `doc update` means the selected backend accepted and persisted the new version. Git
board publication happens later when a shared local bundle runs `sync`:

1. heal and classify the selected channel;
2. commit already-persisted local changes;
3. fetch and converge with upstream;
4. export the exact local conflict bytes to private state when reconciliation is needed;
5. push when safe; and
6. report committed, pulled, pushed, incoming, or partial-success state.

This separation prevents a network failure from erasing local work. A commit can be real even when
a later fetch, awareness-state write, or push fails, so receipts describe partial success rather
than pretending the entire operation rolled back. The
[`sync` orchestrator](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/cli/src/commands/sync/orchestrate.ts#L629-L703)
owns that second transaction domain.

# Mutation guarantees

- Canonical route identity owns the document ID; payload fields cannot rename the route.
- A blank expected-version token is an error, never permission for an unconditional write.
- Every retry recomputes the decision from a fresh read and version.
- Semantic no-op detection happens before automatic attribution.
- The local CAS check and atomic replacement share one exact-identity critical section.
- Runtime locks and conflict exports remain outside the portable bundle.
- Remote reads without a trustworthy version fail, preserving the later CAS guarantee.
- Backend history is capability-specific; the filesystem does not promise a revision chain it does
  not retain.
- Git sync is separate from document persistence and reports post-commit network failures honestly.

# Observable optimistic update

In an existing disposable bundle:

```bash
superbee doc write decisions/example \
  --type Decision \
  --title "Example decision" \
  --body "Keep the saved state local first."

superbee doc read decisions/example

superbee doc update decisions/example \
  --title "Reviewed example decision" \
  --expected-version <head_version-from-the-read>

superbee doc history decisions/example
```

The update receipt returns `changed: true` and a new version. Reusing the old expected version after
another write fails with a stale-head conflict. History output reflects the selected backend's real
capability and makes no promise of a universal Git-style ledger.

# Accessible diagram narrative

The visual begins with CLI dispatch and explicit bundle selection. Local and remote routes converge
on the same core mutation transaction. A no-op returns the current version; a real change crosses
one CAS boundary into either exact local atomic storage or HTTP preconditions and returns a new
version receipt. History reads from the selected backend. A dotted edge from the local route leads
to optional `sync`, emphasizing that attributed Git commit, convergence, push, and awareness are a
a later transaction, separate from document persistence.

# Evidence and related reading

[pinned implementation evidence](../sources/superbee-codebase-main.md)

[bundles, documents, and relationships](../concepts/bundles-documents-and-relationships.md)

[CLI overview](../reference/cli-overview.md)
