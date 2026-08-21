---
name: forma-photos
description: Autodesk Forma Photos API guidance for filtered photo search and photo retrieval. Use when implementing Forma/ACC photo browsing, filtered photo queries, photo detail retrieval, or photo-linked construction workflows.
metadata:
  priority: 7
  docs:
    - https://aps.autodesk.com/en/docs/acc/v1/reference/http/photos-getfilteredphotos-POST
    - https://aps.autodesk.com/en/docs/acc/v1/reference/http/photos-getphoto-GET
  pathPatterns:
    - "/construction/photos/**"
    - "/photos/**"
  promptSignals:
    - "Forma photos"
    - "ACC photos"
    - "filtered photos"
    - "get photo"
---

# Forma Photos

Use this for Forma photo search and retrieval. Prefer the filtered search endpoint for photo browsing instead of fetching individual photos one by one.

## Workflows

| Goal | Start With |
| --- | --- |
| Search photos | Project ID, filter payload, pagination |
| Get one photo | Photo ID and project context |
| Connect to records | Referencing module and attachment/document semantics |

## Rules

- Use the filtered search endpoint for list pages and galleries.
- Fetch a single photo only after obtaining a photo ID from search or a related record.
- Treat photo binary/media download behavior separately from metadata if the endpoint distinguishes them.
- Preserve project ID normalization rules from `forma-core`.

## Example

```text
To build a photo gallery:
1. POST a filtered photo search with project and filter criteria.
2. Render returned photo metadata and thumbnails/URLs.
3. Fetch full photo details only for the selected photo.
```

See [REFERENCE.md](REFERENCE.md) for source links.
