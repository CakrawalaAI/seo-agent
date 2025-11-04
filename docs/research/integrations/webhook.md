# Webhook Integration Research

## Status
- GA baseline connector for arbitrary downstream automation.

## Authentication & Security
- Require HTTPS endpoint.
- Support shared-secret HMAC (SHA256) signature header; include timestamp to prevent replay.
- Allow optional static headers (e.g. API key) stored in secrets vault.

## Delivery Model
- POST PortableArticle JSON plus metadata (`websiteId`, `articleId`, `publishedAt`).
- Set retries with exponential backoff (max 8 attempts, 24h cap).
- Treat 2xx as success; 4xx other than 429 marks integration `error` and surfaces message; 410 flips to `disconnected`.

## Operational Features
- Provide manual “Send test” action that delivers sample payload using saved config.
- Persist last response status/body for UI display (truncate >2 kB).
- Expose docs snippet for verifying HMAC signature in Node/Python.

## Future Enhancements
- Optional signing certs (mTLS) for enterprise targets.
- Support topic subscription so customers can opt into other events (draft created, fact-check complete).

