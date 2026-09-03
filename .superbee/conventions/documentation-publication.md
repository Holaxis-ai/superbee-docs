---
type: Convention
title: Documentation Publication
governs: Documentation Publication
path: documentation-publications/
description: A renderer-neutral selection of documentation to publish for one system.
links:
  for system: Documentation System
  contains: Documentation Section
link_descriptions:
  for system: The documentation system whose product identity this publication uses.
  contains: An ordered documentation section included in this publication.
fields:
  required:
    - title
    - home
  optional:
    - supporting_documents
    - operational_types
  descriptions:
    home: The bundle-relative document identity used as the publication home page.
    supporting_documents: Additional page identities available outside primary navigation.
    operational_types: >-
      Document types retained in the bundle but excluded from human
      presentation.
sections:
  - Purpose
  - Selection policy
---
# Documentation Publication

Declares publication intent in bundle-native data. A private compiler resolves the linked system and
sections into the shared renderer-neutral projection contract.
