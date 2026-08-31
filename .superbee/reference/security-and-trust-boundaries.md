---
type: Reference
title: Security and trust boundaries
description: >-
  Trust map for bundles, private state, local readers, Views, remote access,
  sharing, and publication.
superbee_updated_by: openai/codex/root
---
# Scope

This reference maps Superbee's trust boundaries for bundle data, local readers, Views, remote
access, Git sharing, publication, private state, and attribution. It is for users deciding what to
store or expose and for integrators adding a host or transport.

The behavior applies to [the current stable release](../sources/current-release.md). Report a
suspected vulnerability through the private process in the repository's
[`SECURITY.md`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/SECURITY.md); do not publish
sensitive details in an issue or bundle.

# Boundary map

| Boundary | Protection provided | Protection the caller still owns |
| --- | --- | --- |
| Local bundle | Filesystem ownership, OKF validation, versioned mutations | Directory permissions, secret exclusion, correct bundle selection |
| Private user state | Platform-specific private directory, setup checks, hardening or quarantine actions | OS account security and approval of setup actions |
| Local UI | Loopback bind, per-run session credential, bounded renderer | Local-machine trust and secrecy of printed session URL |
| Registered View | Exact-byte admission, sandbox, CSP, opaque origin, bounded bridge | Trust decision for the View's source and requested access |
| `bundle-propose` | Shell-native before/after review and current-version CAS | Human confirmation of each proposed change |
| Reference wire server | Loopback default and protocol validation | Authentication, authorization, TLS, limits, and trusted attribution for any exposed deployment |
| Git board sync | Explicit establishment, branch/upstream checks, conflict preservation | Repository access control, review policy, and secret scanning |
| Public publication | Closed immutable snapshot, object digests, admitted Views, read-only bridge | Public-content selection, deployment controls, and host verification |
| Actor metadata | Advisory attribution carried in receipts and history when supported | Authenticating the principal before setting trusted attribution |

# Bundle contents and privacy

A bundle is durable working data. It can be committed, shared, served, or published according to the
chosen workflow. Store only information appropriate for every channel the bundle may enter. API
tokens, session credentials, host registration secrets, and private vulnerability details belong
outside the bundle.

Run `superbee bundle locate` before reading or writing. Explicit `--dir` wins for local work;
explicit `--remote` activates HTTP. URL-valued ambient bindings are rejected so a project cannot
silently redirect ordinary commands to a remote server.

# Private state and setup

Setup inspects npm installation, user-private state, Skill, Hook, MCP, bundle, and workspace catalog
readiness. It returns one bounded action at a time. An agent may execute the proposed action within
the user's scope, requests approval when required, and reruns setup until ready.

Use `setup migrate-state`, `harden-state`, or `quarantine-state` only when the setup report proposes
that exact recovery. Private state is not an OKF bundle and must not be copied into a repository to
make setup appear portable.

# Local document reader and UI

`doc open` and `ui` bind to loopback. The printed URL contains a live session credential. Another
local process or user may still reach loopback or observe local state, so loopback is not a
multi-user authorization layer. Stop the process to expire the run's session.

Canonical Markdown rendering emits bounded inert HTML. It removes executable controls and does not
turn document Markdown into trusted application code.

# View execution and approval

Bundle-authored HTML is executable. Superbee launches it in an iframe with scripts allowed, no
same-origin privilege, an opaque origin, and a strict content security policy that blocks ordinary
network connections. The iframe receives a nonce for one admitted entry, never the shell session
credential.

Access is explicit:

- `none`: no bundle data;
- `bundle-read`: bounded read-only v0 bridge;
- `bundle-propose`: the read bridge plus a narrow local proposal protocol.

Approval binds the registry identity, exact entry digest, and access. Changed bytes or broader
access require a fresh decision. Proposal Views cannot create, delete, write bodies or links, make
remote mutations, or retain ambient grants. The trusted shell rechecks the View, target document,
Kind, and expected version before showing each action to the human.

# Remote protocol

`superbee serve` is a reference development server. It binds `127.0.0.1` by default and implements
no authentication or authorization. A bearer token sent by `RemoteBackend` has meaning only when a
separate gated deployment validates it. Binding the reference server to a non-loopback address
exposes the same unauthenticated router and is unsafe as a production deployment.

A production host must provide TLS, authentication, per-principal authorization, request and body
limits, audit policy, and trusted attribution. It must strip client-supplied `X-Agent` before
setting a verified value. `X-Actor` and `X-Agent` are advisory on the reference server.

# Sharing and public publication

`sync --establish` is the explicit transition from a local or in-tree bundle to a dedicated board
branch. Sync can commit and push bundle changes. Review repository remotes, access control, and the
exact branch before establishment. Conflicting local work is exported instead of silently erased.

Public publishing should consume one captured snapshot, not a live mutable bundle. Snapshot capture
validates objects, identities, View registrations, limits, and source currentness. Static
publication admits only `none` and `bundle-read` Views and exposes a read-only bridge. Public
selection remains a content decision; cryptographic integrity cannot make sensitive content safe to
publish.

# Security checklist

Before sharing, serving, or publishing:

1. Confirm the exact bundle and channel.
2. Search bundle documents and blobs for secrets or private incident details.
3. Run `superbee status` and resolve invalid Views, links, and objects.
4. Review executable View source, exact version, and access.
5. Use compare-and-swap for writes whose prior state matters.
6. Verify Git remotes or deployment authentication outside Superbee.
7. Preserve evidence of the exact source, package, snapshot, and deployed artifact.

# Evidence and related reference

See [Wire protocol and reference server](wire-protocol-and-reference-server.md),
[Publication snapshot API](publication-snapshot-api.md), and
[View lifecycle and trust](../architecture/view-lifecycle-and-trust.md). The tagged source authorities
include the UI server, View runtime, storage backends, setup conductor, and publication package at
`v0.1.4`.
