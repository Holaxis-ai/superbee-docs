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

## Documentation selection

`portal.config.json` owns the ordered primary navigation. The production
`documentation-selection.json` contract names the additional public support documents that output
adapters must include without placing them in that navigation. The public documentation set is the
explicit union of those two lists; adapters must not follow links to expand it implicitly.

Keep the support list unique and canonically ordered. `npm run bundle:check` verifies its stable v1
schema, confirms every selected support document exists in `.superbee`, and rejects overlap with
the primary navigation.

## Development

Node.js 22.12 or newer is required.

```bash
npm ci
npm run tools:bootstrap
npm run check
```

The bootstrap command builds the exact pinned Superbee publication and Portal commits into local
development packages. This temporary step disappears once compatible releases are available from
npm. Before changing either exact pin, confirm that no `*.apply-intent.json` transaction journal is
pending; finish or roll back that operation with the package version that created it first. Journals
contain local paths and exact recovery preimages and are intentionally ignored by Git.

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

The pinned packed `@superbee/docs-tooling` package owns both reusable compilation and the explicit,
namespace-bounded `superbee-docs diagram apply` publication conductor; this repository owns its
source, manifest, configuration, and receipt. Diagram source uses directive-free flowchart syntax
without font overrides and printable ASCII in v1. Browser layout geometry may
differ slightly across operating systems, so
checks re-render for safety and accessibility while source-bound projection metadata detects drift;
Portal separately pins the exact committed View bytes.

If `diagram:build` reports an interrupted apply, run `npm run diagram:rollback` before retrying.
That repository command supplies the required root and config arguments. Apply never removes stale
publications merely because the local receipt no longer lists them; pruning is a separate,
explicitly authorized lifecycle operation.
