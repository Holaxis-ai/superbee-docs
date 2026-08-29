---
type: Design
title: Documentation site experience contract
description: >-
  Stable human experience and bundle-to-Portal boundary for the Superbee
  documentation site.
superbee_updated_by: openai/codex
---
# Outcome

The Superbee documentation site feels familiar to readers of excellent developer documentation
while revealing Superbee's distinctive strength: a complete, inspectable knowledge bundle beneath
the curated reading experience. A reader can start quickly, navigate by goal, search precisely,
inspect sources, and move between prose and registered Views without learning the repository layout.

This is a stable interface between the documentation bundle and Portal. It does not prescribe a
specific frontend framework or move product definitions into site code.

The ownership split in this contract is current: Portal captures and verifies the complete
publication snapshot, emits the stable read model and browser client, admits exact registered Views,
and composes one explicit presentation contribution. The documentation client owns editorial
navigation, clean static routes, search, theme, and all visible page structure through that
contribution. The experience clauses below remain target requirements unless the coverage plan and
exact built artifact mark them delivered; they must not be read as claims that every interaction is
already implemented.

# Experience principles

1. **Answer first.** Page introductions state the outcome or governing fact before background.
2. **Goals before taxonomy.** Primary navigation uses reader language; internal content modes remain
   available as metadata and authoring guidance.
3. **Progressive disclosure.** Common paths stay concise. Exact constraints, provenance, raw bundle
   structure, and historical detail remain one action away.
4. **Evidence without noise.** Versions and sources are visible where they affect trust, but hashes
   and raw objects never dominate the main reading flow.
5. **One content source.** Navigation, search, and page chrome project bundle content; they do not
   fork it.
6. **Accessible by construction.** Keyboard, narrow-screen, zoom, reduced-motion, contrast, and
   screen-reader behavior are part of the page contract.

# Information architecture

The launch navigation is:

- Get started
- Core concepts
- Guides
- Reference
- Releases and migrations
- Architecture and contributing

As verified material grows, Integrations and Examples may earn first-level placement. Troubleshooting
may become first-level when its inventory is large enough; until then it is routed from Guides and
Reference. A persistent action exposes the complete public bundle for inspection.

The global header provides the official Superbee mark with a Docs label, search, the current
supported version when relevant, a repository link, and an accessible mobile-navigation trigger.
On desktop, articles use ordered left navigation, a restrained reading column, breadcrumbs, and an
on-page heading index. The complete public publication remains inspectable through Portal's
versioned read model, snapshot, object map, manifest, and raw bundle paths. This site does not ship
or maintain a generic explorer UI.

Breadcrumbs show conceptual location. Each article ends with a small
set of prerequisites, related concepts, and likely next actions generated from declared document
relationships plus editorial ordering.

# Page patterns

## Home

- One-sentence product explanation.
- Primary action for installation or first use.
- Two or three goal-oriented paths such as start, understand, and integrate.
- One credible example or product representation.
- Direct routes to reference, troubleshooting, and the complete bundle.

The home page orients readers within the documentation. Product marketing remains on the marketing
site.

## Section landing

- What the section helps the reader accomplish.
- A recommended starting page.
- Three to six ordered journeys or concepts.
- Secondary comprehensive index below the curated path.

## Article

- Title and concise outcome.
- Version or scope badge only when relevant.
- Prerequisites and time/complexity cue for procedures.
- Stable heading anchors and table of contents for longer pages.
- Copyable code with accessible language labels.
- Callouts limited to note, warning, security, compatibility, and verified result.
- Clear verification checkpoint and troubleshooting route.
- Evidence and last-reviewed detail in restrained metadata.
- Related pages, next action, and source/visual links.

## Reference

- Searchable and deep-linkable entries.
- Exact syntax, defaults, constraints, output shape, exit behavior, and examples.
- Generated facts visibly identified and bound to a package version.
- Authored explanation linked once and reused across entries.

## Release or migration

- Exact version and channel.
- User-visible changes.
- Who must act and the shortest safe action.
- Compatibility window and rollback or recovery information.
- Verified package and source identities available under details.

# Presentation primitives

The documentation presentation should provide reader-facing rendering for:

- Markdown headings, lists, links, task steps, tables, and quotations;
- inline code and fenced code with copy affordance and horizontal overflow containment;
- notes, warnings, security constraints, compatibility notices, and verified outcomes;
- responsive tables with an accessible small-screen alternative;
- build-time technical diagrams as responsive inline static figures, with optional expansion for detail;
- registered Views, when a page genuinely needs an interactive or executable presentation, with an obvious launch action and return path;
- image or artifact downloads that remain inert unless admitted through an existing safe pathway;
- source citations, version badges, and last-reviewed metadata;
- empty, unavailable, stale, and superseded states.

Code copy confirmation is announced accessibly. Callouts use both a visible label and an icon, never
color alone. Static diagrams are readable in the page without JavaScript. Views open inside the
documentation frame or a focused stage with a clear return path only when their interactive or
executable behavior earns that stronger runtime isolation.

Any semantic primitive not already present in the normalized publication and canonical rendering
contract must first be represented in that shared contract or remain deferred. Portal may decorate
declared classes, attributes, or normalized metadata; it may not infer callouts, anchors, lifecycle,
aliases, tags, or review state heuristically from prose or parse Markdown a second time.

Mermaid fences remain source text. The repository's pinned build-time toolchain compiles declared
diagram sources into exact accessible SVG bytes, and documentation pages present those bytes as
ordinary responsive static assets. A separately registered View projection may remain available for
host-native presentation, but documentation rendering does not launch, authorize, bridge, or depend
on that View.

# Search and discovery

Search covers title, description, headings, body, aliases, type, and declared tags while returning
human pages ahead of operational records for ordinary queries. Results show section, short context,
content mode, and version scope when relevant.

The search index is generated from the captured normalized publication snapshot at build time rather
than from a separate Markdown parser or external crawler. Search is fully operable from the keyboard,
with a visible trigger and conventional `/` or Command/Control-K shortcut, managed focus, Escape
handling, and announced result state.

The URL contract provides stable routes and heading anchors. Renamed public pages retain redirects or
an explicit successor. Search indexes only the captured publication snapshot so results and opened
pages cannot disagree.

# Versions and freshness

The first release documents one current stable product line. Do not build a version switcher until
two simultaneously supported documentation sets exist. Pages with version-sensitive behavior show
their tested package or compatibility range; evergreen explanations avoid decorative version noise.

Stale or superseded pages remain inspectable but display a clear successor or limitation. Technical
hashes and full provenance are available in details and the published manifest/read-model endpoints.

# Brand and visual direction

- Use Superbee's dark-first Night and Deep surfaces for site chrome, navigation, code framing, and
  emphasized technical representations.
- Use Paper, White, Ink, Slate, and Rule for long-form reading surfaces. Superbee blue, teal, and
  amber are not body-text colors on light surfaces.
- Use DM Sans for body and UI, JetBrains Mono for code and technical metadata, and Cormorant
  Garamond sparingly for major editorial headings. Dense reference pages use DM Sans.
- Preserve the two-pixel radius convention and a precise, structural visual tone.
- Prefer network, signal, and verification motifs when they communicate actual structure; avoid
  decorative diagrams.
- Copy committed Superbee logo assets from the approved private brand source. Do not recreate or expose
  the generator in this public repository.

# Responsive and accessibility contract

- All navigation and article actions work from the keyboard with visible focus.
- The layout remains usable at 320 CSS pixels, 200% zoom, and with text enlargement.
- Content order remains logical when sidebars collapse.
- Color never carries meaning alone; contrast follows the declared brand tokens.
- Motion respects reduced-motion preferences and is never needed to understand content.
- Registered Views have accessible names, narratives, and a nonvisual equivalent.
- Code, tables, and diagrams do not force page-wide horizontal scrolling.
- Page landmarks, heading hierarchy, skip links, and current navigation state are exposed
  semantically.

# Bundle-to-Portal contract

The bundle supplies canonical document IDs, titles, descriptions, content, relationships, mode or
type, version scope where needed, evidence links, registered View relationships, and lifecycle
signals once stabilized. Portal owns the presentation-neutral publication artifact, strict identity
and integrity checks, stable read model, safe Markdown/View browser primitives, and deployment
adapters. The documentation client owns routes, navigation projections, search indexes, chrome, and
responsive layout.

Portal must not infer public truth from source directory names, execute raw bundle HTML, rewrite
Markdown semantics, or invent release/version state. Site-specific editorial ordering may be
declared in repository configuration until repeated structure justifies a bundle convention.

Portal is headless by default and emits no site shell. The documentation presentation is one
explicit, immutable contribution over the normalized snapshot plus any construction-time static
artifact bindings supplied by the documentation toolchain. It produces clean stable document
routes, canonical metadata, sitemap inputs, and useful article HTML without requiring JavaScript;
JavaScript enhances search and interaction. All content remains available without it. No Superbee-specific
document ID, product vocabulary, or generic explorer UI is hard-coded into Portal.

# Representative vertical slice

Design and test the system against real content:

1. Documentation home and Get started section.
2. Install and setup tutorial with commands, checkpoints, note, warning, and troubleshooting link.
3. Core mental-model explanation with relationships.
4. CLI reference page with generated facts.
5. System-context page with an inline static diagram and a separately inspectable registered View.
6. Release or migration page with version and provenance metadata.
7. Complete-publication inspection through the versioned manifest, read model, and raw bundle paths.

The slice must be tested on desktop and mobile, by keyboard, with a screen reader smoke test, and
through at least one evaluator and one first-time-user task.

# Deferred until evidence warrants it

- multiple documentation versions and a version switcher;
- runtime Mermaid or another executable Markdown extension;
- user accounts, comments, or personalization;
- AI chat over the docs;
- elaborate concept graphs as primary navigation;
- analytics beyond the minimum privacy-preserving signals needed to evaluate task success;
- a general theme/plugin system.

[documentation operating model](docs-operating-model.md)

[coverage and delivery plan](../plans/docs-coverage.md)
