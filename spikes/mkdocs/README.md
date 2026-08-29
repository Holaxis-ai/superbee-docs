# MkDocs neutral-projection spike

This disposable spike tests whether one renderer-neutral projection of the public Superbee
documentation bundle can feed an ordinary MkDocs site. It is not a production output adapter,
package, deployment path, or cutover.

The projection selects the 11 documents in the existing documentation navigation plus the eight
explicit support documents in `projection-selection.json`. It never follows links to grow that set.
A selected document linking to any other local document fails the projection build.
Deployment host and canonical-URL choices stay out of the projection and this proof materializer.

The current diagram verifier still proves exact SVG bytes through the existing View-backed
publication receipt. The projection strips those target-specific mechanics and contains only the
verified static asset binding. This is sufficient for the spike, but a promotable adapter still
depends on the separate static-first diagram-receipt work.

## Run

After `npm run tools:bootstrap`:

```sh
node spikes/mkdocs/projection.mjs --output .tmp/docs-projection
node spikes/mkdocs/materialize.mjs \
  --projection .tmp/docs-projection \
  --output .tmp/mkdocs
uvx --from 'mkdocs==1.6.1' mkdocs build \
  --clean --strict \
  --config-file .tmp/mkdocs/mkdocs.yml
uvx --from 'mkdocs==1.6.1' mkdocs serve \
  --clean \
  --config-file .tmp/mkdocs/mkdocs.yml \
  --dev-addr 127.0.0.1:8008
```

Both output directories must be absent before a run. They are ignored and may be deleted together
after inspection. The materialized document files are byte-identical copies of the projection's
immutable source objects. A small MkDocs hook adds page chrome and static diagram figures in memory;
it does not edit those files.

Cloudflare compatibility is a downstream static-byte check, not part of projection or rendering:

```sh
npx wrangler deploy --dry-run \
  --assets .tmp/mkdocs/site \
  --name superbee-docs-mkdocs-spike
```
