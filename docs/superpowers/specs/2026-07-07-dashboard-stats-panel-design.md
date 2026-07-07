# Dashboard STATS Panel — Design

**Date:** 2026-07-07
**Status:** Approved, ready for planning

## Why

The NEOGOV assignment lists two **required** dashboard visualizations:

> "This dashboard must include charts visualizing **their activity volume over time**
> and **a breakdown of their preferred sports**."

Today, both data series are computed by the backend and shipped to the frontend, but
**neither is rendered on the dashboard**:

- `DashboardDto.SportBreakdown` (points per sport) — present in the frontend model
  (`dashboard.model.ts`) but consumed by **no** component. Dead on the frontend.
- `DashboardDto.PointsOverTime` (points per active day) — used only to compute a single
  `weeklyPoints` stat number on the dashboard; the full time series is rendered as a
  points heatmap on the **profile** page (`/profile/:userId`), not on the dashboard.

So the dashboard, which the spec explicitly names as the home for these charts, has
neither. This closes that gap using data that already flows — **no backend change**.

## Scope

- Purely frontend: render two already-shipped series as charts on the dashboard.
- No backend changes. No new DTO fields. The sacred assignment API contracts
  (`POST /api/users`, `POST /api/activities`) are untouched.
- No changes to the profile heatmap (it keeps the long-range view).

## Architecture

A new standalone child component, `dashboard/stats-panel/stats-panel.component.ts`,
following the existing dashboard-child pattern (`today-steps-card`, `rival-card`,
`weight-card`, `contribution-heatmap`). This keeps `dashboard.component.ts` (already
~799 lines) from growing.

The dashboard drops it into the **left column, after the Combat Log** section:

```html
<app-stats-panel
  [sportBreakdown]="data.sportBreakdown"
  [pointsOverTime]="data.pointsOverTime">
</app-stats-panel>
```

**Inputs:**

- `@Input() sportBreakdown: { sport: string; points: number }[]`
- `@Input() pointsOverTime: { date: string; points: number }[]`

Charts render via `BaseChartDirective` from `ng2-charts` (already globally provided in
`app.config.ts` via `provideCharts(withDefaultRegisterables())`; `weight-card` is the
working reference for the directive usage).

## Chart 1 — Sport mix (doughnut)

Satisfies "a breakdown of their preferred sports."

- Data: `sportBreakdown`, **filtered** to points > 0, **sorted** descending by points.
- Colors: from the existing `SPORT_COLORS` constant, keyed by sport.
- Labels: human-readable sport names (title-case; `daily_steps` → "Daily Steps").
- Legend: each sport + its point total.
- Empty when the filtered list is empty (see Empty State).

## Chart 2 — Activity volume over time (bar)

Satisfies "activity volume over time."

- Metric: **points per day** (the app's normalized unit — coherent with Chart 1 and
  needs no backend change).
- Window: **last 14 days**, ending today.
- Densify: `pointsOverTime` is sparse (only active days). Build a continuous 14-day
  array, zero-filling days with no activity, so the x-axis reads as a real timeline
  rather than jumping between active days.
- x labels: short date (e.g. "Jul 3"); y: points.

The profile heatmap continues to serve the long-range view; this is the dashboard's own
readable 2-week zoom.

## Layout & styling

- Two-up on wide screens using the existing `.sv-row` (1fr/1fr grid); stack on mobile
  per the existing `@media (max-width: 520px)` pattern.
- HUD chrome to match neighbors: Chakra Petch section header with a `sec-bar` accent and
  the same card treatment as surrounding dashboard sections.

## Empty state

When **both** series are empty (new user, no activity), render a single "No activity yet"
message instead of two empty chart frames. If only one series has data, render that chart
and hide the empty one.

## Testing

Two pure helpers carry the only non-trivial logic; unit-test them (following the existing
frontend test setup from the CI-tests commit):

1. **Densify/zero-fill** — given a sparse `pointsOverTime` and a reference "today",
   produces a 14-entry continuous array with correct dates and zero-filled gaps.
2. **Breakdown prep** — filters zero-point sports and sorts descending.

Plus a component smoke render for the empty and populated cases.

## Out of scope / guardrails

- No activity-count metric (points chosen; count is derivable later from `data.activities`
  if desired).
- No backend/DTO changes.
- No profile-page changes.
