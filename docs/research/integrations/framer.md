# Framer Integration Research

## Status
- Planned (requires Framer Plugin API v3.0).

## Capabilities
- Plugin API v3.0 grants read/write access to all CMS collections, not just managed ones; enables custom import/export logic.【turn8search1】
- CMS API methods (`getCollection`, `getCollections`, `addItems`) allow programmatic item creation with custom fields (requires slug + fieldData).【turn8search0】【turn8search5】【turn8search10】
- Plugins can navigate UI, trigger sync, and leverage new On-Page Editing context (ensure compatibility).【turn8search0】【turn8news12】

## Authentication
- Plugin runs inside user project; no external auth needed. For external APIs, implement OAuth within plugin (Framer provides guidance).【turn8search4】

## Publish Flow
- Connector would ship as customer-installed plugin:
  1. User installs plugin and signs in to SEO Agent.
  2. Plugin fetches publish jobs via API, maps to Framer collection fields.
  3. Use `collection.addItems` to upsert content; manage media via Framer asset APIs.
- For scheduling, Framer lacks native scheduling; plugin should respect article `publishedAt` flag and optionally create draft state.

## Sources
- [Framer Developers Reference](https://www.framer.com/developers/reference)【turn8search0】
- [Plugins 3.0 announcement](https://www.framer.com/updates/plugins-3-0)【turn8search1】
- [Working with CMS Collections](https://framerapp.com/developers/plugins/cms.html)【turn8search5】
- [Advanced CMS in Framer](https://www.framer.com/cms/)【turn8search10】
- [On-Page Editing news](https://www.techradar.com/pro/website-building/framer-launches-a-tool-to-make-sites-instantly-editable-by-anyone)【turn8news12】
- [Framer OAuth guide](https://developers.framer.wiki/developers/plugins/oauth)【turn8search4】

