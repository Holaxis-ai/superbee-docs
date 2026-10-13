---
type: Diagram
title: View lifecycle and trust
description: >-
  How exact View bytes are admitted, authorized, contained, bridged, confirmed,
  and revoked.
superbee_updated_by: openai/codex
generated:
  by: openai/codex
  at: '2026-10-13T13:02:31.257Z'
---
# Question answered

How can a View read saved knowledge and propose work while the trusted host retains control?

A View is admitted executable HTML. Its bytes, source, access, and expiry bind one process-local
launch. It runs in an opaque-origin sandbox; a bounded message bridge supplies only the capability
that the host authorized. Ordinary Markdown stays inert.

# Sources and launch lifecycle

Registered Views bind a bundle registration to exact entry bytes. MCP can also accept transient
HTML with explicit context. The shared
[launch runtime](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/view-runtime/src/index.ts#L163-L450) admits immutable bytes,
checks currentness, and expires or revokes launches. The
[authorization subject](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/view-runtime/src/authorization.ts#L1-L60) binds the approved
source and access; an old approval does not authorize changed bytes.

1. Resolve registered content or explicit transient input.
2. Admit the bounded HTML bytes and mint a launch.
3. Check source identity, currentness, expiry, and access.
4. Obtain the needed data-access approval.
5. Mount the sandbox and fence each bridge operation before and after work.
6. Return a bounded read or pass a proposal to the trusted shell.
7. Revoke or reopen when source, visibility, authorization, or launch identity changes.

The [bridge contract](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/view-runtime/src/bridge.ts#L18-L135) declares protocols,
capabilities, and limits. Host-specific admission can be narrower than the common contract.

# Access and proposals

| Access | What the View can request |
| --- | --- |
| `none` | No bundle-data access; admitted page navigation only. |
| `bundle-read` | Approved bounded reads, queries, graph operations, rendering, and supported subscriptions. |
| `bundle-propose` | Reads plus admitted proposals that require a separate trusted-shell human confirmation. |

The local UI supports scalar field, body replacement, and atomic field/body proposals. The MCP
surface retains scalar-only proposal admission. Common preparation and policy validate the request;
the host supplies trusted identity, confirmation, and the version guard. The
[trusted action service](https://github.com/Holaxis-ai/superbee/blob/069a42092f39d8261ccd4322c0dc7ff5488aa2c8/packages/view-runtime/src/index.ts#L628-L850) retains confirmation
state outside the sandbox. View code does not directly write the bundle.

Registered MCP Views request bundle-read or bundle-propose. Explicit transient MCP Views can use
none, including bundleless context. The local UI uses registered Views. Saving an admitted transient
View is a separate create-only operation; launching the saved registration requires its own approval.

# Host and publication scope

The diagram shows shared admission, read authorization, and separate confirmation. Its proposal
labels represent the common flow; the host's advertised action set determines which concrete
proposal can enter it. Use [View reference](../reference/view-contract-and-access.md) and
[showing documents and Views](../guides/show-documents-and-views.md) for platform-specific details.


# Evidence

[pinned implementation source](../sources/superbee-codebase-main.md)

[Current package evidence](../sources/current-release.md).
