# Keywords Table UI (Nov 2025)

## Goals
- Surface keyword backlog metrics from DataForSEO Labs in a sortable ShadCN data table.
- Focus on opportunity triage actions (include/exclude, delete) with minimal clutter.

## Columns
- **Keyword**
  - Value: `phrase`.
  - Default sort: ascending (case-insensitive).
- **Volume**
  - Value: `metricsJson.searchVolume`.
  - Format: `Intl.NumberFormat('en-US')`.
  - Sort: numeric.
- **Difficulty**
  - Value: `metricsJson.difficulty` (0-100 DataForSEO logarithmic score).
  - Display: badge with text `Low`, `Medium`, `High` (collapsed from Semrush-style tiers for reporting simplicity).
  - Mapping: `0-29 → Low`, `30-69 → Medium`, `70-100 → High`. Tooltip reveals raw score with timestamp.
- **CPC**
  - Value: `metricsJson.cpc` (USD).
  - Format: currency with max two decimals; `—` if null.
  - Sort: numeric.
- **Competition**
  - Value: `metricsJson.competition` (0-1 Google Ads paid competition).
  - Display: percentage (e.g., `0.34 → 34%`) with helper tooltip “Paid search competition from Google Ads”.
  - Sort: numeric.

## Toolbar
- Summary line: `{active} / {total} keywords active` (always rendered; `active` defaults to 0).
- Primary action: `Add Keyword` button → opens modal (existing mutation hook to add manual keyword).
- Remove legacy search input + refresh button; rely on column sorting + future filters.

## Row Actions
- Active toggle column is sortable (included rows sort ahead when descending).
- Active toggle (first action cell):
  - If `include=false` → ghost icon button (`Plus`), tooltip “Include keyword”.
  - If `include=true` → ghost icon button with `X` tinted red (no red fill), tooltip “Remove keyword”.
  - Calls `PATCH /api/keywords/:id { include }` and optimistic updates locally.
- Overflow menu (ellipsis) right aligned:
  - Menu items: `Delete keyword` (destructive).
  - Confirm dialog required before DELETE.

## Table Framework
- Use `@src/common/ui/data-table` wrapper with TanStack Table v8.
- Enable multi-sort across all columns; default state sorts by Keyword asc.
- Provide empty state copy: “No keywords yet — use Add Keyword to seed the list.”
- Loading state: skeleton rows (6) with shimmer.

## Accessibility
- Icon buttons include `aria-label` describing action.
- Overflow menu focusable via keyboard; confirm dialog returns focus to trigger.

## Metrics Refresh
- Subtitle clamps project name; remove `refetch` button but keep background polling (45s).
- When mock mode active, disable mutations and show inline note “Mock data is read-only”.
