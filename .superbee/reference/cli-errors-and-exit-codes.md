---
type: Reference
title: CLI errors and exit codes
description: 'Stable CLI failure codes, exit statuses, output channels, and retry guidance.'
superbee_updated_by: openai/codex/root
---
# Scope

This reference defines the current stable CLI failure envelope, error codes, exit statuses, and
output channels. It is for scripts, agents, and integrators that need to respond to
failures without parsing human prose.

[Current stable release evidence](../sources/current-release.md) governs the version claim.

# Error envelope

Command failures use compact TOON even when `--json` was requested. The top-level fields identify
the error code and message; some failures include structured details such as expected and actual
versions, current state, completed targets, or recovery commands.

Illustrative shape:

```text
error:
  code: STALE_HEAD
  message: document changed since it was read
  details:
    expected: sha256:...
    actual: sha256:...
```

Treat `code` and documented details as the machine interface. Message wording is for humans.

# Exit statuses

| Exit | Meaning | Error families |
| --- | --- | --- |
| `0` | Success, including idempotent no-op or absent delete | No error |
| `1` | Runtime or transient failure | `RUNTIME`, `TRANSIENT`, infrastructure errors without a narrower class |
| `2` | Usage, policy, or unsupported operation | `USAGE`, `FORBIDDEN`, `NOT_IMPLEMENTED`, `UNSUPPORTED_MEDIA_TYPE` |
| `4` | Authentication or audience failure | `AUTH_REQUIRED`, `AUDIENCE_MISMATCH` |
| `5` | Conflict or failed precondition | `STALE_HEAD`, `ALREADY_EXISTS`, `INTEGRITY_MISMATCH`, `LAST_ADMIN`, `GIT_BUSY`, `CONFLICT` |
| `6` | Requested object is absent | `NOT_FOUND` |

# Error-code lookup

| Code | Meaning | Safe response |
| --- | --- | --- |
| `AUTH_REQUIRED` | The selected operation needs authentication. | Authenticate through the owning host or gated server, then retry once. |
| `AUDIENCE_MISMATCH` | A credential or artifact is scoped to another audience. | Select the intended audience; do not reuse the rejected credential. |
| `NOT_FOUND` | A requested document, blob, workspace, or resource does not exist. | Recheck the exact ID and bundle; create only when the workflow calls for it. |
| `STALE_HEAD` | A compare-and-swap token no longer matches current state. | Re-read, reconcile, and submit against the fresh version. |
| `ALREADY_EXISTS` | An expect-absent create found an existing target. | Inspect the target; use its version only for an intentional update. |
| `UNSUPPORTED_MEDIA_TYPE` | The content type or route is unsupported. | Use the document or blob channel appropriate for the key and bytes. |
| `INTEGRITY_MISMATCH` | Bytes or a declared digest do not match. | Stop, reacquire trusted bytes, and verify the authoritative digest. |
| `NOT_IMPLEMENTED` | The interface recognizes a capability that this backend does not provide. | Choose a capable backend or supported workflow. |
| `USAGE` | Arguments, flags, values, or input shape are invalid. | Read the command's exact help and correct the invocation. |
| `TRANSIENT` | A bounded retryable condition occurred. | Retry with backoff only when the operation is safe to repeat. |
| `RUNTIME` | Execution failed outside a narrower public class. | Inspect stderr and environment; preserve partial-work details. |
| `FORBIDDEN` | The operation crosses an access or policy boundary. | Reduce capability or obtain approval through the owning interface. |
| `LAST_ADMIN` | The requested membership change would remove the last administrator. | Assign another administrator before retrying. |
| `GIT_MISSING` | A Git-dependent sharing operation cannot find Git. | Install or expose Git, then rerun the read-only status step. |
| `NO_UPSTREAM` | The selected branch lacks the upstream needed for the operation. | Configure or establish the intended remote relationship explicitly. |
| `GIT_BUSY` | Another Git operation or lock prevents safe progress. | Finish or abort that Git operation, inspect the worktree, then retry. |
| `CONFLICT` | A state, ownership, sync, or projection precondition failed. | Read structured details, reconcile the named state, and generate a fresh plan. |

# Output channels

Ordinary commands write successful TOON or JSON to stdout and failures to stdout. This keeps legacy
structured error handling consistent for normal command invocations.

Byte-stream modes change the boundary:

- `doc read ... --out -`, `--body-out -`, or `--rendered-out -`: bytes on stdout, receipt or error
  on stderr;
- `pull --out -`: bytes on stdout, receipt or error on stderr;
- `mcp`: JSON-RPC on stdout, diagnostics and errors on stderr.

Never merge stderr into stdout while consuming raw bytes or MCP JSON-RPC.

# Retry discipline

- Retry `TRANSIENT` only with bounded backoff and only when the command's write premise makes a
  duplicate harmless.
- Re-plan `STALE_HEAD`, `CONFLICT`, `ALREADY_EXISTS`, and integrity failures from fresh state.
- Correct `USAGE`, `FORBIDDEN`, media, and capability errors before retrying.
- Treat partial-completion details as authoritative. Verify completed targets before resuming.

# Evidence

The taxonomy and exit mapping are defined in tagged
[`errors.ts`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/errors.ts)
and channel routing in
[`output.ts`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/output.ts).
