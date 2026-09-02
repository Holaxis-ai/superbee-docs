# Superbee documentation project guide

This public repository is the source and publication workspace for Superbee's public documentation.
Everything committed here is public by design. Never copy private strategy, embargoed plans,
credentials, security findings, personal data, workstation paths, or unpublished communications
into this repository or its `.superbee/` bundle.

## Authorities

- Product behavior answers to exact Superbee source, tests, schemas, packed packages, and verified
  release receipts. Documentation interprets those sources; it never overrides them.
- `.superbee/` is the public documentation bundle and documentation authority.
- `portal.config.json` owns the renderer-neutral product identity, navigation, supporting-document
  allowlist, branding, and optional guidance pointer shared by both outputs. Portal-only and
  MkDocs-only settings live under their target blocks. The guidance pointer never carries prose:
  the quoted bytes and their links stay owned by the published document it names.
- Generated static SVG, Portal data, MkDocs input/site files, and deployed bytes are projections of
  the bundle and declared source inputs.
- `@superbee/portal-cloudflare` owns verified host assembly, Cloudflare capability translation,
  reconciliation, external probes, and rollback. `scripts/deployment-assets.mjs` contributes only
  this site's two exact entry redirects, `scripts/cloudflare-worker.mjs` supplies the stable Worker
  entry, and `scripts/reconcile-cloudflare.mjs` binds the Docs target and immutable provenance. Never
  hand-edit generated `_redirects` or `_headers`, add a file to the inventory-exact `dist` artifact,
  or treat a bare Wrangler command as deployment agreement.
- Page freshness is a derived publication fact, never hand-authored display text. `Last updated`
  means the document's OKF meaningful-change clock when one exists; otherwise it is the last commit
  time for the exact clean, tracked source file in a full Git history. `Last verified` is reserved
  for a separately modeled immutable verification fact. Release applicability remains the product
  version label and is not a freshness date. Unknown facts are omitted.
- Use Superbee commands for bundle documents and byte promotion. Keep ordinary source and tooling
  changes on branches and deliver them through pull requests.

## Diagrams do not render from Markdown

A fenced `mermaid` block is source code, not a rendered diagram. Superbee intentionally keeps raw
HTML, SVG, and Markdown images inert. Never tell a user or reviewer that Mermaid will render merely
because a fence exists.

Use the repository contract:

```bash
npm run diagram:build
npm run diagram:check
npm run portal:preview
```

`diagram:build` compiles declared Mermaid source at build time, promotes the exact source and
admitted static SVG into the public bundle, and writes the exact v3 publication receipt.
`diagram:check` recompiles to verify safety and accessibility, then rejects source-bound projection
or exact source/SVG/receipt drift without requiring browser geometry to be byte-identical across
operating systems. Retained View HTML and registrations are legacy predecessor evidence only; the
static publication command does not update or depend on them.

Diagram source uses directive-free flowchart syntax without font overrides and printable ASCII in
v1. This keeps renderer inputs bounded and every layout glyph inside the pinned embedded
font; unsupported syntax or characters fail before rendering.

The exact `@superbee/docs-tooling` package owns validation and source-bound source-to-SVG
compilation. It must not import deployment code or this site's content.
Its explicit `superbee-docs diagram apply` conductor is the only diagram publication adapter; this
repository supplies the source, manifest, docs-site configuration, and resulting receipt.
If it reports an interrupted apply, run the repository's complete `npm run diagram:rollback`
recovery command before retrying or changing dependency pins. Never commit `*.apply-intent.json`:
the ignored journal contains local paths and exact recovery preimages.

## Working agreement

1. Orient with `superbee home --dir .superbee`, then inspect the relevant source evidence and bundle
   records before writing.
2. Before authoring a reader-facing page, read `design/docs-operating-model` and
   `plans/docs-coverage`. Confirm the page's audience, primary content mode, successful outcome,
   governing evidence, operational `Documentation Trigger` record, and journey check. Run
   `npm run docs:impact -- --changed <source-path>` for relevant product changes. Use one active
   branch or pull request as the observable claim on a bounded page or coupled page set; update the
   coverage plan when its scope or status materially changes.
3. Keep unknown behavior explicitly unknown. Use exact source commits and package identities.
4. Add ordinary documents first. Introduce a Kind only after repeated documents prove stable fields
   or lifecycle needs.
5. Every architecture diagram answers one question, names its audience and scope, includes an
   accessible narrative, labels directed relationships, and links material claims to evidence.
6. Run `npm run check` before handoff. It validates the public boundary, diagram agreement, bundle,
   Portal artifact, and tests.
7. Generated bytes change only through their owning command. Do not hand-edit admitted static SVG,
   publication receipts, freshness dates, or retained legacy View evidence.
