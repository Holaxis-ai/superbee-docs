---
type: Guide
title: Preserve context between sessions
description: >-
  Leave a concise, verifiable handoff that a later agent can discover and
  continue.
superbee_updated_by: openai/codex
---
# Outcome

Leave a concise handoff that a later agent can discover, verify, and follow without reconstructing
the previous session from chat. This guide is for active users working in an existing bundle.

The procedure is verified against [the current stable release](../sources/current-release.md).

# Before you start

- Run `superbee home` and confirm that it names the intended bundle.
- Decide which facts belong in the handoff and which deserve their own durable documents.
- Keep the handoff free of secrets unless the selected bundle is an approved private location.

A Context Note is useful for near-term orientation. Decisions, evidence, specifications, and other
long-lived knowledge should remain in their own documents so they can be found and cited directly.

# 1. Confirm the Context Note Kind

Inspect the bundle's active conventions:

```sh
superbee kinds
```

Look for `Context Note`. New bundles created with the default recipe already carry it. If the Kind
is absent and the bundle owner wants cross-session handoffs, apply the built-in definition:

```sh
superbee recipe add context-notes
```

This installs the convention into the selected bundle. It does not create a note or select a
different workspace.

# 2. Write the handoff

Choose a unique, descriptive ID such as `docs-publishing-handoff`. Save the following body in a
temporary file outside the bundle, for example `/tmp/superbee-handoff.md`:

```md
# Summary

The documentation publication path now produces the same selected pages for both site outputs.

## Decisions

- Keep the bundle documents as the content authority.

## Open work

- Review the mobile navigation before the next release.

## Pointers

- See the documentation operating model and the current release evidence.
```

Create the note through its declared Kind:

```sh
superbee new "Context Note" docs-publishing-handoff \
  --title "Documentation publishing handoff" \
  --body-file /tmp/superbee-handoff.md
```

`new` applies the Kind's `context-notes/` path prefix, checks the required `# Summary` heading, and
creates the document only when that ID is free. The receipt reports the final document ID.

If the handoff refers to an existing bundle document, add a relationship using the final ID:

```sh
superbee link add context-notes/docs-publishing-handoff \
  design/docs-operating-model \
  --text "continues from"
```

Links give a later reader a direct path to the durable source. They also let Superbee derive the
reverse backlink from the referenced document.

# 3. Verify the result

```sh
superbee doc read context-notes/docs-publishing-handoff
superbee link show context-notes/docs-publishing-handoff
superbee status
```

Confirm that the summary is complete, the relationship reaches the intended document, and status
reports no malformed content, Kind warning, or unintended unresolved link caused by the handoff.

# 4. Resume in a later session

Start with the selected workspace overview:

```sh
superbee home
superbee list --type "Context Note"
superbee doc read context-notes/docs-publishing-handoff
```

Context Notes appear newest first in the type-scoped list. The built-in Kind has a 24-hour
freshness horizon, so `superbee status` can identify a handoff whose orientation may need review.
The convention also marks Context Notes as collapsed in browse listings to keep transient handoffs
from crowding durable knowledge.

# Updating an existing handoff

`new` protects an existing note from replacement. Use an optimistic edit cycle when a handoff needs
revision:

```sh
superbee doc read context-notes/docs-publishing-handoff \
  --body-out /tmp/superbee-handoff.md --json

superbee doc read context-notes/docs-publishing-handoff \
  --field head_version

# Edit /tmp/superbee-handoff.md, then use the version returned above.
superbee doc update context-notes/docs-publishing-handoff \
  --body-file /tmp/superbee-handoff.md \
  --expected-version <head_version>
```

A stale version fails without replacing a newer edit. Read the current note again, reconcile the
changes, and retry with its current version.

# Recovery and limits

- If `Context Note` is absent, confirm the selected bundle and obtain approval before applying the
  recipe.
- If creation reports that the ID exists, read that note and update it or choose a new ID.
- If validation names `Summary`, add the exact level-one `# Summary` heading.
- If status reports an unresolved link, correct the target ID or create the intended target.
- If a note contains a settled decision or reusable evidence, preserve that knowledge in a focused
  document and link the handoff to it.

# Evidence and change triggers

The released implementation and tests for this journey are:

- [Context Note recipe definition](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/src/recipes.ts)
- [Kind creation and validation tests](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/kinds.test.ts)
- [Recipe and freshness tests](https://github.com/Holaxis-ai/superbee/blob/f4e1c37349627030f8201ff52028f71a9c92570a/packages/cli/test/recipes.test.ts)

Re-evaluate this page when the Context Note convention, recipe application, freshness behavior,
session overview, or optimistic update contract changes.

[understand reusable domain structure](../concepts/reusable-domain-structure.md)

[model recurring domain concepts](model-recurring-domain-concepts.md)

[CLI overview](../reference/cli-overview.md)
