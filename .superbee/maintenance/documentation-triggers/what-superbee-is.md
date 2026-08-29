---
type: Documentation Trigger
title: What Superbee is change trigger
description: Operational change triggers for the What Superbee is documentation page.
superbee_updated_by: openai/codex
---
# Affected pages

[What Superbee is](../../concepts/what-superbee-is.md)

# Source paths

- `packages/cli/SKILL.md`
- `packages/cli/references/modeling-and-delivery.md`
- `packages/core/src/**`
- `packages/view-runtime/src/**`

# Product events

- `product-authority-model`
- `kind-role`
- `recipe-role`
- `view-role`
- `artifact-role`
- `storage-concurrency-contract`
- `stable-maturity-claim`

# Review action

Reconcile the product explanation and maturity claims with the current implementation and release evidence.

# Evidence

[product evidence](../../sources/superbee-core.md)

[current release evidence](../../sources/current-release.md)
