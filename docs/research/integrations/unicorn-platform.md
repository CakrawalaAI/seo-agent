# Unicorn Platform Integration Research

## Status
- Planned lightweight connector.

## API
- Publish endpoint: `POST https://api.unicornplatform.com/api/v1/blog_posts/seobot_hook/{api_key}/{post_id}` accepts HTML, slug, metadata, publish flag.【turn10search1】
- Supports directory routing, scheduled `createdAt`, and delete flag. Posts created via API do not appear in editor UI.
- Dynamic data feature allows pages to pull from arbitrary JSON sources; could be used for previews or landing page sync.【turn10search9】

## Auth
- Requires API key from blog settings; treat as secret.
- No OAuth; simple REST call with JSON body.

## Implementation Notes
- Need to generate unique `{post_id}` (e.g. integration UUID + article ID).
- API expects full HTML string; convert PortableArticle accordingly.
- Provide option to keep post unpublished (`published=false`) for review.

## Sources
- [Create blog post API](https://help.unicornplatform.com/en/article/create-blog-post-c36bv7/)【turn10search1】
- [Dynamic data from API source](https://help.unicornplatform.com/en/article/dynamic-data-from-api-source-fazl04/)【turn10search9】

