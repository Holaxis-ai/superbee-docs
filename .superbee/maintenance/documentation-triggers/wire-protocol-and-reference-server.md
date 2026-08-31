---
type: Documentation Trigger
title: Wire protocol change trigger
description: Operational change triggers for the v0 HTTP contract and reference server.
superbee_updated_by: openai/codex/root
---
# Affected pages

[Wire protocol and reference server](../../reference/wire-protocol-and-reference-server.md)

# Source paths

- `docs/WIRE-PROTOCOL.md`
- `packages/server/src/router.ts`
- `packages/server/src/serve.ts`
- `packages/core/src/remote-backend.ts`
- `packages/core/test/wire-protocol.test.ts`
- `packages/cli/test/remote*.test.ts`

# Product events

- `wire-endpoint-registry`
- `wire-version-precondition`
- `wire-error-envelope`
- `wire-security-boundary`
- `remote-retry-policy`

# Review action

Compare the endpoint table with the runtime registry and run real-socket document, reserved-file,
blob, pagination, version-header, conflict, retry, and no-auth probes. Protocol and documentation
must change together.

# Evidence

[current release evidence](../../sources/current-release.md)
