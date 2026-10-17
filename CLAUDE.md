# Superbee documentation project guide

This public repository is the source and publication workspace for Superbee's public documentation.
Everything committed here is public by design. Never copy private strategy, embargoed plans,
credentials, security findings, personal data, workstation paths, or unpublished communications
into this repository or its `.superbee/` bundle.

## Authorities

- Product behavior answers to exact Superbee source, tests, schemas, packed packages, and verified
  release receipts. Documentation interprets those sources; it never overrides them.
- Hosted `holaxis-sites/superbee-docs` owns public content. `.superbee/` is a local writer checkout
  or a verified read projection of that bundle; Git owns code and `assistant/` configuration.
- The installed `codebase-documentation` recipe and the linked Documentation System, Publication,
  and Section records in `.superbee/` own renderer-neutral product identity, navigation,
  supporting-document selection, and operational exclusions. `portal.config.json` names that
  publication and owns only target/build overlays: branding, optional guidance, diagrams, Views,
  indexing, routes, and deployment. The guidance pointer never carries prose; the quoted bytes and
  their links stay owned by the published document it names.
- Generated static SVG, Portal data, MkDocs input/site files, and deployed bytes are projections of
  the bundle and declared source inputs.
- `@superbee/portal-cloudflare` owns verified host assembly, Cloudflare capability translation,
  reconciliation, external probes, and rollback. `scripts/deployment-assets.mjs` contributes only
  this site's two exact entry redirects, `scripts/cloudflare-worker.mjs` supplies the stable Worker
  entry, and `scripts/reconcile-cloudflare.mjs` binds the Docs target and immutable provenance. Never
  hand-edit generated `_redirects` or `_headers`, add a file to the inventory-exact `dist` artifact,
  or treat a bare Wrangler command as deployment agreement.
- Page freshness is a derived publication fact, never hand-authored display text. `Last updated`
  means the document's OKF meaningful-change clock when one exists; otherwise it is the frozen last commit
  time for the exact source bytes in `freshness-baseline.json`. `Last verified` is reserved
  for a separately modeled immutable verification fact. Release applicability remains the product
  version label and is not a freshness date. Unknown facts are omitted.
- Use Superbee commands for bundle documents and byte promotion. Keep ordinary source and tooling
  changes on branches and deliver them through pull requests.

## Content lives in the hosted bundle

The production site builds from hosted `holaxis-sites/superbee-docs`. `assistant/` contains the
assistant instructions and golden questions in Git; composition copies them into a disposable build
bundle, never into a hosted writer checkout.

- CI checks, assistant evaluation and freshness jobs run `npm run content:snapshot`. It downloads
  the retained export of a successful main `verify-production.yml` run, validates its identity,
  counts and full tree digest, and materializes a reader projection. No workload token reaches PRs.
  The snapshot is the last verified production content revision, not necessarily the latest edit.
  Run the production workflow on main to verify and publish newer hosted edits.
- Production's environment-bound acquire job alone has OIDC permission. `DOCS_HOSTED_APP_ID` must
  identify the existing read-only app; missing configuration fails closed. There is no Git fallback.
  Exports are retained for 30 days. If none remain, dispatch the production workflow and retry.
- Git no longer tracks content: `.superbee/` is ignored. It is either a reader projection or a
  writer checkout, never a source of truth. Rollback uses hosted history, not Git.
- **Writing content.** Use a separate clean code clone without a `.superbee` folder, then run
  `npm run content:checkout`. It binds this exact workspace/bundle through the public CLI. Use normal
  Superbee document verbs with `--dir .superbee`, then `npm run content:sync` once per edit batch.
  Existing folders are preserved and must already be registered to the exact target. Read acquisition
  refuses any checkout marker, so it cannot overwrite unsent edits. Run builds directly on a writer
  checkout; do not run `content:snapshot` or `acquire` there.
- Every content-writing script (`docs:release*` writers, `cli-reference:build`, `diagram:build`,
  `diagram:upgrade-static`, `diagram:rollback`) runs through `scripts/content-writer.mjs`, which
  refuses unless `.superbee` is this site's registered hosted checkout. A write to a reader
  projection would otherwise be silently lost.
- Ordinary files (Mermaid source, SVG, View HTML, images) sync like documents: edit the file in
  place, then `npm run content:sync`. Sync sends exact bytes, keeps the hosted MIME type and
  refuses a stale write with a version conflict that preserves your local bytes. A new file is
  sent with `superbee promote .superbee/<key> --doc-key <key> --dir .superbee`, which delivers at
  once; the source must already be at that path inside the checkout.
- **Diagram publication waits for a `@superbee/docs-tooling` fix.** Version 0.2.4 promotes each
  diagram from a temporary stage file, and a hosted checkout refuses a promote whose source is not
  the target path, so `diagram:build` and `diagram:upgrade-static` fail before sending anything.
  `diagram:rollback` recovers the interrupted apply. Do not hand-place compiled SVG, and do not add
  a site-specific upload bypass. Upgrade docs-tooling once it stages bytes at the checkout path.
- A blob version conflict currently stays held in that checkout: no edit, restore or promote
  clears it. Copy your bytes out, run `superbee checkout --release .superbee` after sending any
  unsent document edits, check out again and reapply. A send that never reached the host can
  likewise stay `unknown`; keep the receipt and recover the same way.
- `freshness-baseline.json` freezes Git commit times against exact document bytes, regenerated
  from Git immediately before the content left it. Keep it; it cannot be regenerated now. Later
  hosted edits carry their own clock. Release review/reuse receipts include the full ignored
  content tree as well as Git inputs.

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
admitted static SVG to the hosted bundle through the writer checkout, and writes the exact v3
publication receipt, which lands in Git by pull request. See the docs-tooling caveat above.
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
