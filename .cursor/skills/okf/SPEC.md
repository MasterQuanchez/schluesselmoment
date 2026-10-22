# Open Knowledge Format (OKF)

**Version 0.1 - Draft**

Vendored reference snapshot from:
https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md

OKF is an open, human- and agent-friendly format for representing knowledge:
the metadata, context, and curated insight that surrounds data and systems.
The format is intentionally minimal: a directory of markdown files with YAML
frontmatter. There is no schema registry, no central authority, and no required
tooling.

## Core Terms

- **Knowledge Bundle** - A self-contained, hierarchical collection of knowledge
  documents.
- **Concept** - A single unit of knowledge within a bundle, represented as one
  markdown document.
- **Concept ID** - The path of the concept's file within the bundle, with the
  `.md` suffix removed.
- **Frontmatter** - YAML metadata block delimited by `---`.
- **Link** - A standard markdown link from one concept to another.

## Bundle Structure

```text
path/to/bundle/
├── index.md
├── log.md
├── <concept>.md
└── <subdirectory>/
    ├── index.md
    └── <concept>.md
```

Reserved filenames:

- `index.md` - Directory listing for progressive disclosure.
- `log.md` - Chronological history of updates.

All other `.md` files in the concept area are concept documents.

## Concept Documents

Every concept is a UTF-8 markdown file with a YAML frontmatter block and a
markdown body.

```yaml
---
type: <Type name>
title: <Optional display name>
description: <Optional one-line summary>
resource: <Optional canonical URI for the underlying asset>
tags: [<tag>, <tag>]
timestamp: <ISO 8601 datetime>
---
```

Required:

- `type` - A short string identifying the kind of concept.

Recommended:

- `title`
- `description`
- `resource`
- `tags`
- `timestamp`

Producers may include arbitrary additional fields. Consumers should preserve
unknown keys and tolerate unknown types.

## Cross-Linking

Concepts link to other concepts using standard markdown links.

- Absolute bundle-relative links begin with `/`, e.g.
  `[customers table](tables/customers.md)`.
- Relative links use standard markdown relative paths.

The link text and surrounding prose convey the relationship semantics.

## Index Files

`index.md` files enumerate a directory's contents for progressive disclosure.
Non-root index files contain no frontmatter. The root `index.md` may declare:

```yaml
---
okf_version: "0.1"
---
```

## Log Files

`log.md` records change history as newest-first ISO-date headings:

```markdown
# Directory Update Log

## 2026-05-22
* **Update**: Added new concept.
```

## Conformance

A bundle is conformant with OKF v0.1 if:

1. Every non-reserved `.md` file in the concept tree contains a parseable YAML
   frontmatter block.
2. Every frontmatter block contains a non-empty `type` field.
3. Reserved filenames (`index.md`, `log.md`) follow their reserved structures.

Consumers should not reject bundles for missing optional fields, unknown types,
unknown extension keys, broken links, or missing index files.

## Versioning

This document specifies OKF version `0.1`. Bundles may declare the version in a
bundle-root `index.md` frontmatter block.
