# Shopify Integration Research

## Status
- Planned. Targeting Shopify Plus merchants comfortable granting Admin API access.

## Platform Constraints
- REST Admin API marked legacy; new public apps must use GraphQL Admin API starting April 1, 2025.【turn4view0】
- Blog article management available via both REST (`/admin/api/{version}/blogs/{blog_id}/articles.json`) and GraphQL (`blogArticleCreate`, etc.). Encourage GraphQL-first design.

## Authentication
- Private/custom apps: OAuth 2.0 to obtain Admin API access token with scopes `write_content`, `read_content`.
- Store shop domain and API version (default to latest stable e.g. `2025-10`).

## Publishing Flow
- Discover blogs via `GET /admin/api/latest/blogs.json`; create article via `POST /admin/api/latest/blogs/{blog_id}/articles.json` with HTML body, tags, author ID.【turn11view0】
- Images: upload via GraphQL `fileCreate` or REST `/admin/api/{version}/images.json`.
- Scheduling: set `published_at` future timestamp or use `publication` GraphQL.

## Operational Considerations
- Handle theme sections injecting additional markup; keep generated HTML simple and allow merchants to author templates.
- Implement rate-limit handling (REST leaky bucket: 40 req/second). Monitor response header `X-Shopify-Shop-Api-Call-Limit`.

## Sources
- [REST Admin API reference – Blog](https://shopify.dev/docs/api/admin-rest/latest/resources/blog)【turn11view0】
- [REST Admin API overview (deprecation notice)](https://shopify.dev/docs/api/admin-rest)【turn4view0】

