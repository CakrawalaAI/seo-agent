Single nav: /dashboard|/keywords|/calendar|/articles|/integrations|/settings
  - Active project from ?project=; loader hydrates ActiveProjectProvider; redirects
    if missing
  - All pages share compact header: {project switcher} | {page title/actions}; dark
    minimal styling
  - Remove legacy sections: plan/billing widgets, locale badges, webhook cards
    (unless on integrations)
  - Query data per project; loaders return empty states with CTA when no rows

  /dashboard

  - URL /dashboard?project={id}; focus on summary + workflow CTA
  - CRUD: R project health metrics, R latest crawl summary, R next steps; no
    create/update here

  +------------------------------------------------+
  | Header: Project Picker | "Dashboard"           |
  +------------------+-----------------------------+
  | Sidebar Nav      | Hero: Project Status tiles  |
  |                  |-----------------------------|
  |                  | Section: Business Summary   |
  |                  |-----------------------------|
  |                  | Section: Prep Interview CTA |
  |                  | (single primary button)     |
  +------------------+-----------------------------+

 /keywords

  - URL /keywords?project={id}
  - CRUD: C generate keywords, U refresh metrics, R list/filter keywords, D archive
    (future toggle only)
  - UI trims metadata badges, webhook block, filter chips
  - Controls: search input, conditional primary button (Generate when list empty
    else Refresh)

  +------------------------------------------------+
  | Header: Project Picker | "Keywords"            |
  +------------------+-----------------------------+
  | Sidebar Nav      | Toolbar: Search box + CTA   |
  |                  |-----------------------------|
  |                  | Table: Keyword, Volume,     |
  |                  |         Status, Notes       |
  |                  | Empty state -> CTA message  |
  +------------------+-----------------------------+

  /calendar

  - URL /calendar?project={id}
  - CRUD: R scheduled items, C via global planner modal (trigger button), U drag-
    reschedule (later), D remove item
  - Remove queue depth, integrations, plan policy text

  +------------------------------------------------+
  | Header: Project Picker | "Calendar" + CTA      |
  +------------------+-----------------------------+
  | Sidebar Nav      | Full-width Calendar grid    |
  |                  | (month/week toggle optional)|
  |                  | Empty state overlays CTA    |
  +------------------+-----------------------------+

/articles

  - URL /articles?project={id}
  - CRUD: R table of drafts/published, U status (future inline), D delete (future)
  - Sorted reverse-chronological

  +------------------------------------------------+
  | Header: Project Picker | "Articles"            |
  +------------------+-----------------------------+
  | Sidebar Nav      | Data Table: Date | Title |  |
  |                  | Status | Actions minimal    |
  |                  | Empty state banner          |
  +------------------+-----------------------------+

  /integrations

  - URL /integrations?project={id}
  - CRUD: C webhook, R existing webhooks, D remove webhook
  - Only essential form; no per-project cards elsewhere

  +------------------------------------------------+
  | Header: Project Picker | "Integrations"        |
  +------------------+-----------------------------+
  | Sidebar Nav      | Section: Webhook List       |
  |                  |-----------------------------|
  |                  | Form: URL, Secret, Save btn |
  +------------------+-----------------------------+

/settings

  - URL /settings (global; optional ?project for context though UI global)
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
