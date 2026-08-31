# Superbee documentation

This repository contains Superbee's public, source-grounded documentation bundle and the minimal
tooling that publishes it as a human site.

```text
verified product evidence
  -> public .superbee bundle
  -> one superbee/publication snapshot
  -> one owned @superbee/docs-projection projection
  -> Portal site at docs.getsuperbee.com + conventional MkDocs reference output
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

Both outputs publish a bounded `llms.txt` over that exact selection. Documentation pages advertise
their byte-exact Markdown source and the root discovery index; operational maintenance records stay
inspectable in the complete public bundle without entering these curated agent surfaces.

`documentation-selection.json` also carries the optional `agentGuidance` binding: the document id,
heading, and label of one section of one already-selected page that `llms.txt` quotes as its "when
to use" guidance. Only the pointer lives here. The quoted bytes and every link inside them come from
that published document, so the entry point can never become a second content authority, and the
build fails closed if the heading moves, is duplicated, gains a nested heading or code fence, or
links to something outside the selection. It also refuses any link or markup shape the renderer
cannot resolve into an absolute published URL -- a titled or angle-bracketed inline target, a
reference-style link or its definition, an autolink, a raw HTML element or comment, or an indented
code block -- because a page-relative link copied into `llms.txt` resolves against `/llms.txt`
instead of the page it came from.

## Agent-facing responses

An unknown documentation URL returns a real 404 carrying `404.html`, whose Markdown twin `404.md`
holds the same recovery facts. Both link to the documentation index, `llms.txt`, and the sitemap
with absolute URLs, because a recovery response is served from whatever path the reader requested.
Cloudflare selects those bytes through the `not_found_handling: "404-page"` asset setting.

The Markdown access contract is explicit URLs, not `Accept:` content negotiation. The reviewed
evidence in `research/agent-docs-discovery-surfaces` ruled negotiation a layer violation for this
stack — it would make the edge a second renderer over digest-bound bytes — so the origin serves the
`.md` sibling every page advertises and deliberately emits no `Vary: Accept`. Advertising a
negotiation the origin does not perform would fragment every shared cache in front of it while
changing nothing an agent receives. Portal's production verifier asserts that absence.

Documentation pages carry canonical, Open Graph, Twitter card, and product JSON-LD built only from
the projection's own product facts and this site's URL. No postal address, contact, social image, or
legal identity is emitted here; those facts belong to the public marketing site, which owns them.

## Development

Node.js 22.12 or newer is required.

```bash
npm ci
npm run tools:bootstrap
npm run portal:build
npm run mkdocs:sync
npm run check
```

The bootstrap command builds the exact pinned Superbee and Portal commits into local
development packages. The Portal build captures one source snapshot and projects the same explicit
27-document selection (19 navigated and eight supporting), brand asset, relationships, and six
admitted diagrams into both Portal and MkDocs target inputs. `mkdocs:sync` installs the exact locked
Python environment once; subsequent
`mkdocs:build` and repository checks are frozen and offline. This temporary packed-package step
disappears once compatible releases are available from npm. Before changing either exact pin,
confirm that no `*.apply-intent.json` transaction journal is pending; finish or roll back that
operation with the package version that created it first. Journals
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

Portal builds the immutable public site artifact into `dist`, and `npm run portal:build` then
assembles the uploaded directory `deploy` from it: every declared artifact file, verified against
the manifest digest it was published under, plus the deployment configuration Cloudflare reads from
an assets root and never serves. The two directories stay separate because the artifact is
inventory-exact, and Portal refuses to replace an output holding any file its manifest does not
name. `scripts/deployment-assets.mjs` owns that assembly and generates both configuration files, so
a deployed copy cannot drift from what was reviewed.

`_redirects` comes from a reviewable rule table. Today it sends the two guessed entry paths `/docs`
and `/docs/` to the canonical root; each rule names one exact path, so every other missing route
still reaches the published recovery body as a real 404.

`_headers` comes from the artifact's own inventory. Wrangler labels each uploaded asset from its
file extension and never consults the declared inventory, so a declared type can drift from the
served one: `/llms.txt` is declared `text/markdown` and was served as `text/plain`, while Cloudflare
currently omits the declared UTF-8 parameter from text responses. The generator compares every
published path's declared type against a measured table of what this host sends for that extension.
It emits an extension splat only when the complete inventoried family has one declared type, keeps
mixed or unmeasured cases on exact paths, and maps clean HTML routes back to their artifact files.
The trailing-slash documentation family also gives a missing documentation route the declared HTML
recovery type. If the resulting rules exhaust Cloudflare's hundred-rule budget, the build fails.

The MkDocs adapter independently materializes a conventional reference site under ignored
`.tmp/mkdocs/site` from the same owned projection; it is validated but not deployed by this
repository. Cloudflare Workers Static Assets serves only `deploy`, without a Worker script.
Validate the generated deployment locally before uploading it:

```bash
npm run portal:build
npm run cloudflare:check
```

After a deployment, compare the live origin against the exact artifact this repository built:

```bash
npm run verify:production -- --base https://docs.getsuperbee.com --dist dist
```

The command is a thin consumer of Portal's host-neutral verifier. Portal checks exact status, bytes,
media types, response headers, audience policy, fallback behavior, content negotiation, canonical
HTML routes, and their exact 307 aliases from the artifact's hosting requirements. This repository
adds only its page metadata, advertised Markdown-alternate, and two guessed `/docs` entry-route
assertions to the same receipt. No static-byte or canonical-redirect capability is waived.

Cloudflare Workers Builds uses these commands:

```text
Build:   npm ci && npm run tools:bootstrap && npm run portal:build
Deploy:  npx wrangler deploy
Preview: npx wrangler versions upload
```

`main` is the production branch. Other branches upload isolated Worker versions with preview URLs.

## Diagrams

Mermaid does not execute inside Superbee Markdown. Diagram source is compiled into a source-bound,
admitted static SVG whose exact committed bytes both documentation outputs consume:

```bash
npm run diagram:build   # apply source -> public bundle static SVG + v3 receipt
npm run diagram:check   # prove checked-in source/SVG/receipt agreement
npm run portal:preview  # inspect the exact Portal artifact locally
```

The pinned packed `@superbee/docs-tooling` package owns both reusable compilation and the explicit,
namespace-bounded `superbee-docs diagram apply` publication conductor; this repository owns its
source, manifest, configuration, and receipt. Diagram source uses directive-free flowchart syntax
without font overrides and printable ASCII in v1. Browser layout geometry may
differ slightly across operating systems, so
checks re-render for safety and accessibility while source-bound projection metadata detects drift;
both output adapters separately pin the exact committed static SVG bytes. The old View HTML and
registrations remain byte-for-byte predecessor evidence; they are not maintained publication output.

If `diagram:build` reports an interrupted apply, run `npm run diagram:rollback` before retrying.
That repository command supplies the required root and config arguments. Apply never removes stale
publications merely because the local receipt no longer lists them; pruning is a separate,
explicitly authorized lifecycle operation.
