---
type: Reference
title: View contract and access
description: >-
  Exact registered and transient View schemas, access levels, admission,
  approval, saving, and recovery.
superbee_updated_by: openai/codex
---
# Scope and supported version

This reference describes the active View contract in the
[current stable release](../sources/current-release.md). It covers durable registered Views,
process-local transient Views, access levels, admission, discovery, approval, saving, and recovery.
See [Show documents and Views to a human](../guides/show-documents-and-views.md) for a task-oriented
procedure and [View lifecycle and trust](../architecture/view-lifecycle-and-trust.md) for the
complete security model.

# Registered View document

A durable View consists of one `type: View` registry document plus one HTML blob.

```yaml
---
type: View
title: Release readiness
description: Current evidence and unresolved release gates.
entry: views/release-readiness.html
entry_version: sha256:<64-lowercase-hex-characters>
access: bundle-read
presentation: workspace
---
```

| Field | Requirement |
| --- | --- |
| Registry ID | A safe nested ID under `views-registry/`. The legacy `pages-registry/` location is still recognized. |
| `type` | Exactly `View`, including case. The legacy `Page` type does not register. |
| `title` | Optional for registration. Catalogs display the registry ID when it is absent. |
| `description` | Optional non-empty catalog text. |
| `entry` | A safe blob key under `views/`. The legacy `pages/` location is still recognized. |
| `entry_version` | Optional canonical `sha256:` version pin. When present, the current blob must match it. |
| `access` | `none`, `bundle-read`, or `bundle-propose`. Missing or unknown values resolve to `none`. |
| `presentation` | Optional `workspace`, `inline`, or `adaptive` catalog hint. Unknown values are ignored. |

Registry and entry path segments accept ASCII letters, digits, `.`, `_`, and `-`. Empty, hidden,
absolute, traversal-like, percent-encoded, query, fragment, backslash, and `.md` segments are
rejected. `entry_version` pins the executable bytes. Every launch also computes and binds the
current byte version when the field is absent.

# HTML admission

The entry must be valid UTF-8 HTML with media type `text/html`. The only accepted content-type
parameter is UTF-8 charset, quoted or unquoted. The maximum active HTML size is 512 KiB. Admission
copies the bytes into an immutable process-local launch and normalizes the content type to
`text/html; charset=utf-8`.

A registered launch fails when the registry cannot be read, the registration is invalid, the entry
is absent or unreadable, the version pin differs, HTML admission fails, or either source changes
while launch preparation is running.

# Access levels

| Access | Bundle surface | Approval | Mutation |
| --- | --- | --- | --- |
| `none` | No bundle data. `open-page` remains available for navigation. | No data approval. | None. |
| `bundle-read` | Bounded query, read, rendered-document, edge, subscription, versioned-read, and View-navigation requests. | Approval binds the exact source bytes, content type, capability, policy, and registered identity or transient bundle identity. | None. |
| `bundle-propose` | Includes the `bundle-read` surface. | Same exact-subject approval as `bundle-read`. | May propose one `document.set-field` action. The trusted shell requires a separate human confirmation and rechecks the document version before committing it. |

View code never receives direct write authority. A field proposal contains exactly `kind`, `docId`,
`field`, scalar `value`, and `expectedVersion`. Strings are limited to 4 KiB, field names to 128
bytes, and the enclosing action message to 8 KiB.

# Discovery and launch surfaces

The terminal lists registered, admissible Views for the selected bundle:

```sh
superbee view list
superbee status
```

`view list` returns stable IDs, declared access, and optional presentation hints. `status` reports
invalid registrations, missing entries, and legacy naming. The local browser UI launches registered
Views. It does not launch transient Views.

The MCP Apps integration exposes these model-visible operations:

| Operation | Input contract | Important default or constraint |
| --- | --- | --- |
| `list_views` | Selected workspace plus optional cursor when the MCP server uses the private catalog. | Returns only registered, admissible `bundle-read` and `bundle-propose` Views. Results are bounded and paginated. |
| `show_view`, registered | Exactly `viewId`, plus workspace for a catalog-backed server. | Registered `none` Views are excluded from the MCP catalog and rejected by active MCP launch. |
| `show_view`, transient | `mode: transient`, `title` of 1 to 120 characters, non-empty `html`, and optional `access`. | A fixed-bundle server accepts `bundle-read` or `bundle-propose`; omission defaults to `bundle-read`. A catalog-backed server also accepts `none`. Explicit `none` always uses the bundleless runtime, even when a workspace is supplied; every bundle-capable case requires a workspace. |
| `save_transient_view` | Exact transient `launchId`, a new safe `views-registry/...` ID, and optional description of at most 500 characters. | The launch must still be current, bundle-backed, and locally approved. The server saves its own admitted bytes and does not accept replacement HTML. |

App-only bridge and approval tools carry launch traffic and trusted-shell decisions. Agents should
invoke the model-visible operations and let the installed host manage those internal calls.

# Transient save behavior

Saving maps `views-registry/<name>` to `views/<name>.html`, writes the exact immutable entry first,
then creates the registration with `entry_version` and the launch access. Both writes use
create-only comparison. An identical retained entry or registration makes retry safe. Different
existing content fails closed.

If the entry succeeds and a later source check or registry write fails, the inert entry may remain
without a successful registration. The error reports the retained key and version. Inspect it before
retrying; do not assume rollback.

The saved registered identity requires a fresh registered-View authorization. Approval of the
transient launch does not authorize the new durable identity.

# Launch lifetime and invalidation

The default active launch lifetime is one hour, with at most 256 launches in one process. Local web
delivery nonces live for two minutes. A separately prepared trusted-action confirmation also expires
after two minutes. Host adapters may provide their own approval store, while the runtime fallback is
process-local.

A launch becomes unusable after expiry, close, navigation, workspace replacement, changed registry
version, changed entry bytes, an entry that no longer passes HTML admission, changed access, lost
authorization, or revocation.
The bridge checks launch currentness and approval around each request. Reopen the current View and
approve its current access when a launch becomes stale.

# Failure lookup

| Symptom | Check and recovery |
| --- | --- |
| A View is absent from `view list` or `list_views` | Run `superbee status`. Correct the registry type, ID, entry key, missing blob, version pin, HTML media type, or access. MCP intentionally excludes registered `none` Views. |
| `show_view` says the View ID is unknown | Call `list_views` or `superbee view list`, then pass one exact returned ID from the intended workspace. |
| Approval disappears after an edit | The authorization subject changed. Inspect and approve the current bytes and access. |
| A transient launch asks for a workspace | Supply an exact catalog workspace for bundle access, or explicitly request `access: none` for a bundleless presentation. |
| Saving a transient View fails after retaining an entry | Read the reported key and version. Retry only with the same current approved launch and intended durable ID, or resolve the destination conflict. |
| A proposed change is rejected | Confirm `bundle-propose`, current authorization, a supported scalar field, Kind conformance, and the exact current document version. |

# Related

[Show documents and Views to a human](../guides/show-documents-and-views.md)

[View lifecycle and trust](../architecture/view-lifecycle-and-trust.md)

# Authoritative sources

- [Registry grammar and access resolution](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/core/src/page.ts)
- [HTML admission and authorization subject](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/view-runtime/src/authorization.ts)
- [Launch, currentness, saving, and action gate](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/view-runtime/src/index.ts)
- [Catalog projection](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/view-runtime/src/catalog.ts)
- [Bounded read bridge](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/view-runtime/src/bridge.ts)
- [MCP inputs and tool registration](https://github.com/Holaxis-ai/superbee/blob/v0.1.3/packages/mcp-app/src/server.ts)
- [Current release evidence](../sources/current-release.md)
