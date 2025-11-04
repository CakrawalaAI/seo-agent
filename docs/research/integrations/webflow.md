# Webflow Integration Research

## Status
- Beta (requires API access on paid Webflow workspace).

## Authentication
- Personal access token with CMS scope; customers create via Webflow dashboard. Store encrypted; include site ID + collection ID in config.

## Content Model Mapping
- Map PortableArticle → Webflow CMS collection item fields (title, slug, rich text, summary, tags). Maintain schema cache per site for validation.
- Support localization by detecting multi-language collections (future).

## Publishing Flow
- Create item: `POST /collections/{collection_id}/items` with `isDraft` flag (staged) or live publish (`isDraft: false`).【turn1view0】【turn1view2】
- Update staged item: `PATCH /collections/{collection_id}/items` with `isDraft: true`; publish via `POST /collections/{collection_id}/items/publish` for granular publishing.【turn1view0】
- Unpublish: `DELETE /collections/{collection_id}/items/live`. Required after Webflow draft workflow changes effective July 7, 2025.【turn1view0】【turn1view1】
- Site-wide publish fallback: `POST /sites/{site_id}/publish` (rare; use only if customer wants batch release).【turn1view0】

## Change Management
- Webflow announced breaking changes to draft handling (June 23, 2025); ensure connector never toggles `isDraft` expecting unpublish.【turn1view1】

## Error Handling
- Rate limit 60 requests/min; on 429, retry with exponential backoff and respect `Retry-After`.
- For schema mismatches, surface validation errors in UI with field path.

## Sources
- [Publishing with the CMS API | Webflow](https://developers.webflow.com/data/docs/working-with-the-cms/publishing)【turn1view0】
- [Breaking changes for CMS publishing](https://developers.webflow.com/data/changelog/06232025)【turn1view1】
- [Working with the CMS (v2)](https://developers.webflow.com/data/v2.0.0/docs/working-with-the-cms)【turn1view2】

