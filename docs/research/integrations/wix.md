# Wix Integration Research

## Status
- Planned.

## APIs
- Wix Data Collections API: manage schema/fields for CMS collections. Requires site code editor enabled.【turn17view0】
- Wix Data Items API: CRUD operations on collection items, including bulk actions and reference management.【turn17view1】

## Authentication
- Server-to-server flow using Wix OAuth. Requires app with `WIX_DATA.COLLECTIONS.*` and `WIX_DATA.ITEMS.*` scopes.
- Each site connection yields refresh token + instance ID; store per Integration.

## Content Strategy
- Create dedicated collection (e.g. `seo_articles`) with fields for title, slug, body (rich text), summary, keywords, hero image.
- On publish, upsert item via `save` or `bulkSave`; set permissions so only `ADMIN` can insert/update to prevent visitor edits.【turn17view0】
- Support eventual consistency: after write, poll `GET` with retries before surfacing link (Wix warns data may lag).【turn17view1】

## Limitations
- Payload max 500 KB per item; may need to split large HTML into multiple fields (body + extended body).
- Updates replace entire item; ensure full object is sent to avoid data loss.

## Sources
- [Data Collections API introduction](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-collections/introduction)【turn17view0】
- [Data Items API introduction](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/introduction)【turn17view1】

