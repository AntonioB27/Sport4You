# Activity Contribution Heatmap

**Date:** 2026-07-05
**Status:** Approved
**Scope:** Frontend-only. No backend changes, no new endpoints.

## Problem

The profile page shows achievements, avatars, and stats, but nothing shows
the shape of a user's activity over time at a glance — the kind of "streaks
of effort" visualization that makes GitHub's contribution graph compelling.
The assignment explicitly calls out bonus points for "other fun and creative
visualizations."

## Design

### Data source (no backend work)

`GET /api/users/{userId}/dashboard` already returns
`pointsOverTime: { date: string; points: number }[]` — one entry per day
the user has ever logged any activity, for **any** `userId` (own or public
profile). This is already fetched by `profile.component.ts` on every profile
view. The heatmap consumes this array directly; no new field, no new call.

### Component

New standalone `ContributionHeatmapComponent`
(`frontend/src/app/profile/contribution-heatmap/contribution-heatmap.component.ts`):

- `@Input() pointsOverTime: { date: string; points: number }[] = []`
- Purely presentational — computes the grid client-side from the input array.

**Grid construction:** trailing 365 days ending today, laid out GitHub-style
as 53 week-columns × 7 day-rows (Sun–Sat). Each day looks up its points from
a `Map<dateString, points>` built from the input (missing days = 0).

**Intensity buckets** (5 levels, based on that day's total points):
| Level | Points | Color |
|---|---|---|
| 0 | 0 | `#EAEEF6` (empty, matches existing neutral card backgrounds) |
| 1 | 1–149 | `#EAF7C9` |
| 2 | 150–349 | `#C6E63B` |
| 3 | 350–699 | `#9ECF10` |
| 4 | 700+ | `#7c9c00` |

These bands are a rough heuristic (a 5 km walk ≈ 250 pts, a 45-min gym
session ≈ 225 pts, a marathon ≈ 4,219 pts) — not a precise formula, easy to
retune later.

**Chrome:** month labels along the top (first column of each new month),
a legend row underneath ("Less" → 5 swatches → "More"), a hover tooltip per
cell showing `"{Mon D} · {N} pts"` (or "No activity" for 0). The grid
container gets `overflow-x: auto` so it degrades gracefully on narrow
viewports instead of breaking layout.

**Visual language:** matches the existing profile `.section` card styling
(white card, `#E3EAF5` border, `Chakra Petch` section title). Colors reuse
the app's lime palette already used for XP bars and quest progress, not
GitHub's green — keeps it on-brand.

### Placement

`profile.component.ts`, Overview tab: a new "ACTIVITY" section card, placed
right after the hero card and before the existing "ACHIEVEMENTS" section.
Shown unconditionally (both own and public profiles) — the data is already
public via the existing dashboard call.

## Out of scope

- Streak-day highlighting inside the grid cells (streaks already have their
  own UI elsewhere in the app).
- Per-sport color coding of cells.
- Click-to-drill-down into a specific day's activities.
- Any change to the assignment's `POST /api/users` / `POST /api/activities`
  contracts (not applicable here — this feature touches neither).

## Testing

No backend tests needed (no backend changes). Frontend: Playwright —
load a profile with activity history spread across multiple months, verify
the grid renders with the expected number of columns, at least one non-zero
intensity cell, the legend, and that hovering a cell shows a tooltip with a
date and point value.
