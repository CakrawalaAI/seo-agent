# REST API Integration Research

## Status
- GA connector; used for customers with existing headless publishing APIs.

## Authentication & Secrets
- Support bearer token or basic auth; store credentials in secrets vault and reference by ID in integration config.
- Allow optional per-request headers (e.g. `X-Org-Id`) defined in config; redact in logs.

## Publish Flow
- Loader resolves PortableArticle payload → enqueue publish job with integration ID.
- Worker posts `POST {baseUrl}/articles/{articleId}/publish` (configurable path template) with PortableArticle JSON.
- Treat non-2xx as retryable except for 4xx excluding 429; 410 should flip integration status to `disconnected`.

## Implementation Notes
- Provide dry-run mode that logs rendered payload without calling target (useful for onboarding).
- Add per-integration rate-limit guard (default 5 req/s burst 10) to avoid overwhelming customer APIs.
- Include request/response journaling table with truncated payload (first 2 kB) for debugging.

## Risks / TODOs
- Need schema validation hook so customers can supply JSON Schema to catch mapping issues before publish.
- Document expected PortableArticle contract so partners can map fields on their side.

