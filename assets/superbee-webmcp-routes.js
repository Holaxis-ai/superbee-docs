/**
 * Which documents have a page on this site, and what their page URL is.
 *
 * This lives apart from the bootstrap so it can be imported and exercised directly by a test. The
 * bootstrap imports its dependencies by absolute site URL, which no test runner can resolve, so a
 * resolver defined there could only ever be checked by grepping its source - and a grep cannot
 * tell a working resolver from one that answers the same way for every document.
 *
 * It has no imports of its own, so it is a leaf both in the browser and in a test.
 */

/**
 * Builds a `presentationUrlFor` from a loaded publication.
 *
 * The naive resolver - map every document id to `/docs/<id>/` - is wrong here, because the read
 * model carries the complete public bundle and is strictly larger than the set rendered as pages.
 * It would emit a confident URL that 404s for the difference, and a wrong link is worse than none:
 * an agent follows it instead of using `rawPath`, which every result already carries.
 *
 * The artifact manifest settles which is which. It is the build's own inventory of published
 * files, it arrives with the publication in the same load so consulting it costs no request, and
 * it is covered by the artifact digest, so it cannot drift from what was published.
 */
export function presentationUrlResolverFor(publication) {
  const published = new Set(publication.manifest.files.map((file) => file.path));
  return ({ kind, id }) => {
    // This site publishes no page for a View, and the tools already report a View's raw entry
    // identity, so inventing a route for one would be a claim the site cannot keep.
    if (kind !== "document") return undefined;
    // Look up RAW, emit ENCODED, mirroring the two functions Portal keeps side by side: it writes
    // the file at the raw id and links it percent-encoded. Building one string for both would tie
    // correctness to those forms coinciding, which they do today only because every id that can
    // produce a page is gated to characters `encodeURIComponent` leaves alone.
    //
    // Two encoders exist upstream and agree only on that gated alphabet: Portal's canonical route
    // encoder also escapes `!'()*`, which `encodeURIComponent` leaves raw. If the id space ever
    // widens, this is the line that has to choose between them rather than assume they match.
    if (!published.has(`docs/${id}/index.html`)) return undefined;
    return `/docs/${id.split("/").map(encodeURIComponent).join("/")}/`;
  };
}
