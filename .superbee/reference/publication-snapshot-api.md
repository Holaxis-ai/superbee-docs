---
type: Reference
title: Publication snapshot API
description: >-
  Stable read-only Node.js API for immutable bundle capture and admitted
  publication Views.
superbee_updated_by: openai/codex/root
---
# Scope

This reference covers the read-only publication exports bundled with the current stable package. It is
for trusted Node.js publishers that need to capture one complete filesystem bundle, consume its
immutable objects, and optionally serve admitted read-only Views.

The API is available from `superbee/publication` and `superbee/publication/bridge`.
[Current release evidence](../sources/current-release.md) identifies the packed implementation.

# Package exports

```js
import {
  PUBLICATION_SNAPSHOT_V1,
  capturePublicationSnapshot,
  createPublicationBridge,
  isPublicationError,
} from "superbee/publication";
```

Use `superbee/publication/bridge` when a bundler or runtime needs the bridge-specific entry point.
The public surface exports capture and bridge functions, schema and protocol constants, the
`PublicationError` boundary, and TypeScript types. Internal storage and rendering packages are not
part of this facade.

# Capture one immutable snapshot

```js
import { resolve } from "node:path";
import {
  PUBLICATION_SNAPSHOT_V1,
  capturePublicationSnapshot,
} from "superbee/publication";

const snapshot = await capturePublicationSnapshot({
  schema: PUBLICATION_SNAPSHOT_V1,
  source: { kind: "filesystem", root: resolve(".superbee") },
});

try {
  const manifestBytes = snapshot.serializeManifest();
  for (const document of snapshot.manifest.documents) {
    const markdown = await snapshot.readObject(document.source);
    // Persist or transform admitted bytes in the publisher's own closed build.
  }
} finally {
  await snapshot.close();
}
```

`source.kind` must be `filesystem`. Pass the bundle's absolute, canonical path: capture rejects a
symlink or an aliased spelling such as macOS `/tmp` when it resolves to `/private/tmp`. The returned
handle exposes a deeply read-only manifest, digest-checked object reads, deterministic manifest
serialization, and `close()`. Reads after close fail with `HANDLE_CLOSED`.

# Capture options and defaults

| Option | Type | Default |
| --- | --- | --- |
| `schema` | Exact `PUBLICATION_SNAPSHOT_V1` constant | Required |
| `source.root` | Absolute, canonical filesystem path to the bundle | Required |
| `maxAttempts` | `1`, `2`, or `3` | `2` |
| `limits.maxObjects` | Positive integer | `20,000` |
| `limits.maxObjectBytes` | Positive byte count | `32 MiB` |
| `limits.maxTotalBytes` | Positive byte count | `512 MiB` |

Capture scans a complete publication closure, validates document and blob identities, renders
documents through the bounded renderer, validates registered Views and exact entry versions, and
checks source currentness across the attempt. A source mutation produces a retryable
`SOURCE_CHANGED`; capture retries only within `maxAttempts`.

# Read-only View bridge

```js
import {
  PUBLICATION_BRIDGE_V0,
  createPublicationBridge,
} from "superbee/publication";

const view = snapshot.manifest.views[0];
const bridge = createPublicationBridge({
  protocol: PUBLICATION_BRIDGE_V0,
  snapshot,
  admittedView: {
    id: view.id,
    entry: view.entry,
    access: view.access,
    entryDigest: view.entryObject.digest,
  },
});

const outcome = await bridge.handle({ bridge: "v0", type: "hello", id: "1" });
```

Admission must match one manifest View exactly by ID, entry, access, and SHA-256 entry digest. Static
publication accepts `none` or `bundle-read`. A `bundle-propose` registration is rejected because the
snapshot bridge has no mutation authority. The bridge disables polling and action protocol; its
subscription response is compatible but immutable source state produces no live changes.

# Snapshot guarantees and limits

- Every object reference carries a digest and bounded size.
- `readObject` rechecks the referenced bytes.
- Manifest serialization is deterministic for the captured handle.
- Documents use canonical source and rendered-object projections.
- View entry identity is bound at capture and checked again at bridge admission.
- The facade is read-only and does not publish, upload, deploy, or mutate the source bundle.
- Filesystem mutation during capture can cause `SOURCE_CHANGED`; callers must not combine objects
  from separate handles into one claimed snapshot.

# Error boundary

Catch `PublicationError` or test with `isPublicationError(error)`. Stable codes are:

```text
SOURCE_NOT_FOUND              UNSUPPORTED_SOURCE
SOURCE_CHANGED                LIMIT_EXCEEDED
INVALID_BUNDLE                INVALID_OBJECT_IDENTITY
OBJECT_MISSING                OBJECT_VERSION_MISMATCH
MALFORMED_DOCUMENT            DUPLICATE_DOCUMENT_ID
UNSERIALIZABLE_VALUE          RENDER_FAILED
INVALID_VIEW_REGISTRATION     VIEW_ENTRY_MISSING
VIEW_ENTRY_VERSION_MISMATCH   CAPABILITY_UNAVAILABLE
INVALID_SNAPSHOT              OBJECT_DIGEST_MISMATCH
INVALID_BRIDGE_ADMISSION      HANDLE_CLOSED
IO_ERROR                      INTERNAL_ERROR
```

The error also carries `retryable` and can include `subject`, `expected`, `actual`, `details`, and
`cause`. Retry only when `retryable` is true, and capture a fresh complete handle rather than
reusing partial objects.

# Evidence and related architecture

The export contract is defined in tagged
[`packages/publication/src/index.ts`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/publication/src/index.ts),
with capture and bridge behavior exercised by the packed-package tests. See
[Public publication](../architecture/public-publication-boundary.md) for the end-to-end pipeline and
[Security and trust boundaries](security-and-trust-boundaries.md) for admission decisions.
