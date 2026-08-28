# Superbee documentation

This repository contains Superbee's public, source-grounded documentation bundle and the minimal
tooling that publishes it as a human site.

```text
verified product evidence
  -> public .superbee bundle
  -> superbee/publication
  -> superbee-portal + @superbee/portal-docs + @superbee/docs-tooling
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

## Release documentation

Navigation and maintained pages use the stable `releases/current` and `sources/current-release`
bundle identities. A verified release updates those identities and creates immutable versioned
records with one idempotent command:

```bash
cp examples/release-input.example.json /tmp/superbee-release.json
# Fill the handoff with facts and verification from the completed release.
npm run docs:release -- --manifest /tmp/superbee-release.json
npm run docs:release:check
```

The JSON file is ephemeral release-process input, not another persisted documentation authority.
The command writes all four documents through Superbee, refuses to alter existing version history,
and converges to a no-op when retried. The repository check rejects a package version pinned in
ordinary pages; exact versions remain available in release, evidence, and migration records.

## Deployment

Portal builds the public site into `dist`. Cloudflare Workers Static Assets serves that directory
without a Worker script. Validate the generated deployment locally before uploading it:

```bash
npm run portal:build
npm run cloudflare:check
```

Cloudflare Workers Builds uses these commands:

```text
Build:   npm ci && npm run tools:bootstrap && npm run portal:build
Deploy:  npx wrangler deploy
Preview: npx wrangler versions upload
```

`main` is the production branch. Other branches upload isolated Worker versions with preview URLs.

## Diagrams

Mermaid does not execute inside Superbee Markdown. Diagram source is compiled into a source-bound,
self-contained View whose exact committed bytes Portal admits:

```bash
npm run diagram:build   # apply source -> public bundle View
npm run diagram:check   # prove checked-in source/View/admission agreement
npm run portal:preview  # inspect the exact Portal artifact locally
```

The reusable compilation boundary comes from the pinned packed `@superbee/docs-tooling` package;
the thin consumer-owned bundle adapter lives under `scripts/`. Diagram source uses directive-free
flowchart syntax without font overrides and printable ASCII in v1. Browser layout geometry may
differ slightly across operating systems, so
checks re-render for safety and accessibility while source-bound projection metadata detects drift;
Portal separately pins the exact committed View bytes.
