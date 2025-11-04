# Notion Integration Research

## Status
- Planned (draft export to Notion workspace).

## Authentication
- Notion internal integration with OAuth (or manual share). Requires user to share target database/page with integration.
- Store integration token securely; record page/database IDs.

## Content Model
- Pages are block trees. PortableArticle must be converted to Notion block hierarchy (paragraph, heading, image, quote, etc.).【turn15view0】【turn15view1】
- Keep metadata in database properties (status, keywords).

## Operations
- Create page via `POST /v1/pages` with parent database or page ID, properties, and children blocks.
- Update content by appending block children (`PATCH /v1/blocks/{id}/children`) or replacing page content by archiving + recreating.
- Use rich text annotations for formatting (bold, italics, links).

## Limitations
- Not all HTML features map cleanly (e.g. tables nested > 2 levels). Provide fallback using callout blocks.
- API rate limit: approx 3 req/sec per integration; queue requests.

## Sources
- [Working with page content](https://developers.notion.com/docs/working-with-page-content)【turn15view0】
- [Block object reference](https://developers.notion.com/reference/block)【turn15view1】

