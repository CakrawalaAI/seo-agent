# SEO Agent - Sequence Diagrams

## Overview

This document defines the actual user journeys and system flows based on the implemented architecture. All flows use:
- **DataForSEO** for keyword discovery & metrics
- **Playwright** (self-hosted) for web crawling
- **RabbitMQ** for job orchestration (no jobs table)
- **Global keyword canon** for deduplication & caching

---

## Flow 1: Initial Setup → Content Strategy

**User Goal:** Add website → Get keyword recommendations → Generate 30-day content plan

```
┌──────┐                ┌─────┐              ┌────────────┐           ┌──────────┐
│ User │                │ Web │              │    API     │           │ RabbitMQ │
└──┬───┘                └──┬──┘              └─────┬──────┘           └────┬─────┘
   │                       │                       │                       │
   │ 1. Sign up / Login    │                       │                       │
   ├──────────────────────►│                       │                       │
   │                       │ POST /api/auth/login  │                       │
   │                       ├──────────────────────►│                       │
   │                       │◄──────────────────────┤                       │
   │                       │ Set session cookie    │                       │
   │◄──────────────────────┤                       │                       │
   │                       │                       │                       │
   │ 2. Create project     │                       │                       │
   │    (name, siteUrl)    │                       │                       │
   ├──────────────────────►│ POST /api/projects    │                       │
   │                       ├──────────────────────►│                       │
   │                       │                       │                       │
   │                       │                       │ INSERT projects       │
   │                       │                       │ (status='draft')      │
   │                       │                       ├───────────┐           │
   │                       │                       │           │           │
   │                       │                       │◄──────────┘           │
   │                       │                       │                       │
   │                       │                       │ publish('crawl.{id}') │
   │                       │                       ├──────────────────────►│
   │                       │◄──────────────────────┤                       │
   │                       │ 201 {projectId}       │                       │
   │◄──────────────────────┤                       │                       │
   │                       │                       │                       │
   │ 3. Poll project status│                       │                       │
   │    (UI shows progress)│                       │                       │
   ├──────────────────────►│ GET /api/projects/:id │                       │
   │                       ├──────────────────────►│                       │
   │                       │◄──────────────────────┤                       │
   │◄──────────────────────┤ {status: 'crawling'}  │                       │
   │                       │                       │                       │


┌────────────┐            ┌──────────┐           ┌────────────┐          ┌──────────────┐
│ RabbitMQ   │            │  Worker  │           │ Playwright │          │      DB      │
│            │            │ (crawler)│           │            │          │              │
└─────┬──────┘            └────┬─────┘           └──────┬─────┘          └──────┬───────┘
      │                        │                        │                       │
      │ consume 'crawl.{id}'   │                        │                       │
      ├───────────────────────►│                        │                       │
      │                        │                        │                       │
      │                        │ UPDATE projects        │                       │
      │                        │ SET status='crawling'  │                       │
      │                        ├───────────────────────────────────────────────►│
      │                        │                        │                       │
      │                        │ Fetch sitemap.xml      │                       │
      │                        ├───────────────────────►│                       │
      │                        │◄───────────────────────┤                       │
      │                        │ [~200 URLs sampled]    │                       │
      │                        │                        │                       │
      │                        │ LLM rank top N reps    │                       │
      │                        │ (home, about, pricing, │                       │
      │                        │  products, blog/5-10)  │                       │
      │                        ├────────────┐           │                       │
      │                        │            │           │                       │
      │                        │◄───────────┘           │                       │
      │                        │ [Selected URLs: 5-10]  │                       │
      │                        │                        │                       │
      │                        │ Crawl each URL         │                       │
      │                        ├───────────────────────►│                       │
      │                        │                        │ page.goto(url)        │
      │                        │                        │ waitForLoad()         │
      │                        │                        │ extractText()         │
      │                        │                        │ extractHeadings()     │
      │                        │◄───────────────────────┤                       │
      │                        │ {text, headings, meta} │                       │
      │                        │                        │                       │
      │                        │ [Store in memory/temp] │                       │
      │                        │                        │                       │
      │                        │ UPDATE projects        │                       │
      │                        │ SET status='crawled'   │                       │
      │                        ├───────────────────────────────────────────────►│
      │                        │                        │                       │
      │ publish('discovery')   │                        │                       │
      │◄───────────────────────┤                        │                       │
      │                        │                        │                       │


┌──────────┐              ┌──────────┐           ┌────────────┐          ┌──────────────┐
│ RabbitMQ │              │  Worker  │           │ DataForSEO │          │      DB      │
│          │              │ (general)│           │    API     │          │              │
└────┬─────┘              └────┬─────┘           └──────┬─────┘          └──────┬───────┘
     │                         │                        │                       │
     │ consume 'discovery'     │                        │                       │
     ├────────────────────────►│                        │                       │
     │                         │                        │                       │
     │                         │ UPDATE projects        │                       │
     │                         │ status='discovering'   │                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │                        │                       │
     │                         │ Step 1: LLM Summarize  │                       │
     │                         │ (crawl text dump)      │                       │
     │                         ├─────────┐              │                       │
     │                         │         │              │                       │
     │                         │◄────────┘              │                       │
     │                         │ {businessModel,        │                       │
     │                         │  audience, topics}     │                       │
     │                         │                        │                       │
     │                         │ Step 2: LLM Seeds      │                       │
     │                         │ (10-20 seed keywords   │                       │
     │                         │  from summary+headings)│                       │
     │                         ├─────────┐              │                       │
     │                         │         │              │                       │
     │                         │◄────────┘              │                       │
     │                         │ [seeds: 10-20 phrases] │                       │
     │                         │                        │                       │
     │                         │ Step 3: Baseline       │                       │
     │                         │ Keywords For Site API  │                       │
     │                         ├───────────────────────►│                       │
     │                         │ {domain, location}     │                       │
     │                         │◄───────────────────────┤                       │
     │                         │ [existing rankings]    │                       │
     │                         │                        │                       │
     │                         │ Step 4: Expansion      │                       │
     │                         │ Related Keywords API   │                       │
     │                         ├───────────────────────►│                       │
     │                         │ {seeds[], location}    │                       │
     │                         │◄───────────────────────┤                       │
     │                         │ [~80 expanded keywords]│                       │
     │                         │                        │                       │
     │                         │ Step 5: Keyword Ideas  │                       │
     │                         ├───────────────────────►│                       │
     │                         │◄───────────────────────┤                       │
     │                         │ [category-based terms] │                       │
     │                         │                        │                       │
     │                         │ Step 6: Deduplicate    │                       │
     │                         │ (phrase_norm + lang)   │                       │
     │                         ├─────────┐              │                       │
     │                         │         │              │                       │
     │                         │◄────────┘              │                       │
     │                         │ [unique candidates]    │                       │
     │                         │                        │                       │
     │                         │ Check keyword_canon    │                       │
     │                         │ for existing cache     │                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │ SELECT WHERE           │                       │
     │                         │   phrase_norm IN (...)  │                       │
     │                         │◄───────────────────────────────────────────────┤
     │                         │ [cached canons]        │                       │
     │                         │                        │                       │
     │                         │ Filter uncached only   │                       │
     │                         ├─────────┐              │                       │
     │                         │         │              │                       │
     │                         │◄────────┘              │                       │
     │                         │                        │                       │
     │                         │ Step 7: Bulk Difficulty│                       │
     │                         │ (batch uncached only)  │                       │
     │                         ├───────────────────────►│                       │
     │                         │◄───────────────────────┤                       │
     │                         │ [{phrase, difficulty}] │                       │
     │                         │                        │                       │
     │                         │ Step 8: Keyword Overview│                      │
     │                         │ (top 200 by volume)    │                       │
     │                         ├───────────────────────►│                       │
     │                         │◄───────────────────────┤                       │
     │                         │ [{phrase, volume,      │                       │
     │                         │   cpc, intent, ...}]   │                       │
     │                         │                        │                       │
     │                         │ Step 9: Upsert Canon   │                       │
     │                         │ + Metrics Cache        │                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │ INSERT keyword_canon   │                       │
     │                         │ ON CONFLICT DO NOTHING │                       │
     │                         │                        │                       │
     │                         │ INSERT metric_cache    │                       │
     │                         │ (canon_id, metrics)    │                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │                        │                       │
     │                         │ Step 10: Link to Project│                      │
     │                         │ INSERT keywords        │                       │
     │                         │ (project_id, canon_id) │                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │                        │                       │
     │                         │ UPDATE projects        │                       │
     │                         │ status='keywords_ready'│                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │                        │                       │
     │ publish('plan')         │                        │                       │
     │◄────────────────────────┤                        │                       │
     │                         │                        │                       │


┌──────────┐              ┌──────────┐           ┌────────────┐          ┌──────────────┐
│ RabbitMQ │              │  Worker  │           │    LLM     │          │      DB      │
│          │              │ (general)│           │  (OpenAI)  │          │              │
└────┬─────┘              └────┬─────┘           └──────┬─────┘          └──────┬───────┘
     │                         │                        │                       │
     │ consume 'plan'          │                        │                       │
     ├────────────────────────►│                        │                       │
     │                         │                        │                       │
     │                         │ SELECT keywords        │                       │
     │                         │ WHERE project_id=$1    │                       │
     │                         │ ORDER BY opportunity   │                       │
     │                         │ LIMIT 30               │                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │◄───────────────────────────────────────────────┤
     │                         │ [top 30 keywords]      │                       │
     │                         │                        │                       │
     │                         │ For each keyword:      │                       │
     │                         │ ┌──────────────────────┐                       │
     │                         │ │ Loop 30 times        │                       │
     │                         │ │                      │                       │
     │                         │ │ LLM draftTitleOutline│                       │
     │                         │ ├─────────────────────►│                       │
     │                         │ │ {keyword, tone}      │                       │
     │                         │ │◄─────────────────────┤                       │
     │                         │ │ {title, outline}     │                       │
     │                         │ │                      │                       │
     │                         │ │ INSERT articles      │                       │
     │                         │ │ (status='draft',     │                       │
     │                         │ │  title, outline_json,│                       │
     │                         │ │  body_html=NULL,     │                       │
     │                         │ │  planned_date=       │                       │
     │                         │ │   today+N days)      ├──────────────────────►│
     │                         │ │                      │                       │
     │                         │ └──────────────────────┘                       │
     │                         │                        │                       │
     │                         │ UPDATE projects        │                       │
     │                         │ SET status='active'    │                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │                        │                       │


┌──────┐                  ┌─────┐
│ User │                  │ Web │
└──┬───┘                  └──┬──┘
   │                         │
   │ 4. View Keywords page   │
   ├────────────────────────►│ GET /api/projects/:id/keywords
   │                         ├─────────────►
   │◄────────────────────────┤ [keywords with opportunity, volume, difficulty]
   │                         │
   │ 5. View Calendar page   │
   ├────────────────────────►│ GET /api/projects/:id/articles?status=draft
   │                         ├─────────────►
   │◄────────────────────────┤ [30 articles: planned_date, title, outline]
   │                         │
   │ 6. (Optional) Star/exclude keywords, reschedule articles
   ├────────────────────────►│ PATCH /api/keywords/:id
   │                         │ PATCH /api/articles/:id
   │◄────────────────────────┤
   │                         │
```

**Summary:**
1. User creates project with site URL
2. **Crawl**: Playwright fetches sitemap → LLM selects representatives → extracts text
3. **Discovery**: LLM summary → seed keywords → DataForSEO expansion → global cache dedup
4. **Planning**: LLM generates 30 title+outline articles from top keywords
5. User reviews keywords & calendar (can edit/reschedule)

---

## Flow 2: Daily Auto-Generation → Auto-Publish

**User Goal:** System generates article bodies 3 days ahead and auto-publishes on schedule

```
┌──────────┐              ┌─────┐              ┌────────────┐           ┌──────────┐
│   Cron   │              │ API │              │ RabbitMQ   │           │    DB    │
│ (daily)  │              │     │              │            │           │          │
└────┬─────┘              └──┬──┘              └──────┬─────┘           └────┬─────┘
     │                       │                        │                      │
     │ Trigger daily run     │                        │                      │
     │ (every project)       │                        │                      │
     ├──────────────────────►│ POST /api/schedules/run                      │
     │                       │ {projectId}            │                      │
     │                       │                        │                      │
     │                       │ SELECT articles WHERE  │                      │
     │                       │   project_id=$1 AND    │                      │
     │                       │   planned_date BETWEEN │                      │
     │                       │   today() AND today()+3│                      │
     │                       │   AND status='draft'   │                      │
     │                       ├───────────────────────────────────────────────►│
     │                       │◄───────────────────────────────────────────────┤
     │                       │ [articles needing body]│                      │
     │                       │                        │                      │
     │                       │ For each article:      │                      │
     │                       │ publish('generate')    │                      │
     │                       ├───────────────────────►│                      │
     │                       │                        │                      │
     │◄──────────────────────┤ 200 OK                 │                      │
     │                       │                        │                      │


┌──────────┐              ┌──────────┐           ┌────────────┐          ┌──────────────┐
│ RabbitMQ │              │  Worker  │           │    LLM     │          │      DB      │
│          │              │ (general)│           │  (OpenAI)  │          │              │
└────┬─────┘              └────┬─────┘           └──────┬─────┘          └──────┬───────┘
     │                         │                        │                       │
     │ consume 'generate'      │                        │                       │
     ├────────────────────────►│                        │                       │
     │                         │                        │                       │
     │                         │ UPDATE articles        │                       │
     │                         │ SET status='generating'│                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │                        │                       │
     │                         │ SELECT article + keyword                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │◄───────────────────────────────────────────────┤
     │                         │ {title, outline,       │                       │
     │                         │  keyword phrase}       │                       │
     │                         │                        │                       │
     │                         │ (Optional) Fetch fresh │                       │
     │                         │ SERP data via API      │                       │
     │                         │ (ephemeral, no persist)│                       │
     │                         ├─────────┐              │                       │
     │                         │         │              │                       │
     │                         │◄────────┘              │                       │
     │                         │                        │                       │
     │                         │ LLM generateBody       │                       │
     │                         ├───────────────────────►│                       │
     │                         │ {title, outline,       │                       │
     │                         │  keyword, SERP context}│                       │
     │                         │◄───────────────────────┤                       │
     │                         │ {bodyHtml, media}      │                       │
     │                         │                        │                       │
     │                         │ UPDATE articles SET    │                       │
     │                         │   body_html=$body,     │                       │
     │                         │   status='ready',      │                       │
     │                         │   generation_date=NOW()│                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │                        │                       │
     │                         │ Check auto-publish     │                       │
     │                         │ (always yes)           │                       │
     │                         ├─────────┐              │                       │
     │                         │         │              │                       │
     │                         │◄────────┘              │                       │
     │                         │                        │                       │
     │ publish('publish')      │                        │                       │
     │◄────────────────────────┤                        │                       │
     │                         │                        │                       │


┌──────────┐              ┌──────────┐           ┌────────────┐          ┌──────────────┐
│ RabbitMQ │              │  Worker  │           │    CMS     │          │      DB      │
│          │              │ (general)│           │ Integration│          │              │
└────┬─────┘              └────┬─────┘           └──────┬─────┘          └──────┬───────┘
     │                         │                        │                       │
     │ consume 'publish'       │                        │                       │
     ├────────────────────────►│                        │                       │
     │                         │                        │                       │
     │                         │ SELECT article + integration                   │
     │                         ├───────────────────────────────────────────────►│
     │                         │◄───────────────────────────────────────────────┤
     │                         │ {article, integration} │                       │
     │                         │                        │                       │
     │                         │ Build PortableArticle  │                       │
     │                         ├─────────┐              │                       │
     │                         │         │              │                       │
     │                         │◄────────┘              │                       │
     │                         │ {title, bodyHtml, seo, │                       │
     │                         │  media, slug, ...}     │                       │
     │                         │                        │                       │
     │                         │ Publish via integration│                       │
     │                         ├───────────────────────►│                       │
     │                         │ (Webhook/Webflow/WP)   │                       │
     │                         │                        │ POST to CMS           │
     │                         │                        ├────────┐              │
     │                         │                        │        │              │
     │                         │                        │◄───────┘              │
     │                         │◄───────────────────────┤                       │
     │                         │ {externalId, url}      │                       │
     │                         │                        │                       │
     │                         │ UPDATE articles SET    │                       │
     │                         │   status='published',  │                       │
     │                         │   publish_date=NOW(),  │                       │
     │                         │   url=$url             │                       │
     │                         ├───────────────────────────────────────────────►│
     │                         │                        │                       │


┌──────┐                  ┌─────┐
│ User │                  │ Web │
└──┬───┘                  └──┬──┘
   │                         │
   │ (Optional) Edit before publish
   │ (3-day window)          │
   ├────────────────────────►│ GET /api/articles/:id
   │                         ├─────────────►
   │◄────────────────────────┤ {title, outline, bodyHtml, status:'ready'}
   │                         │
   │ Make edits              │
   ├────────────────────────►│ PATCH /api/articles/:id
   │                         │ {bodyHtml: "..."}
   │◄────────────────────────┤ 200 OK
   │                         │
   │ (Article still auto-publishes on planned_date)
   │                         │
   │ OR edit post-publish    │
   ├────────────────────────►│ PATCH /api/articles/:id
   │                         │ {bodyHtml: "..."}
   │◄────────────────────────┤ 200 OK
   │                         │
   │ (Re-publish via integration if sync enabled)
   │                         │
```

**Summary:**
1. Daily cron triggers for each active project
2. System selects articles with `planned_date` in next 3 days & `status='draft'`
3. Worker generates body via LLM (with optional SERP context)
4. Worker auto-publishes to configured CMS integration
5. User can edit pre-publish (3-day window) or post-publish

---

## Flow 3: User Removes Article → Auto-Generate Replacement

**User Goal:** Remove unwanted article from schedule → System backfills with new article

```
┌──────┐                  ┌─────┐              ┌────────────┐           ┌──────────┐
│ User │                  │ Web │              │    API     │           │    DB    │
└──┬───┘                  └──┬──┘              └─────┬──────┘           └────┬─────┘
   │                         │                       │                       │
   │ Delete article from     │                       │                       │
   │ calendar (e.g., day 15) │                       │                       │
   ├────────────────────────►│ DELETE /api/articles/:id                      │
   │                         ├──────────────────────►│                       │
   │                         │                       │                       │
   │                         │                       │ DELETE articles       │
   │                         │                       │ WHERE id=$1           │
   │                         │                       ├──────────────────────►│
   │                         │                       │                       │
   │                         │                       │ Check: articles count │
   │                         │                       │ for project < 30?     │
   │                         │                       ├───────┐               │
   │                         │                       │       │               │
   │                         │                       │◄──────┘               │
   │                         │                       │ Yes, need replacement │
   │                         │                       │                       │
   │                         │                       │ SELECT eligible keywords          │
   │                         │                       │ (not used recently)   │
   │                         │                       ├──────────────────────►│
   │                         │                       │◄──────────────────────┤
   │                         │                       │ [next keyword]        │
   │                         │                       │                       │
   │                         │                       │ LLM draftTitleOutline │
   │                         │                       ├───────┐               │
   │                         │                       │       │               │
   │                         │                       │◄──────┘               │
   │                         │                       │                       │
   │                         │                       │ INSERT articles       │
   │                         │                       │ (planned_date=day 15, │
   │                         │                       │  status='draft')      │
   │                         │                       ├──────────────────────►│
   │                         │◄──────────────────────┤                       │
   │                         │ 200 OK                │                       │
   │◄────────────────────────┤                       │                       │
   │                         │                       │                       │
   │ Refresh calendar        │                       │                       │
   ├────────────────────────►│ GET /api/projects/:id/articles                │
   │◄────────────────────────┤ [new article in slot] │                       │
   │                         │                       │                       │
```

**Summary:**
1. User deletes article
2. System detects gap in 30-day calendar
3. Auto-generates replacement article from next eligible keyword
4. Maintains continuous 30-day publishing pipeline

---

## Flow 4: Keyword Management (Include/Exclude from Rotation)

**User Goal:** Control which keywords are eligible for article scheduling

```
┌──────┐                  ┌─────┐              ┌────────────┐           ┌──────────┐
│ User │                  │ Web │              │    API     │           │    DB    │
└──┬───┘                  └──┬──┘              └─────┬──────┘           └────┬─────┘
   │                         │                       │                       │
   │ View Keywords page      │                       │                       │
   ├────────────────────────►│ GET /api/projects/:id/keywords                │
   │◄────────────────────────┤ [all keywords with metadata]                  │
   │                         │                       │                       │
   │ Exclude keyword         │                       │                       │
   │ (e.g., "cheap coffee")  │                       │                       │
   ├────────────────────────►│ PATCH /api/keywords/:id                       │
   │                         │ {status: 'excluded'}  │                       │
   │                         ├──────────────────────►│                       │
   │                         │                       │ UPDATE keywords       │
   │                         │                       │ SET status='excluded' │
   │                         │                       ├──────────────────────►│
   │                         │◄──────────────────────┤                       │
   │◄────────────────────────┤ 200 OK                │                       │
   │                         │                       │                       │
   │ Star high-priority KW   │                       │                       │
   ├────────────────────────►│ PATCH /api/keywords/:id                       │
   │                         │ {starred: true}       │                       │
   │                         ├──────────────────────►│                       │
   │                         │                       │ UPDATE keywords       │
   │                         │                       │ SET starred=true      │
   │                         │                       ├──────────────────────►│
   │                         │◄──────────────────────┤                       │
   │◄────────────────────────┤ 200 OK                │                       │
   │                         │                       │                       │
```

**Rotation Logic:**
- Planning selects from keywords WHERE `status IN ('recommended', 'planned')` and `starred=true OR opportunity > threshold`
- Excluded keywords skipped
- Starred keywords prioritized
- System rotates through top 30 eligible keywords

---

## Flow 5: Team Collaboration (Invite → RBAC)

**User Goal:** Invite teammate → Teammate can view/edit content

```
┌──────────┐              ┌─────┐              ┌────────────┐           ┌──────────┐
│ Owner    │              │ Web │              │    API     │           │    DB    │
└────┬─────┘              └──┬──┘              └─────┬──────┘           └────┬─────┘
     │                       │                       │                       │
     │ Invite teammate       │                       │                       │
     ├──────────────────────►│ POST /api/orgs/invites                        │
     │                       │ {email, role: 'member'}                       │
     │                       ├──────────────────────►│                       │
     │                       │                       │ INSERT org_invites    │
     │                       │                       │ (token, email,        │
     │                       │                       │  orgId, expiresAt)    │
     │                       │                       ├──────────────────────►│
     │                       │                       │                       │
     │                       │                       │ Send email with link  │
     │                       │                       ├───────┐               │
     │                       │                       │       │               │
     │                       │◄──────────────────────┤◄──────┘               │
     │◄──────────────────────┤ 200 OK                │                       │
     │                       │                       │                       │


┌──────────┐              ┌─────┐              ┌────────────┐           ┌──────────┐
│ Teammate │              │ Web │              │    API     │           │    DB    │
└────┬─────┘              └──┬──┘              └─────┬──────┘           └────┬─────┘
     │                       │                       │                       │
     │ Click invite link     │                       │                       │
     ├──────────────────────►│ GET /invite/:token    │                       │
     │                       ├──────────────────────►│                       │
     │                       │                       │ SELECT org_invites    │
     │                       │                       │ WHERE token=$1        │
     │                       │                       ├──────────────────────►│
     │                       │                       │◄──────────────────────┤
     │                       │                       │ {orgId, email, role}  │
     │                       │◄──────────────────────┤                       │
     │◄──────────────────────┤ Show "Join {orgName}"│                       │
     │                       │                       │                       │
     │ Accept invite         │                       │                       │
     ├──────────────────────►│ POST /api/orgs/invites/:token/accept          │
     │                       ├──────────────────────►│                       │
     │                       │                       │ INSERT org_members    │
     │                       │                       │ (orgId, userEmail,    │
     │                       │                       │  role)                │
     │                       │                       ├──────────────────────►│
     │                       │                       │                       │
     │                       │                       │ UPDATE org_invites    │
     │                       │                       │ SET consumedAt=NOW()  │
     │                       │                       ├──────────────────────►│
     │                       │◄──────────────────────┤                       │
     │◄──────────────────────┤ Redirect to dashboard│                       │
     │                       │                       │                       │
     │ View projects         │                       │                       │
     ├──────────────────────►│ GET /api/projects     │                       │
     │                       ├──────────────────────►│                       │
     │                       │                       │ Check org_members     │
     │                       │                       │ WHERE userEmail=$1    │
     │                       │                       ├──────────────────────►│
     │                       │                       │◄──────────────────────┤
     │                       │◄──────────────────────┤ [org projects]        │
     │◄──────────────────────┤                       │                       │
     │                       │                       │                       │
     │ Edit article draft    │                       │                       │
     ├──────────────────────►│ PATCH /api/articles/:id                       │
     │                       ├──────────────────────►│                       │
     │                       │                       │ Check RBAC:           │
     │                       │                       │ member has write?     │
     │                       │                       ├───────┐               │
     │                       │                       │       │               │
     │                       │                       │◄──────┘               │
     │                       │                       │ UPDATE articles       │
     │                       │                       ├──────────────────────►│
     │                       │◄──────────────────────┤                       │
     │◄──────────────────────┤ 200 OK                │                       │
     │                       │                       │                       │
```

**RBAC Model:**
- **owner**: Full control (billing, delete org, manage members)
- **admin**: Manage members, all project access
- **member**: Read/write access to projects (view calendar, edit drafts)

All roles can:
- View content calendar
- Edit article drafts (pre/post-publish)
- View keywords
- Reschedule articles

Only owner/admin can:
- Invite/remove members
- Manage integrations
- Delete projects

---

## System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             SEO Agent System                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Browser   │◄───────►│  TanStack   │◄───────►│  Postgres   │
│  (React UI) │         │   Start     │         │  (Drizzle)  │
└─────────────┘         │  API Server │         └─────────────┘
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │  RabbitMQ   │
                        │   Exchange  │
                        │ 'seo.jobs'  │
                        └──────┬──────┘
                               │
                ┌──────────────┼──────────────┐
                │                             │
         ┌──────▼──────┐               ┌─────▼──────┐
         │   Worker    │               │   Worker   │
         │  (crawler)  │               │  (general) │
         │             │               │            │
         │ • crawl     │               │ • discovery│
         │             │               │ • plan     │
         └──────┬──────┘               │ • generate │
                │                      │ • publish  │
                │                      └─────┬──────┘
                │                            │
        ┌───────▼────────┐          ┌────────▼────────┐
        │   Playwright   │          │   External APIs │
        │  (Chromium)    │          │                 │
        │  • Sitemap     │          │ • DataForSEO    │
        │  • JS render   │          │ • OpenAI        │
        │  • Extract     │          │ • Exa           │
        └────────────────┘          └─────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                        Database Schema (Core)                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  orgs ──┬──► org_members (RBAC)                                        │
│         │                                                               │
│         └──► projects ──┬──► articles (title+outline+body)             │
│                         │      ├─ status: draft→generating→ready→published
│                         │      └─ planned_date, body_html               │
│                         │                                               │
│                         ├──► keywords (junction: project+canon)         │
│                         │                                               │
│                         └──► project_integrations (webhook/webflow/etc) │
│                                                                         │
│  keyword_canon (global) ──► metric_cache (1:1, global)                 │
│    • phrase_norm + language_code                                       │
│    • Shared across all projects                                        │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                          Key Design Decisions                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. NO jobs table → RabbitMQ queue state + project.status enum         │
│  2. NO crawl_pages persistence → ephemeral processing                  │
│  3. NO serp_snapshot → fetch on-demand, don't persist                  │
│  4. NO plan_items → merged into articles (status='draft')              │
│                                                                         │
│  5. Global keyword canon for deduplication & cost optimization         │
│  6. Cache-first metrics (only query API for uncached keywords)         │
│  7. Lazy body generation (3-day lookahead window)                      │
│  8. Auto-publish (no review gate; edit pre/post-publish)               │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## State Machine: Article Lifecycle

```
┌─────────┐
│ (none)  │
└────┬────┘
     │
     │ Planning worker creates article
     │ (title + outline only)
     ▼
┌─────────┐
│ draft   │ ◄─────────────────────┐
└────┬────┘                       │
     │                            │
     │ Daily cron triggers        │ User edits
     │ 3 days before publish      │ (pre-publish)
     ▼                            │
┌────────────┐                    │
│ generating │                    │
└─────┬──────┘                    │
      │                           │
      │ LLM generates body        │
      ▼                           │
┌─────────┐                       │
│ ready   │───────────────────────┘
└────┬────┘
     │
     │ Auto-publish (immediate)
     ▼
┌───────────┐
│ published │ ◄─────────────────┐
└───────────┘                   │
     │                          │
     │ User edits post-publish  │
     │ (re-sync to CMS)         │
     └──────────────────────────┘
```

**Transitions:**
- `draft → generating`: Daily cron for articles with `planned_date` in next 3 days
- `generating → ready`: Body generation completes
- `ready → published`: Auto-publish job executes
- `published → published`: User edits + re-publishes

**Deletion:**
- User deletes article in any state → system generates replacement

---

## Integration Points

### **CMS Connectors** (PortableArticle format)

```json
{
  "title": "Best Coffee Makers 2025",
  "excerpt": "Discover the top-rated coffee makers...",
  "bodyHtml": "<article><h2>Introduction</h2>...</article>",
  "outline": [
    {"level": 2, "text": "Introduction"},
    {"level": 2, "text": "Top 5 Coffee Makers"},
    {"level": 3, "text": "Drip Coffee Makers"}
  ],
  "media": {
    "images": [
      {"src": "https://...", "alt": "...", "caption": "..."}
    ],
    "youtube": [
      {"id": "abc123", "title": "Coffee Maker Review"}
    ]
  },
  "seo": {
    "canonical": "https://example.com/best-coffee-makers",
    "metaTitle": "Best Coffee Makers 2025 - Expert Reviews",
    "metaDescription": "...",
    "primaryKeyword": "best coffee makers",
    "secondaryKeywords": ["coffee machine", "drip coffee maker"]
  },
  "locale": "en-US",
  "tags": ["coffee", "kitchen appliances"],
  "slug": "best-coffee-makers-2025"
}
```

**Supported Integrations:**
- **Webhook** (v0): POST to custom URL with HMAC signature
- **Webflow** (v0.1): Create CMS item in collection
- **WordPress** (v0.2): `wp/v2/posts` API
- **Framer** (v0.3): Plugin/receiver
- **Shopify/Wix** (future)

---

## Cache Strategy: Global Keyword Canon

**Problem:** Multiple projects target same keywords → duplicated API costs

**Solution:** Global canonical deduplication

```
Project A wants: "best coffee maker"
Project B wants: "Best Coffee Maker"
Project C wants: "best coffee maker"

Canonical identity:
  phrase_norm: "best coffee maker"
  language_code: "en"

Cache lookup:
  1. Normalize phrase → "best coffee maker"
  2. SELECT FROM keyword_canon WHERE phrase_norm=$1 AND language_code=$2
  3. IF found → SELECT FROM metric_cache WHERE canon_id=$1
  4. ELSE → Query DataForSEO → INSERT keyword_canon + metric_cache

Result:
  - Only 1 API call for all 3 projects
  - Projects link via keywords table (project_id + canon_id junction)
```

**Cache Invalidation:**
- Metrics refresh: Monthly (per calendar month)
- SERP refresh: 7-14 day TTL (ephemeral, no persist in v0)

---

## Error Handling & Retries

**RabbitMQ Dead Letter Queue (DLQ):**
```
Job fails → retry with exponential backoff (3 attempts)
Still failing → route to DLQ
Admin reviews DLQ → manual retry or discard
```

**User-Facing Errors:**
```
project.status = 'error' (crawl failed)
article.status = 'failed' (generation failed)

User sees:
  - Error message in UI
  - "Retry" button
  - Option to skip/reschedule
```

---

## Performance Considerations

**Crawl Optimization:**
- Sample 200 URLs from sitemap
- LLM selects 5-10 representatives (not all 200)
- Reduces crawl time from hours → minutes

**API Cost Optimization:**
- Global keyword cache (deduplicate across projects)
- Cache-first lookup (only query uncached keywords)
- Batch requests (Bulk Keyword Difficulty for 1k keywords/request)
- Tiered enrichment (Overview API for top 200 only, not all candidates)

**Generation Efficiency:**
- Lazy body generation (3-day lookahead, not upfront)
- Parallel job processing (RabbitMQ prefetch)
- SERP data fetched on-demand (ephemeral, no DB overhead)

---

## Summary

**Key User Journeys:**
1. ✅ Setup: Add site → Auto-crawl → Keyword discovery → 30-day plan
2. ✅ Daily loop: Auto-generate bodies 3 days ahead → Auto-publish
3. ✅ Editing: Pre-publish (3-day window) or post-publish
4. ✅ Team: Invite members → RBAC (read/write)
5. ✅ Keyword control: Include/exclude from rotation

**Design Principles:**
- **Automation-first**: No review gates, auto-publish
- **User control**: Edit anytime, exclude keywords, reschedule
- **Cost-optimized**: Global cache, cache-first, batch APIs
- **Team-friendly**: RBAC, shared workspace
- **Resilient**: RabbitMQ retries, DLQ, error recovery

**Next Steps:**
- Add attachment support (images, YouTube embeds)
- Post-publish analytics (GSC integration)
- Content optimization (rewrite underperforming articles)
