# HubSpot Integration Research

## Status
- Planned.

## Authentication
- Private apps with OAuth or private app token (uses `Authorization: Bearer {token}`).
- Required scopes: `cms.blogs.read`, `cms.blogs.write`.

## Publishing Flow
- Create draft: `POST /cms/v3/blogs/posts` with `name`, `contentGroupId`, `slug`, `blogAuthorId`, `postBody`. Default state `DRAFT`.【turn13view0】
- Publish draft: `PATCH /cms/v3/blogs/posts/{postId}` setting `state=PUBLISHED` (requires slug, author, meta fields).【turn13view0】
- Push live changes: `POST /cms/v3/blogs/posts/{postId}/draft/push-live`.
- Schedule: `POST /cms/v3/blogs/posts/schedule` with `publishDate`.
- Reset draft to live version: `POST /cms/v3/blogs/posts/{postId}/draft/reset`.

## Data Mapping
- Translate PortableArticle HTML into `postBody`.
- Map keywords/tags → `tagIds`; ensure tags exist via `/cms/v3/blogs/tags`.
- Support multi-language groups via `contentGroupId` and language variants endpoints.

## Operational Notes
- HubSpot rejects partial patch; always send full object when updating draft.
- Rate limits: 100 requests per 10 seconds per app (monitor headers).

## Sources
- [CMS API | Blog Posts](https://developers.hubspot.com/docs/api/cms/blog-post)【turn13view0】

