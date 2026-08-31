---
type: Diagram
title: Public publication boundary
description: >-
  How a dedicated public bundle becomes a bounded complete publication and
  curated human presentation.
superbee_updated_by: openai/codex/root
---
# Question answered

How does an authoritative Superbee bundle become a bounded public publication, and which layer is
responsible for keeping private material, operational records, presentation choices, and runtime
authority in their proper places?

Publication starts with a bundle whose contents are already approved for its declared audience. The
snapshot captures that complete bundle coherently. Portal then validates the complete exposure and
builds an immutable artifact. A documentation projection selects the material intended for the main
reader experience, while the Portal artifact retains the complete public bundle for inspection.

# The first boundary is the source bundle

Superbee publication has no document-level privacy filter. Capture inventories every concept
document, reserved OKF file, and blob in the selected bundle, excluding dot-prefixed implementation
entries such as `.git`. The exact-byte inventory and default limits are defined by the
[snapshot capture](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/publication/src/capture.ts#L33-L48)
and its
[complete inventory walk](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/publication/src/capture.ts#L161-L216).

This makes source selection consequential. A public site must capture a dedicated public bundle.
Private strategy, credentials, personal data, embargoed material, and security findings must stay in
another bundle. Portal's sensitive-content checks are a useful refusal layer for recognizable keys,
credential-shaped filenames, and workstation paths. They are not a general confidentiality
classifier. The current checks are visible in
[`checkPublication`](https://github.com/Holaxis-ai/superbee-portal/blob/7b2cbac2e229963616a01c9d58a6b59423a8bbf6/src/check.ts#L92-L149).

# One coherent immutable snapshot

Capture authorizes one real, non-aliased filesystem root, rejects unsafe tree entries, reads the
inventory twice, and retries only when the source changed during capture. Every accepted object is
content-addressed. Documents carry exact Markdown and canonical inert rendered HTML; relationships
are derived from the captured documents; registered Views bind their exact entry object. The
[snapshot construction](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/publication/src/capture.ts#L302-L443)
and
[two-pass currentness check](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/publication/src/capture.ts#L446-L517)
make the snapshot the stable handoff between mutable bundle authority and downstream consumers.

The snapshot backend is read-only. Every write and delete method refuses with
`CAPABILITY_UNAVAILABLE`, as shown by the
[publication storage adapter](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/publication/src/snapshot-backend.ts#L28-L64).
Published Views may receive `none` or `bundle-read`; `bundle-propose` is refused. The
[publication bridge admission](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/publication/src/bridge.ts#L26-L54)
binds a View to its exact snapshot registration and entry digest, then disables actions and polling
in the
[read-only bridge service](https://github.com/Holaxis-ai/superbee/blob/77c20318205156d5020a16763e2791845f17826c/packages/publication/src/bridge.ts#L55-L98).

# Projection, runtime, and consumer ownership

| Layer | Owns | Refuses or omits |
| --- | --- | --- |
| Public bundle | Which knowledge is eligible for the declared audience | Private or embargoed material must never enter this source |
| `superbee/publication` | Exact complete inventory, immutable objects, semantic read model, inert rendering, registered View identity | Mutable source races, unsafe filesystem identities, malformed documents, missing View entries, write capability |
| Portal core | Explicit `public` or `restricted` audience, acknowledged complete-bundle exposure, sensitive-content checks, exact View admission, deterministic artifact and hosting requirements | Unregistered HTML, `bundle-propose`, unknown routes, unowned output replacement |
| Documentation projection | Curated navigation, supporting documents, operational type exclusions, relationships, brand, diagrams, and freshness facts for human presentation | Operational types in navigation or supporting content; documents outside the declared selection |
| Target adapters | Portal HTML or MkDocs materialization from one admitted projection | Reinterpreting bundle semantics or expanding the selected document set |
| Hosting runtime | Exact artifact verification, declared routes, response headers, static files, and the read-only View bridge | Fallback routes, changed bytes, unauthorized restricted access, undeclared View bridges |

The projection contract explicitly keeps operational document types in the complete publication
bundle while forbidding them from the human presentation. It also bounds navigation, supporting
documents, relationships, and assets. See the
[projection configuration](https://github.com/Holaxis-ai/superbee-portal/blob/7b2cbac2e229963616a01c9d58a6b59423a8bbf6/packages/docs-projection/src/index.ts#L27-L55)
and its
[selection validation](https://github.com/Holaxis-ai/superbee-portal/blob/7b2cbac2e229963616a01c9d58a6b59423a8bbf6/packages/docs-projection/src/index.ts#L866-L875).

Portal core still emits exact Markdown, reserved files, blobs, relationships, snapshot data, and the
read model for the complete bundle. The docs presentation supplies the curated routes and UI. That
composition is explicit in
[`createPortalArtifact`](https://github.com/Holaxis-ai/superbee-portal/blob/7b2cbac2e229963616a01c9d58a6b59423a8bbf6/src/artifact.ts#L68-L150).
The MkDocs adapter consumes the same projection through its own target contract and emits only the
selected documentation material, as shown by its
[materialization loop](https://github.com/Holaxis-ai/superbee-portal/blob/7b2cbac2e229963616a01c9d58a6b59423a8bbf6/packages/docs-mkdocs/src/index.ts#L519-L573).

# Failure and trust boundaries

- A wrong source bundle is a publication-authority failure. Later scanners cannot prove that prose
  is safe to disclose.
- A source mutation during capture produces `SOURCE_CHANGED`; no mixed snapshot is returned.
- Malformed documents, invalid View registrations, missing entries, limit violations, and digest
  mismatches stop capture.
- Portal requires the caller to acknowledge `complete-publication-bundle`, checks every admitted
  View against the snapshot, and refuses recognizable sensitive content before artifact creation.
- Operational types control reader presentation only. They remain public and inspectable because
  the Portal artifact carries the complete public bundle.
- The documentation projection is host-neutral. Portal and MkDocs are consumers, so presentation
  changes do not alter bundle semantics or snapshot identity.
- The hosting runtime serves only verified artifact paths. Public publication does not create a
  mutation channel back to the source bundle.

The visual summarizes these boundaries. Its prose equivalent is the layer table and failure list
above.

# Evidence

[pinned Superbee implementation source](../sources/superbee-codebase-main.md)

[pinned Portal implementation source](../sources/superbee-portal.md)

[documentation operating model](../design/docs-operating-model.md)

[View lifecycle and trust](view-lifecycle-and-trust.md)
