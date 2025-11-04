SEO Agent — Integrations

- Table: `integrations` (per-website CMS/webhook targets).
- Shape: `{ id, website_id, type, status, config_json }`.
- Snapshot API returns:
  - `integrations`: raw rows.
  - `integrationViews`: computed UX model from manifests.

Webhook
- Simple POST receiver in UI to copy/paste endpoints; `status=connected` means active.

Publish
- Scheduler checks for any `connected` integration of allowed types and publishes eligible articles.
