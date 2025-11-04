# DataForSEO Keyword Ideas Integration

Last updated: 2025-11-04

## Why It Exists
- Drive keyword generation for each website without touching expensive multi-endpoint funnels.
- Mirror the DataForSEO `keyword_ideas/live` response so the mock provider can plug in without code drift.
- Keep the contract tight: deterministic inputs (≤200 seeds) → deterministic, normalized keyword ideas.

## Authentication
```bash
DATAFORSEO_LOGIN="me@example.com"
DATAFORSEO_PASSWORD="super-secret"
DATAFORSEO_AUTH="$(printf '%s:%s' "$DATAFORSEO_LOGIN" "$DATAFORSEO_PASSWORD" | base64)"
```
- Client sends a single-task POST payload with `Authorization: Basic $DATAFORSEO_AUTH`.
- 20s timeout, request aborted on slow responses.

## Request Contract
Endpoint: `POST https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live`

```json
[
  {
    "keywords": ["interview simulator", "behavioral interview"],
    "location_code": 2840,
    "language_code": "en",
    "include_serp_info": false,
    "limit": 100
  }
]
```

Constraints:
- 1–200 seed keywords (UTF-8, trimmed, duplicates removed).
- `location_code` defaults to 2840 (United States) when omitted.
- `language_code` defaults to `en` when omitted.
- `limit` optional; we cap server-side at 100 unless explicitly overridden.

## Response Contract
Relevant fields extracted into `KeywordIdeaItem`:

```
keyword            string (trimmed)
keyword_info       object | null (search_volume, cpc, competition, etc.)
keyword_properties object | null (difficulty, categories, intents...)
impressions_info   object | null (clickstream/impressions metadata)
```

Example slice:

```json
{
  "keyword": "mock interview practice",
  "keyword_info": {
    "se_type": "google",
    "search_volume": 4400,
    "cpc": 3.21,
    "competition": 0.62,
    "monthly_searches": [
      {"year": 2024, "month": 11, "search_volume": 4300},
      {"year": 2024, "month": 12, "search_volume": 4400}
    ]
  },
  "keyword_properties": {
    "keyword_difficulty": 42,
    "main_intent": "informational"
  },
  "impressions_info": null
}
```

## Implementation Map
- `src/common/providers/impl/dataforseo/keyword-ideas.ts`
  - Validates seeds, builds payload, handles errors, normalizes nested objects.
- `src/common/providers/impl/dataforseo/keyword-ideas-provider.ts`
  - Wires geo defaults, exposes provider via `KeywordIdeasProvider` interface.
- `src/common/providers/registry.ts`
  - Selects real vs mock provider depending on env flags.
- `src/features/keyword/server/generateKeywords.ts`
  - Dedupes seeds, fans out to provider, returns `KeywordIdeaResult[]` (phrase-only shape for downstream use).
- `src/entities/keyword/service.ts`
  - Persists results into `keywords` (metrics JSON stored in `metricsJson`).
- `src/common/providers/impl/dataforseo/serp.ts`
  - Dedicated wrapper for `/v3/serp/google/organic/live/regular`; used by SERP snapshot pipeline during article planning.

## Geo Helpers
- `src/common/providers/impl/dataforseo/geo.ts`
  - `locationCodeFromLocale('en-US')` → `2840`
  - `languageCodeFromLocale('en-US')` → `en`
  - `locationNameFromCode(2840)` → `United States`
  - `languageNameFromCode('en')` → `English`

## Mock Provider
- File: `src/common/providers/impl/mock/keyword-generator.ts`
- Generates 100 deterministic keywords seeded by website host + request seeds.
- Returns objects that satisfy `KeywordIdeaRecord` (keyword + info/properties/impressions).
- Enabled by `MOCK_KEYWORD_GENERATOR=true` (legacy aliases: `SEOA_MOCK_KEYWORD_GENERATION`, `SEOA_MOCK_KEYWORD_EXPANSION`, `SEOA_DISCOVERY_MOCK_MODE`).

Mock output characteristics:
- `keyword_info.search_volume`: random-looking but deterministic per keyword (range 1.2k–8.4k).
- `keyword_info.cpc`: 1.20–4.80 (USD), 2 decimal places.
- `keyword_properties.keyword_difficulty`: integer 18–65.
- `monthly_searches`: 12 entries (rolling last 12 months).

## Costs & Limits
- Pricing (Nov 2025): `$0.012` per returned keyword idea.
- With limit 1000 → worst-case $0.11 per run (0.01 task + 1000×0.0001).
- Timeout: 20 seconds (abort + retry later via queue backoff).
- Rate limit: 30 concurrent requests / 2000 per minute (well above worker throughput).

## Error Handling
- Missing credentials → throw `DataForSEO credentials missing`; job is retried with exponential backoff.
- Non-2xx response → log `{status, statusMessage|error}` via `log.error('[dfs] keywordIdeas http_error', …)`.
- Empty `tasks` → warn + return `[]` (caller treats as failure).
- AbortError (timeout) → thrown; queue retry same as credential failure.

## Testing & Tooling
- Unit tests (todo): `tests/common/keyword-ideas.spec.ts` should mock fetch + assert shape.
- Manual smoke:
  ```bash
  curl -H "Authorization: Basic $DATAFORSEO_AUTH" \
       -H 'content-type: application/json' \
       -d '[{"keywords":["interview"],"location_code":2840,"language_code":"en"}]' \
       https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live
  ```
- Worker validation: `bun run worker` with `MOCK_KEYWORD_GENERATOR=true` should log `keyword generate mode` as mock and finish without hitting the real API.
- Cost levers: set `MAX_SEED_KEYWORDS` (seed batch, ≤200 enforced) and `MAX_KEYWORDS_GENERATE` (result limit, ≤1000) to tune spend; defaults set to 1200/1000 for production-like scale (clamped to API caps at runtime).

## Troubleshooting Cheatsheet

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `DataForSEO credentials missing` | `DATAFORSEO_LOGIN/PASSWORD` unset or invalid direnv | `direnv allow`, check `.envrc` |
| HTTP 401 | Credentials revoked | Regenerate API password in DataForSEO portal |
| HTTP 429 | Burst of >30 parallel jobs | Queue backoff will retry; consider reducing concurrency |
| Empty result array | Seeds too narrow or blocked vertical | Add broader seed terms (fallback uses host) |

## References
1. DataForSEO Labs – Keyword Ideas: https://docs.dataforseo.com/v3/dataforseo_labs/keyword_ideas/
2. Pricing: https://dataforseo.com/pricing
