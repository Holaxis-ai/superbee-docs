# Superbee documentation

This repository contains Superbee's public, source-grounded documentation bundle and the minimal
tooling that publishes it as a human site.

```text
verified product evidence
  -> public .superbee bundle
  -> superbee/publication
  -> superbee-portal
  -> docs.getsuperbee.com
```

The repository is public by design. Private planning, credentials, security work, and unpublished
communications belong elsewhere.

## Development

Node.js 22.12 or newer is required.

```bash
npm ci
npm run tools:bootstrap
npm run check
```

The bootstrap command builds the exact pinned Superbee publication and Portal commits into local
development packages. This temporary step disappears once compatible releases are available from
npm.

## Diagrams

Mermaid does not execute inside Superbee Markdown. Diagram source is compiled deterministically into
an admitted, self-contained View:

```bash
npm run diagram:build   # apply source -> public bundle View
npm run diagram:check   # prove checked-in source/View/admission agreement
npm run portal:preview  # inspect the exact Portal artifact locally
```

The reusable compilation boundary lives under `tooling/diagram-pipeline/`; the thin bundle adapter
lives under `scripts/`. Diagram source uses printable ASCII in v1 so every rendered glyph comes
from the pinned embedded font rather than a platform fallback.
