# Onboarding Flow

## Purpose
- Convert landing visitors into active projects
- Keep UI in sync with backend crawl/plan pipelines
- Reuse dashboard status logic for continuity

## Funnel Overview
1. Landing form captures domain + intent before auth
2. Google OAuth completes session
3. `/onboarding/ensure?site=<url>` persists the project + seeds crawl bundle
4. Animated status mirrors bundle progress
5. Project ready state links to dashboard

## Step Detail
### 1. Landing Form (`/` hero)
- UI: `Input[website URL]` + `Continue with Google` CTA
- Validate domain format + reachability (HEAD fetch w/ timeout)
- On submit, stash payload in OAuth `state` (JSON `{ redirect:'/onboarding', domain, slug }`)
- If session already exists, skip OAuth and call `POST /api/projects`

### 2. OAuth Callback
- Parse state, hydrate session cookie
- Redirect to `/onboarding/ensure?site={siteUrl}` (site only)
- On OAuth denial → return to landing with toast “Sign-in cancelled”

### 3. Ensure Route (`/onboarding/ensure?site=<url>`, server-owned)
- Require authenticated session with active org
- Normalize site from query (canonicalize host; compute slug/name server-side)
- Call `ensureProjectForOrg` to insert project or reuse existing (scoped to org)
- Update session `activeProjectId`, queue crawl job
- Redirect to `/onboarding?projectId={id}&project={slug}`

### 4. Onboarding Screen (`/onboarding?projectId={id}&project={slug}`)
- Loader pulls latest snapshot (`GET /api/projects/:id/snapshot`) + bundle hints
- Hydrate client with project + phase flags
- Start 5s polling until project reaches ready state

### 5. Crawl Animation
- While snapshot lacks crawl artifacts: run deterministic faux queue (e.g. sitemap entries from submitted URL) with 300–500 ms cadence
- Switch to real data once `crawl/pages.jsonl` yields entries; list recent URLs with status chip (pending/complete)
- Show progress meter derived from known page count if available; fallback to “discovering site structure” copy

### 6. Keyword Animation
- Trigger when snapshot exposes `keywords/candidates.jsonl` size > 0
- Stream top keyword tuples (`keyword | searchVolume | difficulty`) rendered in ticker every 300–500 ms
- Tie headline to actual counts (e.g. “12 high-traffic keyword themes found”)

### 7. Plan & Schedule Reveal
- When `articles` table gains rows, swap to plan summary card
- Display first publish date, number of drafts, CTA `View content plan`
- Provide inline tip to connect CMS integration; link to settings

### 8. Completion Redirect
- On first `articles.status='scheduled'`, auto-redirect to `/dashboard`
- Persist query flag `?onboarding=done` so dashboard can show welcome banner + next steps checklist

## States
- `auth_required`: no session; redirect to landing
- `url_required`: authenticated, no project create yet
- `initializing`: project row exists, jobs enqueued, no bundle data
- `crawling`: `crawl/pages.jsonl` non-empty
- `keywording`: keywords bundle files populated, articles empty
- `planning`: articles drafts exist, none scheduled
- `ready`: scheduled article(s) present

## Error Paths
- OAuth denial → return to landing with toast “Sign-in cancelled”
- Project create fails → display message + allow retry with same domain
- Snapshot polling timeout (>2 min) → show fallback CTA to dashboard

## Telemetry
- Track events: `onboarding_form_submit`, `onboarding_project_created`, `onboarding_phase_change`, `onboarding_abandon`
- Capture time spent per phase for pipeline health metrics

## Notes
- Only `site` travels in redirects. Slug/name derived server-side.
- Uniqueness scoped to org: `(org_id, canonical_site_url)`; different orgs may onboard the same domain.
- On first load with `projectId`, client clears `localStorage['seo-agent.onboarding.siteUrl']`.
