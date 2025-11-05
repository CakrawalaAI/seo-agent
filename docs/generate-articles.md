## Article Generation Pipeline

### Core Flow
- **Plan item** drives the generation job (`queue:generate` → `processGenerate`).
- **LLM** prompts live in `src/common/prompts/article-generation.ts` (outline/body/fact-check).
- **Context collector** (`src/features/articles/server/article-context.ts`) hydrates:
  - Website summary
  - SERP snapshot (top 10)
  - External citations (Exa)
  - YouTube suggestions
  - Unsplash + optional AI imagery
  - Internal links
- Feature flags read from env (`ENABLE_ARTICLE_*`) with per-site overrides (`website.settings.articleGeneration.features`).

### Produced Assets
- `articles.payload_json` stores `ArticleGenerationPayload` (outline, bodyHtml, context, stats).
- `article_attachments` persists downstream media (images/YouTube/file assets) with Backblaze storage keys.
- Attachments, context, and payload returned from `/api/articles/:articleId/`.

### Media Lifecycle
- Backblaze B2 helper lives in `src/common/infra/s3/`.
- API route: `POST /api/articles/:articleId/media`.
  - `upload`: presigned PUT (filename/contentType).
  - `complete`: persists attachment row + returns storage key.
  - `delete`: removes storage object + attachment row.
  - `download`: temporary GET URL.
- Frontend manager: `src/features/articles/client/ArticleMediaManager.tsx`.

### Environment Variables
```
ENABLE_ARTICLE_SERP=1
ENABLE_ARTICLE_RESEARCH=1
ENABLE_ARTICLE_YOUTUBE=1
ENABLE_ARTICLE_IMAGE_UNSPLASH=1
ENABLE_ARTICLE_IMAGE_AI=0
ENABLE_ARTICLE_ATTACHMENTS=1

BACKBLAZE_S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
BACKBLAZE_S3_REGION=us-west-004
BACKBLAZE_S3_BUCKET=seo-agent-dev
BACKBLAZE_S3_KEY_ID=...
BACKBLAZE_S3_APPLICATION_KEY=...
BACKBLAZE_S3_URL_TTL=600
```

### CLI / Ops Notes
- Generate new migrations via `bunx drizzle-kit generate`.
- Apply DB changes via `bun run db:migrate`.
- Generation job outputs logs under `worker/processors/generate.ts`.
- Use `bunx tsx scripts/smoke.ts` for end-to-end smoke tests.
