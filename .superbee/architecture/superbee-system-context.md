---
type: Diagram
title: Superbee system context
description: >-
  How humans, agents, Superbee, shared bundles, package distribution, and public
  publication relate.
superbee_updated_by: openai/codex
---
# Question answered

How do humans, AI agent hosts, Superbee's local product, shared bundles, package distribution, and
public publication fit together?

# Audience and scope

This system-context view is for prospective users, contributors, and partners who need the product's
major boundaries without package-level implementation detail. It does not describe hosted
multi-user collaboration, internal package dependencies, or every supported host.

# Accessible narrative

A human directs work through an AI agent host. The host invokes a locally installed Superbee CLI.
The CLI reads and writes a user-owned bundle containing Markdown documents, relationships, and
opaque artifacts. Git and GitHub may share and review that bundle, while npm distributes the CLI.
For public human presentation, Superbee captures an exact read-only publication snapshot and Portal
turns it into an inspectable site. Publication does not grant the site authority to mutate the
source bundle.

# Elements and relationships

| From | Relationship | To |
| --- | --- | --- |
| Human | directs work through | AI agent host |
| AI agent host | invokes structured commands | Superbee CLI |
| npm registry | distributes the installed package | Superbee CLI |
| Superbee CLI | reads and writes | user-owned bundle |
| user-owned bundle | may be shared and reviewed through | Git and GitHub |
| user-owned bundle | is captured by | `superbee/publication` |
| `superbee/publication` | is presented by | Superbee Portal |
| Superbee Portal | publishes | public documentation site |
| Human | reads and inspects | public documentation site |

# Change triggers

Re-evaluate this diagram when the core storage authority, CLI installation model, publication
snapshot boundary, Portal authority, or supported sharing model changes materially.

[inspect the visual](../views-registry/superbee-system-context.md)

[product evidence](../sources/superbee-core.md)

[publication evidence](../sources/superbee-portal.md)
