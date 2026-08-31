---
type: Guide
title: Artifacts and byte channels
description: >-
  Route canonical documents and opaque bytes correctly, preserve output purity,
  and recover versioned object operations.
superbee_updated_by: openai/codex/root
---
# Goal

Move documents and opaque files through the correct Superbee channel, preserve byte-stream purity,
and update or delete stored objects with explicit version control. This how-to is for operators,
integrators, and agents working locally or through an explicitly selected remote server.

The behavior is verified against [the current stable release](../sources/current-release.md).

# Choose the object and command

| Need | Stored object | Command |
| --- | --- | --- |
| Create a human-viewable HTML output and its record | HTML blob plus `Artifact` document | `artifact create` |
| Import or update an OKF Markdown document | Canonical document | `promote` with a `.md` key |
| Store any other bytes | Opaque blob | `promote` with a non-`.md` key |
| Export canonical document or raw blob bytes | File or stdout byte stream | `pull` |
| Discover opaque keys | Blob heads | `blobs` |
| Remove a document or blob by key | Hard delete | `delete --doc-key` |

Routing uses the destination key and checks the `.md` suffix case-insensitively. A Markdown file
sent to a non-`.md` key remains an opaque blob. A `.md` key is parsed, normalized, and validated as
an OKF document even when the local filename has another extension.

# Create a shareable Artifact

`artifact create` currently accepts self-contained HTML. It owns the two-object sequence: promote
the bytes beneath `artifacts/`, capture their version, then create a collision-safe `Artifact`
record with `entry`, `entry_version`, and active workflow state.

```sh
superbee artifact create report.html \
  --title "Quarterly evidence report" \
  --description "Reviewed claims and linked evidence." \
  --actor openai/codex/root
```

To replace a prior deliverable while preserving lineage:

```sh
superbee artifact create revised-report.html \
  --title "Quarterly evidence report, revised" \
  --supersedes artifacts/quarterly-evidence-report \
  --actor openai/codex/root
```

Inspect the returned document ID and blob key. If the record write fails after the blob succeeds,
the receipt reports the retained blob so it can be reused or removed deliberately. Superbee does
not silently erase a successfully stored object during recovery.

# Promote a canonical document

Prepare a complete OKF document with YAML frontmatter and Markdown body, then promote it through a
`.md` key:

```sh
superbee promote source-note.md --doc-key sources/source-note.md
```

The first write is create-only. Updating an existing document requires its current version:

```sh
superbee pull --doc-key sources/source-note.md --out source-note.md
DOC_VERSION="$(superbee doc read sources/source-note --field head_version)"
superbee promote source-note.md \
  --doc-key sources/source-note.md \
  --expected-version "$DOC_VERSION"
```

The document route rejects `--content-type`. It uses the document's own frontmatter and the same
Kind validation as ordinary document writes. The exported form is Superbee's canonical OKF
serialization, so hand-authored YAML formatting can normalize on round trip.

# Promote and update opaque bytes

Use any key that does not end in `.md`:

```sh
superbee promote diagram.svg \
  --doc-key assets/diagram.svg \
  --content-type image/svg+xml
```

Omitting `--expected-version` means expect-absent creation. Keep the returned version for a later
safe update:

```sh
superbee promote diagram.svg \
  --doc-key assets/diagram.svg \
  --content-type image/svg+xml \
  --expected-version sha256:CURRENT_VERSION
```

An explicit content type wins at write time. The filesystem backend does not persist a separate
content-type override and infers it from the key again on later reads. State-keeping backends can
return the stored override. Use a meaningful extension when downstream readers depend on the type.

# Pull without contaminating bytes

Write to a file when you also want the normal receipt on stdout:

```sh
superbee pull --doc-key assets/diagram.svg --out diagram.svg
```

Stream bytes through a pipe with `--out -`:

```sh
superbee pull --doc-key assets/diagram.svg --out - > diagram.svg
```

In stdout mode, raw bytes are the only stdout content. The receipt and any error go to stderr. Blob
pulls verify the returned bytes against their version; document pulls return the canonical current
document and its version token.

# List and delete

```sh
superbee blobs --prefix assets/ --limit 100
superbee delete --doc-key assets/diagram.svg \
  --expected-version sha256:CURRENT_VERSION
```

`blobs` excludes documents and defaults to 100 results; use `--limit 0` for all. Delete is hard,
idempotent for an absent key, and non-cascading. Links or registry records that referred to a
deleted object remain and can surface as health findings. Reserved document keys cannot be deleted.

# Remote and private-state boundaries

Add `--remote <url>` only when the remote server was selected deliberately. `--dir` and `--remote`
are mutually exclusive. The reference server has no authentication and is intended for loopback
development use; see [Wire protocol and reference server](../reference/wire-protocol-and-reference-server.md).

Package-private credentials, host registrations, and user catalog state are not bundle blobs.
Manage them through setup and platform-specific private state. Never promote secrets into a bundle
that could be synchronized or published.

# Recovery

| Symptom | Response |
| --- | --- |
| `STALE_HEAD` or conflict | Pull the current object, reapply the intended edit, and promote with its fresh version. |
| `.md` content was stored as a blob | Pull and delete the blob key, then promote to the intended `.md` key. |
| A document import fails validation | Inspect `superbee kinds`, correct its frontmatter or body, and retry; use `--strict` when warnings must block. |
| A blob exists without its intended Artifact record | Use the reported retained key to finish the record or delete that exact blob. |
| Output bytes appear corrupt | Use `pull --out <file>` or redirect only stdout; do not merge stderr into the byte stream. |

# Evidence and related pages

The contract is grounded in the tagged
[`artifact`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/artifact.ts),
[`promote` and `pull`](https://github.com/Holaxis-ai/superbee/blob/v0.1.4/packages/cli/src/commands/promote.ts),
and storage implementations. See [Security and trust boundaries](../reference/security-and-trust-boundaries.md)
before storing public or sensitive material.
