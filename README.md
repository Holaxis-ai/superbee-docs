# Superbee documentation

This repository contains Superbee's public, source-grounded documentation bundle and the minimal
tooling that publishes it as a human site.

```text
verified product evidence
  -> public .superbee bundle
  -> one superbee/publication snapshot
  -> codebase-documentation recipe + bundle-native publication model
  -> one Recipe Studio-compiled @superbee/docs-projection projection
  -> Portal site at docs.getsuperbee.com + conventional MkDocs reference output
```

The repository is public by design. Private planning, credentials, security work, and unpublished
communications belong elsewhere.

## Documentation selection

The installed `codebase-documentation` recipe defines Documentation System, Documentation
Publication, Documentation Section, and Documentation Trigger Kinds. Ordinary documents under
`documentation-systems/`, `documentation-publications/`, and `documentation-sections/` own the
renderer-neutral product identity and selection. Sections name ordered primary pages; the
publication names additional public pages that both outputs include outside navigation. Adapters
must not follow links to expand that explicit selection.

`portal.config.json` now carries only the publication identity and target/build overlays such as
brand assets, agent guidance, diagrams, indexing, Views, routes, and deployment settings. Recipe
Studio compiles the installed recipe and the linked bundle records into one projection. It rejects
missing pages, duplicate selection, navigation/support overlap, invalid operational exposure, or
recipe drift before either output is built.

Both outputs publish a bounded `llms.txt` over that exact selection. Documentation pages advertise
their byte-exact Markdown source and the root discovery index; operational maintenance records stay
inspectable in the complete public bundle without entering these curated agent surfaces.

The optional `documentation.guidance` binding carries the document id, heading, and label of one
section of one already-selected page that `llms.txt` quotes as its "when to use" guidance. Only the
pointer lives in configuration. The quoted bytes and every link inside them come from
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
stack because it would make the edge a second renderer over digest-bound bytes, so the origin serves the
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
npm run source:sync
npm run portal:build
npm run mkdocs:sync
npm run check
```

`npm ci` installs the exact Portal and Superbee packages recorded by the lockfile. The source sync
keeps an exact Superbee checkout only for source-grounded architecture checks. The Portal build
captures one source snapshot and compiles the same explicit
52-document selection (40 navigated and 12 supporting), brand asset, relationships, and eight
admitted diagrams into one projection consumed by both Portal and MkDocs. The
`@superbee/docs-mkdocs` package
owns the pinned uv command sequence: `mkdocs:sync` installs the exact locked Python environment
once, while `mkdocs:build` and repository checks are frozen and offline. Before changing the source
pin or package versions,
confirm that no `*.apply-intent.json` transaction journal is pending; finish or roll back that
operation with the package version that created it first. Journals
contain local paths and exact recovery preimages and are intentionally ignored by Git.

The adoption is one atomic repository change. If the private compiler or bundle-native model must
be rolled back, revert the adoption commit and run `npm ci`; that restores the prior docs-site/v2
configuration and local adapters together. Do not delete only the installed conventions or model
documents while docs-site/v3 remains active, because compilation intentionally fails closed on a
missing or drifted recipe.

## Release documentation

Navigation and maintained pages use the stable `releases/current` and `sources/current-release`
bundle identities. The reader-facing `releases/release-notes` page lists the current release and
immutable prior releases, while migration guidance stays beside it in navigation.

The daily release-freshness workflow compares the documented release with the public npm `latest`
package, GitHub release, and exact Git tag. Run the same deterministic probe locally at any time:

```bash
npm run docs:release:status
```

When it reports `update_required`, the output carries the exact package, integrity, source commit,
publication date, release URL, and generated GitHub notes. It also names the reader-facing fields
that still require agent judgment and the documentation-impact events to query. A verified release
then updates the stable identities, creates immutable versioned records, reconciles the release
archive and selection, and updates the exact site version with one idempotent command:

```bash
cp examples/release-input.example.json /tmp/superbee-release.json
# Fill the handoff with facts and verification from the completed release.
npm run docs:release -- --manifest /tmp/superbee-release.json
npm run docs:release:check
```

The JSON file is ephemeral release-process input, not another persisted documentation authority.
The command writes release documents through Superbee, refuses to alter existing version history,
and updates the bundle-native Documentation System and Publication records when needed. It
converges to a no-op when retried and never invents the summary, changes, user action,
compatibility, recovery, supported platforms, or verification performed. Review those fields
against the release and query the returned impact events before opening the documentation pull
request. The repository check rejects a package version pinned in ordinary pages; exact versions
remain available in release, evidence, and migration records.

## Deployment

Portal builds the immutable public site artifact into `dist`. The public
`@superbee/portal-cloudflare/static-assets` adapter then verifies that complete artifact and
atomically assembles `deploy`: every inventoried byte plus only the host configuration Cloudflare
consumes and does not serve. The two directories stay separate because `dist` is inventory-exact.
Portal must be able to reject any extra or changed byte in it.

The package derives `_headers` from the artifact's declared response policy and exact media types.
It also derives every canonical 307 HTML alias from the artifact's hosting requirements. This
repository contributes only two site-specific rules: `/docs` and `/docs/` return 301 redirects to
the canonical root. Each names one exact path, so every other missing route still reaches the
published recovery body as a real 404. `scripts/deployment-assets.mjs` is the small consumer binding
for that policy. It does not duplicate Cloudflare limits, MIME tables, integrity checks, or
filesystem replacement logic.

`scripts/cloudflare-worker.mjs` is similarly small. It exports the package's verified public Portal
handler under a stable Wrangler entry path. Portal owns byte validation, route admission, recovery,
opaque downloads, View isolation and bridge behavior, and the live deployment-effect identity.
Wrangler keeps presentation routes asset-first so generated headers and canonical redirects apply,
then sends `/data/*`, `/bundle/*`, and the View bridge to the Worker for verified dynamic policy.

The MkDocs adapter independently materializes a conventional reference site under ignored
`.tmp/mkdocs/site` from the same owned projection; it is validated but not deployed by this
repository. Validate the exact artifact, Cloudflare assembly, and staged runtime locally:

```bash
npm run portal:build
npm run cloudflare:check
npm run cloudflare:reconciliation:check
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

Production activation belongs to `.github/workflows/verify-production.yml`, not to Cloudflare Git
builds or a bare Wrangler command. Its uncredentialed build job checks out the exact `main` commit,
expands repository history, runs the deterministic build and staging checks, and uploads only the
completed `dist` artifact. The reconciliation job downloads those exact bytes, assembles the
package-owned Cloudflare layer without rebuilding the site, and re-resolves `origin/main`
immediately before activation. A changed desired commit fails closed.

Only the reconciliation step receives `CLOUDFLARE_API_TOKEN`. It calls the package's public
reconciler through `scripts/reconcile-cloudflare.mjs` with an immutable source, site, and toolchain
provenance tuple. The reconciler inspects provider generation, stages and digests the complete
activation unit, activates with strict generation protection, then externally verifies the live
effect. If a new activation fails verification and the prior generation was verified, the package
rolls back and verifies recovery. The workflow concurrency group never cancels an in-flight run, so
one production target has one serialized activation stream.

The workflow then runs the Docs-specific verifier over every expected status, byte digest, media
type, response header, redirect, fallback, and admitted View. An `if: always()` step uploads both
the reconciliation receipt and the Docs verification receipt for 30 days, including bounded
preflight failures and verified rollback outcomes. Its daily scheduled run uses probe mode and does
not mutate production, so deployment drift is detected against the current exact artifact.

Cloudflare's repository integration must remain disabled while this workflow is the production
writer. Enabling both would create two independent activation authorities. The
`npm run cloudflare:check` command remains a credential-free dry run, not deployment agreement, and
this repository intentionally exposes no `cloudflare:deploy` or `cloudflare:preview` script. `main`
is the production branch.

## Diagrams

Mermaid does not execute inside Superbee Markdown. Diagram source is compiled into a source-bound,
admitted static SVG whose exact committed bytes both documentation outputs consume:

```bash
npm run diagram:build   # apply source -> public bundle static SVG + v3 receipt
npm run diagram:check   # prove checked-in source/SVG/receipt agreement
npm run portal:preview  # inspect the exact Portal artifact locally
```

The exact `@superbee/docs-tooling` package owns both reusable compilation and the explicit,
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
