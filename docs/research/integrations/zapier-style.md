# Zapier-Style Integration Research

## Status
- Documented recipes only; relies on Webhook connector to trigger third-party automations.

## Approach
- Use Webhook integration to emit PortableArticle payload to Zapier/Make/IFTTT.
- Zap consumes payload and maps to downstream app (e.g. convert to Google Doc, trigger CMS-specific action).
- Provide sample Zap templates (Webhook → Custom Request) with mapping guidance.

## Why Zapier Instead of Native
- Many website builders without APIs (Squarespace, Wix in some cases) expose actions via Zapier/Make modules or custom HTTP requests.
- Maintains flexibility without owning each downstream integration.

## Operational Notes
- Encourage customers to store secrets in Zapier environment variables and avoid embedding in payload.
- Document retry behavior (Zapier auto-retries on 5xx up to 3 times) so expectations match Webhook retry logic.

## Example Resources
- [Zapier + Webhooks quick connect overview](https://zapier.com/apps/unicorn-platform/integrations/webhook)【turn10search3】

