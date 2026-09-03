---
type: Convention
title: Documentation System
governs: Documentation System
path: documentation-systems/
description: The durable identity and source boundary of one documentation corpus.
fields:
  required:
    - title
    - product_name
  optional:
    - version_label
    - repository_url
  descriptions:
    product_name: The product name shown by output targets.
    version_label: The release label shown by output targets when present.
    repository_url: The canonical source repository for the documented product.
sections:
  - Purpose
  - Audience
  - Source boundaries
  - Maintenance policy
---
# Documentation System

Defines the durable identity of a documentation corpus. Target-specific presentation and deployment
configuration remain outside the bundle model.
