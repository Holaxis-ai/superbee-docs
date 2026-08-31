---
type: Example
title: Research claims and evidence
description: >-
  Runnable claims recipe tutorial with provenance, guarded verification,
  citations, and supersession.
superbee_updated_by: openai/codex/root
---
# Outcome

Create a disposable claims bundle, file one measurable claim with reproducible provenance, cite it
from a report, challenge and verify it with compare-and-swap, then supersede it without erasing the
history. This tutorial is for researchers and analysts who need numbers to remain reviewable across
sessions and outputs.

The package-shipped `claims` recipe is verified against
[the current stable release](../sources/current-release.md).

# Starting state

Use an empty disposable directory and an actor name you will keep throughout the example. The
recipe ships as an inspectable package reference rather than a short built-in name. Resolve its
installed path first:

```sh
mkdir claim-demo
CLAIMS_RECIPE="$(npm root --global)/superbee/references/recipes/claims"
test -f "$CLAIMS_RECIPE/recipe.md"
superbee init --dir claim-demo/.superbee --recipe "$CLAIMS_RECIPE" --create-only
superbee kinds --dir claim-demo/.superbee
```

In PowerShell, the equivalent recipe-path check is:

```powershell
$ClaimsRecipe = Join-Path (npm root --global) "superbee/references/recipes/claims"
Test-Path (Join-Path $ClaimsRecipe "recipe.md")
superbee init --dir claim-demo/.superbee --recipe $ClaimsRecipe --create-only
```

If Superbee is installed in a project prefix instead of globally, replace `npm root --global` with
that install's `npm root` result. A plain `--recipe claims` is not a supported spelling.

Confirm `Claim` requires `title`, `progress_status`, and `reason`, permits the provenance fields
`evidence_command`, `evidence_commit`, and `artifacts`, and declares the lifecycle values `active`,
`challenged`, `locked`, and `deprecated`.

# 1. File a specific claim

The title is the claim and includes the measured number. The reason explains how it was derived.

```sh
superbee new "Claim" onboarding-completion \
  --dir claim-demo/.superbee \
  --title "8 of 10 participants completed onboarding without assistance" \
  --progress_status active \
  --reason "Counted successful completions in the reviewed session table." \
  --evidence_command "node scripts/count-completions.mjs fixtures/sessions.csv" \
  --evidence_commit "0123456789abcdef0123456789abcdef01234567" \
  --actor analyst/a
```

Checkpoint:

```sh
superbee doc read claims/onboarding-completion --dir claim-demo/.superbee
```

The document ID is beneath `claims/`, its title carries the actual finding, and its state is
`active`. The example commit is illustrative; real work must record the exact commit used by the
evidence command.

# 2. Add evidence and a citation

Create a source record and a report, then relate both to the claim:

```sh
superbee doc write sources/onboarding-sessions \
  --dir claim-demo/.superbee \
  --type Source \
  --title "Reviewed onboarding session table" \
  --body "Ten consented sessions, reviewed under the study protocol." \
  --actor analyst/a

superbee doc write reports/onboarding-summary \
  --dir claim-demo/.superbee \
  --type Report \
  --title "Onboarding summary" \
  --body "The completion result remains provisional until independent verification." \
  --actor analyst/a

superbee link add claims/onboarding-completion sources/onboarding-sessions \
  --dir claim-demo/.superbee --text evidence --actor analyst/a
superbee link add reports/onboarding-summary claims/onboarding-completion \
  --dir claim-demo/.superbee --text cites --actor analyst/a
```

Inspect both directions:

```sh
superbee link show claims/onboarding-completion --dir claim-demo/.superbee
```

The source appears as an outbound evidence link and the report appears as a derived backlink. That
backlink is the impact list when the claim changes.

# 3. Challenge and independently verify

Capture the exact version you reviewed:

```sh
CLAIM_VERSION="$(superbee doc read claims/onboarding-completion \
  --dir claim-demo/.superbee --field head_version)"
superbee doc update claims/onboarding-completion \
  --dir claim-demo/.superbee \
  --progress_status challenged \
  --expected-version "$CLAIM_VERSION" \
  --actor reviewer/b
```

The reviewer reruns `evidence_command` against `evidence_commit`, checks the source and exclusions,
then locks the fresh version:

```sh
CLAIM_VERSION="$(superbee doc read claims/onboarding-completion \
  --dir claim-demo/.superbee --field head_version)"
superbee doc update claims/onboarding-completion \
  --dir claim-demo/.superbee \
  --progress_status locked \
  --reason "Independent rerun reproduced 8 successful completions from 10 reviewed rows." \
  --expected-version "$CLAIM_VERSION" \
  --actor reviewer/b
```

Only a verified `locked` claim should support the final numeric statement. `STALE_HEAD` means the
claim changed during review; inspect the fresh version and rerun any affected evidence.

# 4. Supersede instead of rewriting a locked claim

When new sessions change the result, preserve the locked claim and file a successor:

```sh
superbee new "Claim" onboarding-completion-expanded \
  --dir claim-demo/.superbee \
  --title "17 of 20 participants completed onboarding without assistance" \
  --progress_status active \
  --reason "Expanded the reviewed sample from 10 to 20 sessions." \
  --evidence_command "node scripts/count-completions.mjs fixtures/sessions-20.csv" \
  --evidence_commit "fedcba9876543210fedcba9876543210fedcba98" \
  --link "supersedes=claims/onboarding-completion" \
  --actor analyst/a

CLAIM_VERSION="$(superbee doc read claims/onboarding-completion \
  --dir claim-demo/.superbee --field head_version)"
superbee doc update claims/onboarding-completion \
  --dir claim-demo/.superbee \
  --progress_status deprecated \
  --reason "Superseded by the expanded 20-session sample." \
  --expected-version "$CLAIM_VERSION" \
  --actor analyst/a
```

Update citing reports only after the successor is independently locked. `link show` on the old
claim identifies every citation needing review.

# Final verification

```sh
superbee list --type Claim --dir claim-demo/.superbee --limit 0
superbee link show claims/onboarding-completion --dir claim-demo/.superbee
superbee link show claims/onboarding-completion-expanded --dir claim-demo/.superbee
superbee status --dir claim-demo/.superbee
```

The final bundle preserves the original locked finding, its evidence and citations, a related
successor, attributed lifecycle changes, and an inspectable current state.

# Cleanup and adaptation

Remove the disposable `claim-demo` directory when the tutorial is complete. In real work, keep the
bundle under the chosen privacy and Git-sharing policy, replace illustrative commands and commits
with executable evidence, and use [Query, links, and backlinks](../guides/query-links-and-backlinks.md)
to review active, challenged, locked, and deprecated claims.

# Governing evidence

The model is defined by the tagged
[`claims` recipe](https://github.com/Holaxis-ai/superbee/tree/v0.1.4/packages/cli/references/recipes/claims)
and the stable versioned document and link commands.
