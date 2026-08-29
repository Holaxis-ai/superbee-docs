---
type: Diagram
title: View lifecycle and trust
description: >-
  How exact View bytes are admitted, authorized, contained, bridged, confirmed,
  and revoked.
superbee_updated_by: codex
---
# Question answered

How can Superbee run bundle-owned or agent-authored HTML without giving that code ambient bundle
authority—and how does a host prove each request still comes from the exact bytes, capability, and
launch the human trusted?

A View is executable HTML admitted into an immutable, process-local launch. An opaque-origin script
sandbox contains the code, but containment is only defense in depth. Exact-source and exact-access
authorization decide whether the View can see bundle data. A separate trusted-shell confirmation
decides whether one narrow proposed mutation may run. This page describes the pinned current-main
and npm-next architecture; the [current release page](../releases/current.md) remains the installed
stable authority.

# Registered and transient sources

| Registered Views | Transient Views |
| --- | --- |
| A durable `type: View` registry document names an entry blob, access level, and optional exact `entry_version`. The registry and blob are discoverable by ID. | An MCP caller supplies HTML for one process-local launch. It is not cataloged; omitted access defaults to `bundle-read`, while explicit `none` may be bundleless. |
| A launch rereads the registry and blob, admits the current bytes, and captures registry version, entry, access, content type, and content hash. | A launch admits the supplied bytes into the same runtime and captures their hash, access, and—when data access is possible—the exact bundle identity. |
| A CLI host may persist approval outside the bundle, but only for the identical registered subject. The launch itself is still bounded and process-local. | Approval is session/process-local and never aliases durable registered approval. Local browser UI does not launch transient Views today. |
| Changing the registry, entry, access, or bytes makes the old approval inert and the old launch stale. | Closing, expiry, navigation, workspace change, or byte change revokes the launch. |

Registration is fail-closed: the
[`View` grammar](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/core/src/page.ts#L24-L60)
accepts only the declared access levels, and
[`parsePageRegistration`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/core/src/page.ts#L140-L186)
checks safe registry and entry identities plus an optional canonical entry digest. Every launch still
hashes and pins the admitted bytes even when registration omits that digest.

Saving a transient View does not accept replacement HTML. It persists the server-owned exact
approved bytes create-only—blob before registration—and creates a new durable identity. Launching
that registered identity requires its own authorization; transient trust is never silently promoted.

# One launch-and-trust pipeline

The complete nonvisual lifecycle is:

1. Resolve the registered document and blob, or accept transient HTML plus its explicit bundle/access
   context.
2. Admit bounded UTF-8 `text/html` bytes (at most 512 KiB) and copy them into an immutable launch
   source. The
   [`authorization subject`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/view-runtime/src/authorization.ts#L3-L80)
   binds source identity, exact content version and type, capability, execution state, and policy.
3. Mint a process-local launch with bounded lifetime and registry capacity. The
   [`launch registry`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/view-runtime/src/index.ts#L154-L253)
   owns expiry and revocation; a web-host nonce is only a short-lived page-byte credential, never a
   bundle-data credential or universal MCP mechanism.
4. Re-read the registered source or transient bundle identity and byte hash before use. The shared
   [`currentness check`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/view-runtime/src/index.ts#L300-L329)
   and
   [`mint paths`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/view-runtime/src/index.ts#L332-L449)
   make registered and transient sources converge on one runtime.
5. For `bundle-read` or `bundle-propose`, require approval of the exact launch subject and revalidate
   it. `none` proceeds without data approval because it receives no bundle bridge.
6. Mount only the admitted bytes in an opaque-origin iframe with scripts but no same-origin privilege,
   credentials, or ambient bundle object. The local web host serves immutable bytes through a
   [`nonce and CSP boundary`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/ui-server/src/pages.ts#L1-L48);
   MCP uses a fixed trusted App shell and blob-backed child.
7. Around every bounded bridge request, resolve launch currentness and authorization before work and
   again before replying. The
   [`bridge fence`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/view-runtime/src/bridge.ts#L325-L400)
   revokes stale work instead of delivering data across a changed authority boundary.
8. Return a bounded read result, or pass a narrow proposal to the trusted shell. A proposal mutates
   nothing until the shell displays it, receives a separate one-shot human confirmation, rechecks
   launch and expected document version, validates edition and Kind conformance, and delegates to
   core mutation policy.

# Access is not write authority

- `none` receives no bundle-data bridge and needs no data authorization. Registered local UI Views
  may use it. MCP supports `none` only for explicit transient Views, including bundleless launches;
  registered MCP Views must request `bundle-read` or `bundle-propose`.
- `bundle-read` requires exact-byte/access approval, then permits only bounded read, query, render,
  edge, subscription, and View-opening operations. The protocol union and limits are defined by the
  [`bounded bridge contract`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/view-runtime/src/bridge.ts#L16-L129).
- `bundle-propose` includes reads and may propose one versioned `document.set-field` action. View code
  never writes directly. The
  [`trusted action gate`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/view-runtime/src/index.ts#L729-L795)
  requires separate confirmation and version checks; trusted writes are local-bundle behavior, not a
  claim about remote web UI mutation.

# Revocation and host boundaries

The local UI launches registered Views only. Its authenticated shell mints one nonce, serves
immutable launch bytes with no-store/CSP/nosniff/no-referrer headers, and mounts an iframe with
`sandbox="allow-scripts"` but not same-origin. The server's
[`immutable serve and authorization payload`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/ui-server/src/server.ts#L189-L315)
and the UI's
[`source and frame-generation fences`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/ui/src/views/PageFrame.tsx#L247-L335)
independently reject stale delivery. Registry or blob changes revoke browser state and require a
fresh launch.

MCP `show_view` supports registered and transient sources. Its
[`launch and approval flow`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/mcp-app/src/server.ts#L1004-L1152)
keeps bundle-capable transient Views bound to the selected workspace. The fixed App shell constrains
the child with
[`CSP and sandbox policy`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/mcp-app/src/view.ts#L87-L100)
and validates child source, epoch, visibility, and server-owned freshness through the
[`active-child fences`](https://github.com/Holaxis-ai/superbee/blob/54a63382506a1180c7aad96f46c6503f4d7a3a18/packages/mcp-app/src/view.ts#L946-L1026).
Close, navigation, expiry, delivery discontinuity, changed source/access, or lost authorization all
deny, revoke, reload, or require a replacement launch. A stale persistent approval record may remain
on disk, but its exact subject no longer matches and therefore grants nothing.

This active-code lifecycle is distinct from the inert Markdown document reader and the immutable
public publication boundary. For surrounding product actors see the [system context](superbee-system-context.md);
for confirmed writes see the [document mutation lifecycle](document-mutation-lifecycle.md).

# Change triggers

Re-evaluate this page when any of these source paths changes:

- `packages/core/src/page.ts`
- `packages/view-runtime/src/authorization.ts`
- `packages/view-runtime/src/index.ts`
- `packages/view-runtime/src/bridge.ts`
- `packages/view-runtime/src/action-bridge.ts`
- `packages/ui-server/src/pages.ts`
- `packages/ui-server/src/server.ts`
- `packages/ui/src/views/PageFrame.tsx`
- `packages/cli/src/ui/view-authorizations.ts`
- `packages/cli/src/ui/server.ts`
- `packages/cli/src/commands/mcp.ts`
- `packages/cli/src/mcp-workspace-resolver.ts`
- `packages/mcp-app/src/contract.ts`
- `packages/mcp-app/src/server.ts`
- `packages/mcp-app/src/view.html`
- `packages/mcp-app/src/view.ts`

[pinned implementation source](../sources/superbee-codebase-main.md)
