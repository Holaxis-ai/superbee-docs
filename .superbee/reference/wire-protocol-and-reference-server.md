---
type: Reference
title: Wire protocol and reference server
description: >-
  Implemented v0 endpoints, preconditions, transport behavior, security limits,
  and RemoteBackend mapping.
superbee_updated_by: openai/codex/root
---
# Scope

This reference summarizes the implemented `/v0` HTTP storage protocol, the reference server, and
`RemoteBackend` client behavior in the current stable release. It is for integrators implementing a gated host
or diagnosing explicit `--remote` operations.

The complete protocol authority is the tagged
[`docs/WIRE-PROTOCOL.md`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/docs/WIRE-PROTOCOL.md).
[Current stable release evidence](../sources/current-release.md) establishes the package identity.

# Start the reference server

```sh
superbee serve --dir .superbee --host 127.0.0.1 --port 4818
```

`serve` defaults to loopback and CLI port 4818. The library-level `serve()` API can request an
ephemeral port. The server closes over one backend; the `{bundle}` path segment is validated but
does not select among multiple bundles.

The reference server has no authentication or authorization. Passing a non-loopback host exposes
the unauthenticated protocol. Production deployment requires an authentication and authorization
gate, transport security, request limits, and trusted principal attribution.

# Conventions

- Route prefix: `/v0`.
- Base member path: `/v0/bundles/{bundle}/...`.
- IDs and blob keys encode each path segment independently.
- JSON success uses `application/json; charset=utf-8`; blob reads return raw bytes.
- Versioned responses send a bare `X-Version` and the same token as a quoted `ETag`.
- `If-None-Match: *` means expect-absent create.
- `If-Match` accepts a bare token and quoted or weak ETag forms.
- Document and blob deletes are idempotent and return `{ "deleted": true|false }`.
- Except for `HEAD`, failures use `{ "error": { "code", "message", "details" } }`.

A client must reject a successful versioned read that lacks both version headers. An empty expected
version is invalid input. `X-Actor` is advisory; `X-Agent` is reserved for a trusted gate and is
client-controlled on the reference server.

# Endpoint table

| Method | Path | Success |
| --- | --- | --- |
| GET | `/v0/capabilities` | Capability booleans for history, CAS, projections, backlinks, and blobs |
| GET | `/v0/bundles/{bundle}/docs` | Filtered document heads with count and cursor |
| POST | `/v0/bundles/{bundle}/docs:read-many` | All requested documents or one missing-ID failure |
| GET | `/v0/bundles/{bundle}/docs/{id...}` | Parsed document plus version headers |
| PUT | `/v0/bundles/{bundle}/docs/{id...}` | Versioned create or write receipt |
| HEAD | `/v0/bundles/{bundle}/docs/{id...}` | Bodyless existence and version result |
| DELETE | `/v0/bundles/{bundle}/docs/{id...}` | Idempotent delete receipt |
| GET | `/v0/bundles/{bundle}/docs/{id...}/versions` | Version, actor, timestamp, and optional agent history |
| GET | `/v0/bundles/{bundle}/reserved/{name}` | `index.md` or `log.md` content and version |
| PUT | `/v0/bundles/{bundle}/reserved/{name}` | Versioned reserved-file write |
| GET | `/v0/bundles/{bundle}/blobs` | Blob keys with count and cursor |
| GET | `/v0/bundles/{bundle}/blobs/{key...}` | Raw bytes, content type, and version |
| PUT | `/v0/bundles/{bundle}/blobs/{key...}` | Raw-byte create or write receipt |
| HEAD | `/v0/bundles/{bundle}/blobs/{key...}` | Bodyless existence, type, and version result |
| DELETE | `/v0/bundles/{bundle}/blobs/{key...}` | Idempotent delete receipt |

There is no collection delete or reserved-file delete route.

# Lists and cursors

Document list accepts `prefix`, `type`, repeated `tag`, `fields`, `limit`, and `cursor`. Filters are
ANDed. Default page size is 50, including for a missing, non-positive, or unparsable limit. `count`
is the total filtered count before pagination. `fields=frontmatter` selects full frontmatter; the
default row is `{ id, version, type, title, timestamp }`.

Blob list accepts `prefix`, `limit`, and `cursor` with the same page envelope. A cursor is the last
returned ID or key. If it disappears, the next page resumes according to backend ordering.

# Documents and raw bytes

Document routes transport parsed frontmatter and body as JSON. `RemoteBackend` reconstructs and
exports canonical OKF Markdown, so an external file's YAML formatting and whitespace are not an
original-byte guarantee. The server's version header identifies state; clients must not replace it
with a hash of reconstructed Markdown.

Blob routes carry exact bytes and content type in the HTTP body and headers. Blob keys ending in
`.md` are rejected so raw storage cannot bypass document validation.

# Client mapping and retry

`RemoteBackend` maps absent document reads to an `ENOENT`-shaped error, absent blob reads to `null`,
and HTTP 412 to `VersionConflict`. Other non-2xx results become `RemoteError` with the wire code and
status.

Network failures and HTTP 500, 502, 503, and 504 are retried with bounded exponential backoff and
jitter. Real 4xx responses, including 401 and 412, are not retried. A guarded write whose response
was lost can conservatively surface as a conflict on retry. Callers that need lost-update safety
must use expect-absent or `If-Match` rather than an unconditional write.

# Known limits

- No authentication, authorization, or trusted attribution in the reference server.
- No multi-bundle selection behind the `{bundle}` segment.
- No original-document-byte endpoint.
- No wire expression for arbitrary core field-equality filters.
- No backlinks endpoint; clients derive edges from documents.
- No body-size cap is supplied by the default `serve()` wrapper.
- A final document path segment named `versions` is ambiguous with history.

# Verification and recovery

Probe capabilities before depending on optional behavior. Use a disposable bundle and loopback
server to test create, read, guarded update, list, history, blob byte integrity, and delete. If a
version header is missing, stop the integration. If a write response is ambiguous, read current
state before deciding whether to retry.

See [Artifacts and byte channels](../guides/artifacts-and-byte-channels.md) for CLI routing and
[Security and trust boundaries](security-and-trust-boundaries.md) before exposing a server.
