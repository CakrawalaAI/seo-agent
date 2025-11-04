SEO Agent — Onboarding (Merged into Dashboard)

- Onboarding happens on Dashboard when no website is selected
- Onboarding form: site URL → normalized (https, host, optional port)
- Creates `websites` row under active org; sets `activeWebsiteId` cookie
- Ensure route: `/dashboard/ensure?site=<url>` (server-owned)
- After ensure → redirect to `/dashboard?website={id}`
- Dashboard shows Website Summary and Status steps (crawl, keywords, schedule)

Actions
- Run crawl
- Generate keywords
- Schedule articles (30‑day runway)

Notes
- UI and APIs are website‑scoped only
- Active selection stored via `/api/active-website`
