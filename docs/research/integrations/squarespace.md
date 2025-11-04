# Squarespace Integration Research

## Status
- Planned (high risk: no official blog post API).

## Platform Reality
- Squarespace lacks public endpoints to create blog posts; manual creation only. Automations require workarounds (developer mode, custom templates, or third-party tools).【turn16search1】【turn16search8】

## Possible Approaches
- Developer Platform: enable Developer Mode, use template repo + JSON-T to render content from collections. Content managed via CMS but no external write API.【turn16search0】【turn16search3】【turn16search9】
- JSON feed: append `?format=json-pretty` to fetch collection data; useful for verifying published output, not for writes.【turn16search2】
- OAuth-protected Commerce APIs exist (orders, inventory) but do not cover blogging; connector should likely remain “coming soon” unless Squarespace releases CMS write APIs.【turn16search7】

## Recommendation
- Position integration as “monitor only” (ingest existing posts) or offer export via JSON feed scraping.
- For publishing automation needs, steer customers to Webhook/Zapier paths or alternate CMS.

## Sources
- [Squarespace API limitations discussion](https://presentybox.com/squarespace-post-a-blog-post-api/)【turn16search1】
- [Squarespace developer platform overview](https://developers.squarespace.com/)【turn16search0】
- [View JSON Data](https://developers.squarespace.com/view-json-data/)【turn16search2】
- [Templating Basics](https://developers.squarespace.com/templating-basics)【turn16search3】
- [Custom Post Types](https://developers.squarespace.com/custom-post-types)【turn16search9】
- [OAuth for Squarespace APIs](https://developers.squarespace.com/oauth)【turn16search7】

