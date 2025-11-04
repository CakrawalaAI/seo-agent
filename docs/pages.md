Single nav: /dashboard|/keywords|/calendar|/articles|/integrations|/settings
  - Active website from ?website=; loader hydrates the active-website provider; redirects
    if missing
  - All pages share compact header: {website switcher} | {page title/actions}; dark
    minimal styling
  - Remove legacy sections: plan/billing widgets, locale badges, webhook cards
    (unless on integrations)
  - Query data per website; loaders return empty states with CTA when no rows

  /dashboard

  - URL /dashboard?website={id}; focus on summary + workflow CTA
  - If no website selected or none exist → show Onboarding form (website URL input) inline
  - CRUD: R website health metrics, R latest crawl summary, R next steps; no
    create/update here

  +------------------------------------------------+
  | Header: Website Picker | "Dashboard"           |
  +------------------+-----------------------------+
  | Sidebar Nav      | Hero: Website Status tiles  |
  |                  |-----------------------------|
  |                  | Section: Business Summary   |
  |                  |-----------------------------|
  |                  | Section: Prep Interview CTA |
  |                  | (single primary button)     |
  +------------------+-----------------------------+

 /keywords

 - URL /keywords?website={id}
  - Actions: Generate ideas (LLM seeds → keyword_ideas/live), list/filter keywords, optional manual refresh (no auto-refresh)
  - UI trims metadata badges, webhook block, filter chips
  - Controls: search input, conditional primary button (Generate when list empty
    else Refresh)

  +------------------------------------------------+
  | Header: Website Picker | "Keywords"            |
  +------------------+-----------------------------+
  | Sidebar Nav      | Toolbar: Search box + CTA   |
  |                  |-----------------------------|
  |                  | Table: Keyword, Volume,     |
  |                  |         Status, Notes       |
  |                  | Empty state -> CTA message  |
  +------------------+-----------------------------+

  /calendar

  - URL /calendar?website={id}
  - CRUD: R scheduled items, C via global planner modal (trigger button), U drag-
    reschedule (later), D remove item
  - Remove queue depth, integrations, plan policy text

  +------------------------------------------------+
  | Header: Website Picker | "Calendar" + CTA      |
  +------------------+-----------------------------+
  | Sidebar Nav      | Full-width Calendar grid    |
  |                  | (month/week toggle optional)|
  |                  | Empty state overlays CTA    |
  +------------------+-----------------------------+

/articles

  - URL /articles?website={id}
  - CRUD: R table of drafts/published, U status (future inline), D delete (future)
  - Sorted reverse-chronological (uses `scheduled_date` when present; else `publish_date`)

  +------------------------------------------------+
  | Header: Website Picker | "Articles"            |
  +------------------+-----------------------------+
  | Sidebar Nav      | Data Table: Date | Title |  |
  |                  | Status | Actions minimal    |
  |                  | Empty state banner          |
  +------------------+-----------------------------+

  /integrations

  - URL /integrations?website={id}
  - CRUD: C integration, U configure/test, R integration cards, D disconnect (retains config)
  - See docs/sequence-diagram.md Flow C for lifecycle details

  Layout: Two-column page
  - Left rail: per-website integration cards grouped by availability (Connected, Connectable, Coming Soon)
  - Right rail: context drawer (forms, OAuth prompts, webhook creator)

  Card Anatomy:
  - Logo, name, status pill (Connected, Error, Not Connected, Coming Soon)
  - Action button (Connect, Activate, Edit, Disconnect)
  - HMAC badge for webhook

  Behaviors:
  - One-click activation: when connector exposes connectMode='oneClick' and stored credentials exist,
    pressing Activate immediately flips status to 'connected' via PATCH /api/integrations/$id ({status:'connected'}) without additional modal
  - Toggle behaviour: active connectors render a Switch labelled 'Publish automatically';
    toggling off issues PATCH with {status:'disconnected'} but retains configJson. Re-enabling reuses stored config
  - Error handling: failed test marks card Error; user sees toast + inline description.
    Card provides Retry button (calls POST /api/integrations/$id/test)

  Filters:
  - Top-level segmented control (All, Connected, Coming Soon) to simplify website-level scanning

  Connect Flows (see docs/sequence-diagram.md section 4.3 for details):
  - Webhook: inline form (URL + secret). Submit calls POST /api/integrations → optimistic card with switch enabled.
    Provide copyable sample payload + curl test snippet
  - OAuth providers (Webflow, HubSpot, Squarespace, Wix): Connect opens hosted OAuth window (new tab).
    On callback server writes/updates integration + secrets, card auto-activates.
    UI listens on channel or polls /snapshot until status=connected
  - API token providers (Shopify, Ghost, WordPress, Notion, Unicorn Platform): Connect opens drawer with form.
    Submit saves config & immediately runs test; success flips to connected
  - REST API: card links to docs, exposes test button only; scheduling uses manual triggers. Treated as always available (no toggle)
  - Coming Soon: disabled cards with CTA 'Join Beta' collecting email via modal; no API calls

  +------------------------------------------------+
  | Header: Website Picker | "Integrations"        |
  +------------------+-----------------------------+
  | Sidebar Nav      | Left Rail: Integration Cards|
  |                  | (Grouped: Connected, etc.)  |
  |                  |-----------------------------|
  |                  | Right Rail: Context Drawer  |
  |                  | (Forms, OAuth, Config)      |
  +------------------+-----------------------------+

  Note: legacy /onboarding page removed; all onboarding happens within Dashboard.

/settings

  - URL /settings (global; optional ?website for context though UI global)
  - CRUD: C invite member, R member list, U update billing, D cancel subscription
  - Present subscription card with plan, renewal + expiry dates, actions to activate/cancel
  - Members section: email + role table, invite form, RBAC reminder (owners vs members)

  +------------------------------------------------+
  | Header: User Avatar | "Settings"               |
  +------------------+-----------------------------+
  | Sidebar Nav      | Card: Subscription details  |
  |                  |-----------------------------|
  |                  | Section: Members + invite   |
  |                  | form with role select       |
  +------------------+-----------------------------+
