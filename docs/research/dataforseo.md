# DataForSEO API Integration Research

Research conducted: 2025-11-01

## Overview

DataForSEO provides keyword research, SERP analysis, and SEO metrics APIs used throughout the SEO Agent for automated keyword discovery and content planning [¹](#sources).

**Base URL**: `https://api.dataforseo.com`

**Authentication**: HTTP Basic Auth (login:password base64-encoded)

## Credentials

**⚠️ REDACTED - Use your own DataForSEO credentials**

From `.envrc` (example format):
```bash
DATAFORSEO_LOGIN="your-email@example.com"
DATAFORSEO_PASSWORD="your-password-here"
DATAFORSEO_AUTH="$(printf '%s:%s' "$DATAFORSEO_LOGIN" "$DATAFORSEO_PASSWORD" | base64)"
```

## Business Context

**SEO Agent Workflow**:
```
Website URL → Crawl Site → Discover Keywords → Enrich Metrics →
Score/Prioritize → 30-Day Calendar → Generate Articles → Publish to CMS
```

**Goal**: Transform website URL into continuous stream of SEO-optimized content by identifying high-opportunity keywords the site doesn't currently rank for.

## Cost-Optimized Discovery Funnel

```
Wide Discovery (4 endpoints)
  ↓ ~3000 candidate keywords
Bulk Difficulty Filter ($0.003/kw)
  ↓ ~1000 with difficulty scores
Sort by Easiest
  ↓ Top 200
Full Metrics Overview ($0.025/kw)
  ↓ 200 with volume/CPC/trends
SERP Analysis (top 50)
  ↓ 50 with rankability scores
Final Prioritization
  ↓ Top 30 → content calendar
```

**Total cost per website**: ~$22.50

**Cost savings**: ~70% vs calling overview on all candidates [²](#implementation-files)

---

## API Endpoints (9 Total)

### 1. Keyword Overview

**Endpoint**: `/v3/dataforseo_labs/google/keyword_overview/live` [³](#endpoint-1-keyword-overview)

**Purpose**: Get rich metrics for high-priority keywords (search volume, CPC, difficulty, 12-month trends)

**Use Case**: After bulk difficulty filtering, enrich top 200 easiest keywords with full metrics for scoring

**When Called**:
- Discovery phase: Batch overview for top 200 candidates
- Metrics refresh: On-demand for specific keywords

**Files**:
- `src/worker/processors/discovery.ts:116` - Batch enrichment
- `src/common/providers/impl/dataforseo/metrics.ts` - Provider implementation

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "keywords": ["prep interview", "consulting interview"],
    "location_code": 2840,
    "language_name": "English"
  }]'
```

**Request Fields**:
- `keywords` (array, required) - Max 700 keywords
- `location_code` (integer) - Default: 2840 (United States)
- `language_name` (string) - Default: "English"

**Response**:
```json
{
  "tasks": [{
    "result": [{
      "items": [{
        "keyword": "iphone",
        "keyword_info": {
          "search_volume": 1220000,
          "cpc": 6.45,
          "competition": 1,
          "competition_level": "HIGH",
          "monthly_searches": [
            {"year": 2025, "month": 2, "search_volume": 1220000}
          ]
        }
      }]
    }]
  }]
}
```

**Key Fields Used**:
- `search_volume` - Monthly search count (opportunity scoring)
- `cpc` - Monetization potential
- `competition` - Advertiser competition (0-1)
- `monthly_searches[]` - 12-month trend history

**Output Path**: `result[0].items[]`

**Cost**: $0.025 per keyword

**Limits**: Max 700 keywords per request [³](#endpoint-1-keyword-overview)

---

### 2. Search Volume

**Endpoint**: `/v3/keywords_data/google_ads/search_volume/live` [⁴](#endpoint-2-search-volume)

**Purpose**: Volume-only lookup (cheaper alternative to overview)

**Use Case**: Get just search volume when full metrics not needed

**Status**: ⚠️ **Implemented but not actively used** - Overview provides superset

**Files**: `src/common/providers/impl/dataforseo/client.ts` - `searchVolume()` method

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "keywords": ["case interview", "consulting interview"],
    "location_code": 2840,
    "language_name": "English"
  }]'
```

**Request Fields**:
- `keywords` (array, required) - Max 1000 keywords
- `location_code` (integer)
- `language_name` (string)

**Response**:
```json
{
  "tasks": [{
    "result": [
      {
        "keyword": "buy laptop",
        "search_volume": 2900,
        "cpc": 7.95,
        "competition": "HIGH",
        "competition_index": 100,
        "monthly_searches": [
          {"year": 2023, "month": 10, "search_volume": 2400}
        ]
      }
    ]
  }]
}
```

**Output Path**: `result[]` (array, one object per keyword)

**Limits**: Max 1000 keywords per request [⁴](#endpoint-2-search-volume)

---

### 3. Keywords For Keywords

**Endpoint**: `/v3/keywords_data/google_ads/keywords_for_keywords/live` [⁵](#endpoint-3-keywords-for-keywords)

**Purpose**: Expand seed keywords with related phrases from Google Ads data

**Use Case**: LLM-generated seeds are limited - need real user search patterns

**When Called**: Discovery expansion phase, alongside suggestions endpoint

**Files**:
- `src/features/keyword/server/discoverKeywords.ts` - Discovery orchestration
- `src/common/providers/impl/dataforseo/expand.ts` - `expand()` method

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "keywords": ["consulting", "interview"],
    "language_name": "English",
    "location_code": 2840
  }]'
```

**Request Fields**:
- `keywords` (array, required) - Max 20 keywords
- `location_code` (integer)
- `language_name` (string)

**Response**:
```json
{
  "tasks": [{
    "result": [
      {
        "keyword": "consulting interview prep",
        "search_volume": 10,
        "cpc": null,
        "competition": "LOW",
        "competition_index": 0,
        "monthly_searches": [...]
      }
    ]
  }]
}
```

**Output Path**: `result[]`

**Workflow**:
```
LLM seeds (10 max) → Keywords For Keywords →
dedupe → combine with suggestions → filter off-topic
```

**Limits**: Max 20 seed keywords per request [⁵](#endpoint-3-keywords-for-keywords)

**Returns**: ~1000 variations per request

---

### 4. Keywords For Site

**Endpoint**: `/v3/dataforseo_labs/google/keywords_for_site/live` [⁶](#endpoint-4-keywords-for-site)

**Purpose**: Baseline discovery - what site currently ranks for

**Use Case**: Understand existing rankings to find gaps and opportunities

**When Called**: First step in discovery workflow (before expansion)

**Files**:
- `src/features/keyword/server/discoverKeywords.ts:21` - Discovery entry point
- `src/common/providers/impl/dataforseo/discovery.ts` - `keywordsForSite()`

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "target": "prepinterview.ai",
    "location_code": 2840,
    "language_name": "English"
  }]'
```

**Request Fields**:
- `target` (string, required) - Domain without `https://`
- `location_code` (integer, required)
- `language_name` (string)
- `limit` (integer) - Default: 100, Max: 1000

**Response**:
```json
{
  "tasks": [{
    "result": [{
      "total_count": 61789671,
      "items": [{
        "keyword": "video editing app for ipad pro",
        "keyword_info": {
          "search_volume": 30,
          "cpc": 1.36,
          "competition_level": "LOW",
          "monthly_searches": [...]
        },
        "keyword_properties": {
          "keyword_difficulty": 42
        },
        "serp_info": {
          "se_results_count": "245000000"
        },
        "search_intent_info": {
          "main_intent": "commercial"
        }
      }]
    }]
  }]
}
```

**Output Path**: `result[0].items[]`

**Business Logic**:
- If site already ranks, don't need more content
- Focus on gaps: keywords competitors rank for but client doesn't

**Default Limit**: 500 keywords (configurable via `baselineLimit`)

**Limits**: Max 1000 keywords per request [⁶](#endpoint-4-keywords-for-site)

---

### 5. Related Keywords

**Endpoint**: `/v3/dataforseo_labs/google/related_keywords/live` [⁷](#endpoint-5-related-keywords)

**Purpose**: Semantic expansion - find conceptually related terms

**Use Case**: Expand topic coverage beyond exact matches (e.g., "SEO tools" → "keyword research software", "rank tracking")

**When Called**: Discovery expansion phase, uses up to 20 seeds

**Files**:
- `src/features/keyword/server/discoverKeywords.ts:28`
- `src/common/providers/impl/dataforseo/discovery.ts` - `relatedKeywords()`

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "keyword": "consulting interview",
    "location_code": 2840,
    "language_name": "English"
  }]'
```

**Request Fields**:
- `keyword` (string, required) - Single seed keyword
- `location_code` (integer, required)
- `language_name` (string, required)
- `limit` (integer) - Default: 100, Max: 1000

**Response**:
```json
{
  "tasks": [{
    "result": [{
      "seed_keyword": "phone",
      "items": [{
        "keyword_data": {
          "keyword": "phone",
          "keyword_info": {
            "search_volume": 368000,
            "cpc": 5.98,
            "competition_level": "HIGH"
          },
          "keyword_properties": {
            "keyword_difficulty": 85
          }
        },
        "depth": 1,
        "related_keywords": ["phone case", "phone number"]
      }]
    }]
  }]
}
```

**Output Path**: `result[0].items[]` (nested `keyword_data`)

**Workflow**:
```
LLM seeds (20 max) → Related Keywords → dedupe → up to 2000 phrases
```

**Difference from Ideas**:
- **Related**: Semantically similar concepts
- **Ideas**: User-typed variations (autocomplete data)

**Limits**: 20 seed keywords max (API constraint + cost optimization) [⁷](#endpoint-5-related-keywords)

---

### 6. Keyword Ideas

**Endpoint**: `/v3/dataforseo_labs/google/keyword_ideas/live` [⁸](#endpoint-6-keyword-ideas)

**Purpose**: Broader expansion - Google's autocomplete-style suggestions

**Use Case**: Discover variations users actually search for (long-tail opportunities)

**When Called**: Discovery expansion phase, alongside related keywords

**Files**:
- `src/features/keyword/server/discoverKeywords.ts:34`
- `src/common/providers/impl/dataforseo/discovery.ts` - `keywordIdeas()`

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "keywords": ["case interview"],
    "location_code": 2840
  }]'
```

**Request Fields**:
- `keywords` (array, required) - Max 200 keywords
- `location_code` (integer, required)
- `language_code` (string)
- `limit` (integer) - Default: 700, Max: 1000

**Response**:
```json
{
  "tasks": [{
    "result": [{
      "seed_keywords": ["phone", "watch"],
      "total_count": 533763,
      "items": [{
        "keyword": "phone",
        "keyword_info": {
          "search_volume": 368000,
          "cpc": 5.98,
          "competition_level": "HIGH"
        },
        "keyword_properties": {
          "keyword_difficulty": 72
        },
        "search_intent_info": {
          "main_intent": "commercial"
        }
      }]
    }]
  }]
}
```

**Output Path**: `result[0].items[]`

**Workflow**:
```
LLM seeds (10 max) → Keyword Ideas → dedupe → up to 1000 phrases
```

**Default Limit**: 1000 keywords (configurable via `ideasLimit`)

**Limits**: Max 200 seed keywords per request [⁸](#endpoint-6-keyword-ideas)

---

### 7. Bulk Keyword Difficulty

**Endpoint**: `/v3/dataforseo_labs/google/bulk_keyword_difficulty/live` [⁹](#endpoint-7-bulk-keyword-difficulty)

**Purpose**: Cheap initial scoring to filter thousands of candidates

**Use Case**: Can't afford full overview for all discovered keywords - need to filter to top opportunities first

**When Called**: After discovery, before overview (cost-optimization gate)

**Files**:
- `src/worker/processors/discovery.ts:107` - Filtering implementation
- `src/common/providers/impl/dataforseo/metrics.ts` - `bulkDifficulty()`

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "keywords": ["consulting interview", "case interview", "prep interview"],
    "location_code": 2840,
    "language_name": "English"
  }]'
```

**Request Fields**:
- `keywords` (array, required) - Max 1000 keywords
- `location_code` (integer, required)
- `language_name` (string, required)

**Response**:
```json
{
  "tasks": [{
    "result": [{
      "items": [
        {
          "keyword": "dentist new york",
          "keyword_difficulty": 50
        },
        {
          "keyword": "pizza brooklyn",
          "keyword_difficulty": 44
        }
      ]
    }]
  }]
}
```

**Output Path**: `result[0].items[]`

**Data Used**: `keyword_difficulty` (0-100 score only)

**Cost Optimization Strategy**:
1. Discovery generates ~3000 candidates
2. Bulk difficulty: $0.003/keyword for difficulty-only
3. Sort to find easiest 200
4. Overview: $0.025/keyword for full metrics on top 200 only

**Saves**: ~70% vs calling overview on all candidates

**Limits**: Max 1000 keywords per request [⁹](#endpoint-7-bulk-keyword-difficulty)

---

### 8. Keyword Suggestions

**Endpoint**: `/v3/dataforseo_labs/google/keyword_suggestions/live` [¹⁰](#endpoint-8-keyword-suggestions)

**Purpose**: Autocomplete-style expansion (cheaper alternative to Keywords For Keywords)

**Use Case**: Get quick variations for a single seed keyword

**When Called**: Optional first step in expansion (configurable via `SEOA_DFS_SUGGESTIONS_FIRST=1`)

**Files**: `src/common/providers/impl/dataforseo/expand.ts:15`

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "keyword": "case interview",
    "location_code": 2840,
    "language_name": "English"
  }]'
```

**Request Fields**:
- `keyword` (string, required) - Single seed keyword
- `location_code` (integer)
- `language_code` (string)
- `include_seed_keyword` (boolean) - Default: false

**Response**:
```json
{
  "tasks": [{
    "result": [{
      "seed_keyword": "phone",
      "seed_keyword_data": {
        "keyword": "phone",
        "keyword_info": {
          "search_volume": 368000,
          "cpc": 5.98,
          "competition_level": "HIGH",
          "monthly_searches": [...]
        }
      }
    }]
  }]
}
```

**Output Path**: `result[0].seed_keyword_data` (single object)

**Workflow**:
```
First seed only → Suggestions → combine with Keywords For Keywords → dedupe
```

**Cost Optimization**:
- Suggestions: Cheaper per-keyword cost
- Keywords For Keywords: More comprehensive but expensive
- Strategy: Use suggestions for first seed, then Keywords For Keywords for breadth

**Configurable**: Set `SEOA_DFS_SUGGESTIONS_FIRST=0` to skip [¹⁰](#endpoint-8-keyword-suggestions)

---

### 9. SERP Organic Results

**Endpoint**: `/v3/serp/google/organic/live/regular` [¹¹](#endpoint-9-serp-organic)

**Purpose**: Understand current rankings and competition (rankability analysis)

**Use Case**: Need to know WHO ranks for target keywords to assess if client can compete

**When Called**:
- Discovery: Top 50 keywords for "SERP-lite" rankability
- On-demand: User requests fresh SERP for specific keyword
- Scheduled: Monthly refresh for tracked keywords

**Files**:
- `src/worker/processors/discovery.ts:123` - SERP-lite for rankability
- `src/worker/processors/serp.ts` - Full SERP snapshots
- `src/common/providers/impl/dataforseo/serp.ts` - `serpOrganic()`

**Request**:
```bash
curl -X POST https://api.dataforseo.com/v3/serp/google/organic/live/regular \
  -H "Authorization: Basic ${DATAFORSEO_AUTH}" \
  -H "Content-Type: application/json" \
  -d '[{
    "keyword": "case interview",
    "location_code": 2840,
    "language_name": "English",
    "device": "desktop"
  }]'
```

**Request Fields**:
- `keyword` (string, required) - Single search term
- `location_code` (integer, required)
- `language_name` (string, required)
- `device` (string) - "desktop" or "mobile", default: "desktop"
- `depth` (integer) - Results per SERP, max 200, default: 10

**Response**:
```json
{
  "tasks": [{
    "result": [{
      "keyword": "flight ticket new york",
      "se_results_count": 85600000,
      "items": [
        {
          "type": "organic",
          "rank_group": 1,
          "rank_absolute": 1,
          "domain": "www.kayak.com",
          "url": "https://www.kayak.com/...",
          "title": "Cheap Flights from New York...",
          "description": "Fly from New York..."
        },
        {
          "type": "paid",
          "rank_absolute": 2,
          "domain": "www.booking.com",
          "url": "...",
          "title": "..."
        }
      ]
    }]
  }]
}
```

**Output Path**: `result[0].items[]`

**Data Extracted**:
- `rank_group` - Position (1-10)
- `rank_absolute` - Absolute position
- `url` - Ranking page
- `title` - Page title
- `description` - Meta description
- `types[]` - Result type (organic, paid, featured snippet, etc.)

**Rankability Computation**:
```typescript
// From discovery.ts:123
const lite = await ensureSerpLite(phrase, locale, locationCode)
rankability = computeRankability(lite)
```

**Business Logic**:
- If top 10 all have DA 90+ → low rankability
- If results diverse/weak → high rankability
- Factors: Domain authority of competitors, content freshness, result types

**SERP-Lite**: Lightweight version for bulk analysis (top 10 only, cached aggressively)

**Caching Strategy**:
 - SERP snapshots cached to filesystem `.data/serp-cache` (14-day TTL)
 - Keyword metrics persisted on each row in `website_keywords` (per-website)

**Limits**: Max 200 results via `depth` parameter [¹¹](#endpoint-9-serp-organic)

---

## Field Name Patterns

| Endpoint | Field Name | Type | Max Items |
|----------|-----------|------|-----------|
| Keyword Overview | `keywords` | array | 700 |
| Search Volume | `keywords` | array | 1000 |
| Keywords For Keywords | `keywords` | array | 20 |
| **Keywords For Site** | **`target`** | string | 1 domain |
| **Related Keywords** | **`keyword`** | string | 1 |
| Keyword Ideas | `keywords` | array | 200 |
| Bulk Keyword Difficulty | `keywords` | array | 1000 |
| **Keyword Suggestions** | **`keyword`** | string | 1 |
| **SERP Organic** | **`keyword`** | string | 1 |

**Pattern**:
- **Array endpoints** use `keywords` (plural)
- **Single keyword endpoints** use `keyword` (singular)
- **Domain analysis** uses `target`

**Common Error**: Using `keyword` (singular) on array endpoints causes error 40503 "POST Data Is Invalid" [¹²](#common-errors)

---

## Multi-Source Discovery Strategy

The discovery workflow combines **4 DataForSEO endpoints** in parallel:

```typescript
// From discoverKeywords.ts
async function discoverKeywords(input) {
  // 1. Baseline (what site already ranks for)
  keywordsForSite({ domain, ... }) → 500 phrases

  // 2. Semantic expansion
  relatedKeywords({ seeds: 20, ... }) → 2000 phrases

  // 3. Broader ideas
  keywordIdeas({ seeds: 10, ... }) → 1000 phrases

  // 4. (Optional) Autocomplete
  keywordSuggestions + keywordsForKeywords → 1000 phrases

  // Dedupe → ~3000 unique candidates
}
```

**Why multi-source?**
- **Site**: Catch existing rankings (defensive)
- **Related**: Topic expansion (strategic)
- **Ideas**: User intent variations (tactical)
- **Suggestions**: Quick wins (opportunistic)

---

## Response Structure Patterns

| Endpoint | Result Structure | Items Location |
|----------|------------------|----------------|
| Keyword Overview | Single object → `items[]` | `result[0].items` |
| Search Volume | Array of keywords | `result[]` |
| Keywords For Keywords | Array of keywords | `result[]` |
| Keywords For Site | Single object → `items[]` | `result[0].items` |
| Related Keywords | Single object → `items[]` | `result[0].items[]` |
| Keyword Ideas | Single object → `items[]` | `result[0].items` |
| Bulk Keyword Difficulty | Single object → `items[]` | `result[0].items` |
| Keyword Suggestions | Single object | `result[0].seed_keyword_data` |
| SERP Organic | Single object → `items[]` | `result[0].items` |

---

## Environment Variables

From `src/common/config.ts`:

```bash
# Required
DATAFORSEO_LOGIN="corporate@cakrawala.ai"          # or DATAFORSEO_EMAIL
DATAFORSEO_PASSWORD="66262d8bcddcc80d"

# Optional
SEOA_DFS_TIMEOUT_MS="20000"                        # Request timeout (default: 20s)
SEOA_DFS_DEBUG="1"                                 # Enable debug logging
SEOA_DFS_SUGGESTIONS_FIRST="1"                     # Use suggestions before For Keywords
SEOA_PROVIDER_KEYWORD_DISCOVERY="dataforseo"       # Override discovery provider
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/common/providers/impl/dataforseo/client.ts` | Core HTTP client with all endpoint methods |
| `src/common/providers/impl/dataforseo/auth.ts` | Authentication header generation |
| `src/common/providers/impl/dataforseo/metrics.ts` | Keyword metrics provider |
| `src/common/providers/impl/dataforseo/serp.ts` | SERP results provider |
| `src/common/providers/impl/dataforseo/discovery.ts` | Keyword discovery provider |
| `src/common/providers/impl/dataforseo/expand.ts` | Keyword expansion provider |
| `src/worker/processors/discovery.ts` | Discovery workflow orchestration |
| `src/features/keyword/server/discoverKeywords.ts` | Discovery API handler |
| `tests/common/dataforseo-client.spec.ts` | Unit tests for all endpoints |

---

## Database Model (keywords)

**website_keywords** (per-website):
```sql
CREATE TABLE website_keywords (
  id TEXT PRIMARY KEY,
  website_id TEXT NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  phrase TEXT NOT NULL,
  phrase_norm TEXT NOT NULL,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  location_code INTEGER NOT NULL,
  location_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'dataforseo.labs.keyword_ideas',
  include BOOLEAN NOT NULL DEFAULT FALSE,
  starred INTEGER NOT NULL DEFAULT 0,
  search_volume INTEGER,
  cpc TEXT,
  competition TEXT,
  difficulty INTEGER,
  vol_12m_json JSONB,
  impressions_json JSONB,
  raw_json JSONB,
  metrics_as_of TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(website_id, phrase_norm, language_code, location_code)
);
```

---

## Storage Strategy

- Keywords/metrics stored in Postgres table `website_keywords`.
- SERP snapshots cached to `.data/serp-cache/{hash}.json` with TTL.

---

## Common Errors

### Error 40503: "POST Data Is Invalid"

**Causes** [¹²](#common-errors):
1. Using `keyword` (singular) instead of `keywords` (array) on array endpoints
2. Missing required fields (location, language)
3. Exceeding keyword limits per endpoint

**Solution**:
```json
// ❌ Wrong
{"keyword": "interview", "location_code": 2840}

// ✅ Correct
{"keywords": ["interview"], "location_code": 2840}
```

---

## Location & Language Codes

**Common Locations**:
- `2840` - United States (default in codebase)

**Common Languages**:
- `en` - English
- `es` - Spanish
- `ja` - Japanese

**Flexibility**: All endpoints accept either:
- `location_code` OR `location_name`
- `language_code` OR `language_name`

---

## Cost Summary

| Endpoint | Approx. Cost/Keyword | Codebase Usage Volume |
|----------|---------------------|----------------------|
| Keyword Overview | $0.025 | 200 (top candidates) |
| Bulk Keyword Difficulty | $0.003 | 1000 (all candidates) |
| SERP Organic | $0.050 | 50 (top opportunities) |
| Keywords For Site | $0.010 | 500 (baseline) |
| Related Keywords | $0.008 | 2000 (expansion) |
| Keyword Ideas | $0.008 | 1000 (expansion) |
| Keywords For Keywords | $0.005 | 1000 (expansion) |
| Keyword Suggestions | $0.005 | Variable |

**Total per website**: ~$22.50 for full discovery workflow

---

## Sources

### Endpoint Documentation

<a name="endpoint-1-keyword-overview">³</a> [Keyword Overview Live - DataForSEO API](https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live/)

<a name="endpoint-2-search-volume">⁴</a> [Search Volume Live - DataForSEO API](https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/)

<a name="endpoint-3-keywords-for-keywords">⁵</a> [Keywords For Keywords Live - DataForSEO API](https://docs.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live/)

<a name="endpoint-4-keywords-for-site">⁶</a> [Keywords For Site Live - DataForSEO API](https://docs.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live/)

<a name="endpoint-5-related-keywords">⁷</a> [Related Keywords Live - DataForSEO API](https://docs.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live/)

<a name="endpoint-6-keyword-ideas">⁸</a> [Keyword Ideas Live - DataForSEO API](https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live/)

<a name="endpoint-7-bulk-keyword-difficulty">⁹</a> [Bulk Keyword Difficulty Live - DataForSEO API](https://docs.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live/)

<a name="endpoint-8-keyword-suggestions">¹⁰</a> [Keyword Suggestions Live - DataForSEO API](https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live/)

<a name="endpoint-9-serp-organic">¹¹</a> [SERP Google Organic Live - DataForSEO API](https://docs.dataforseo.com/v3/serp/google/organic/live/regular/)

### General Documentation

<a name="sources">¹</a> [DataForSEO API Documentation](https://docs.dataforseo.com/v3/)

<a name="implementation-files">²</a> Local implementation files (see [Implementation Files](#implementation-files) section)

<a name="common-errors">¹²</a> [DataForSEO API Errors - Appendix](https://docs.dataforseo.com/v3/appendix-errors/)

---

## Additional Resources

- [DataForSEO Pricing](https://dataforseo.com/pricing)
- [Making Your First Call to DataForSEO Labs API](https://dataforseo.com/blog/fresh-approach-to-keyword-research)
- [Rules and Limitations of "keyword" and "keywords" Fields](https://dataforseo.com/help-center/rules-and-limitations-of-keyword-and-keywords-fields-in-dataforseo-apis)
