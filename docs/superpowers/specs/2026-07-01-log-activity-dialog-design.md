# Log Activity Dialog — Design Spec
**Date:** 2026-07-01
**Project:** Sport4You (NEOGOV Take-Home)
**Feature:** Allow users to log a physical activity from any page via a dialog

---

## Overview

Add a "Log Activity" entry point to the app shell and dashboard so users can record activities without leaving their current context. A Material Dialog hosts a sport-card picker followed by an adaptive metric input.

---

## Section 1: Entry Points

### Navbar button
- A "Log Activity" text button added to the right side of the top navbar in `AppComponent`.
- Visible on every page.
- Opens `LogActivityDialogComponent` via `MatDialog`.

### Dashboard FAB
- A floating action button (FAB) fixed to the bottom-right corner of the dashboard page.
- Shows a `+` icon (`mat-fab`).
- Opens the same `LogActivityDialogComponent`.
- Only present on `/dashboard` — not a global element.

---

## Section 2: LogActivityDialogComponent

**File:** `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`

### Sport card grid
- 6 cards arranged in a **3 × 2 grid** using CSS Grid.
- Each card shows: sport emoji + sport name (capitalized, underscores replaced with spaces).
- Sport order: Running, Walking, Cycling, Swimming, Gym, Daily Steps.
- Tapping a card selects it: card gets a colored border using the sport's color from `SPORT_COLORS` (same map already defined in `DashboardComponent`; move to a shared constant file).
- Only one sport selected at a time; tapping another deselects the previous.

### Metric input
- Rendered **below the card grid**, only after a sport is selected.
- Adapts to the selected sport:

| Sport | Label | Input type | Placeholder |
|-------|-------|------------|-------------|
| Running | Distance (km) | `number` (step=0.1, min=0.1) | `5.0` |
| Walking | Distance (km) | `number` (step=0.1, min=0.1) | `3.0` |
| Cycling | Distance (km) | `number` (step=0.1, min=0.1) | `20.0` |
| Swimming | Duration | `text` | `30:00` |
| Gym | Duration | `text` | `45:00` |
| Daily Steps | Steps | `number` (step=1, min=1) | `8000` |

- Duration fields validate against the regex `/^\d+:\d{2}$/` before submission.

### Submit button
- Labeled "Log Activity".
- Disabled until: a sport is selected AND the metric field has a valid value.
- Shows a `mat-spinner` (diameter 20) inside the button while the API call is in flight.

### Success flow
1. Dialog closes.
2. Snackbar: `"✓ +{N} pts earned!"` (duration 3000ms).
3. If the user is currently on `/dashboard`, the dashboard reloads its data.

### Error flow
- API error displays as a red `<p>` inside the dialog below the submit button.
- Dialog stays open so the user can correct input and retry.
- Error message cleared when the user changes sport or metric.

---

## Section 3: Shared Constants

Move `SPORT_COLORS` and `SPORT_ICONS` out of `DashboardComponent` into a new shared file:

**File:** `frontend/src/app/shared/constants/sport.constants.ts`

```ts
export const SPORT_COLORS: Record<string, string> = {
  running: '#ef5350',
  walking: '#42a5f5',
  cycling: '#66bb6a',
  swimming: '#26c6da',
  gym: '#ab47bc',
  daily_steps: '#ffa726',
};

export const SPORT_ICONS: Record<string, string> = {
  running: '🏃',
  walking: '🚶',
  cycling: '🚴',
  swimming: '🏊',
  gym: '🏋️',
  daily_steps: '👟',
};

export const SPORTS = [
  'running', 'walking', 'cycling', 'swimming', 'gym', 'daily_steps',
] as const;
```

`DashboardComponent` imports from here instead of defining inline.

---

## Section 4: API Contract

`POST /api/activities` — already implemented. Request body:

```json
// Distance sports
{ "userId": "guid", "datetime": "<ISO-8601-now>", "sport": "running", "distance": 5.0 }

// Duration sports
{ "userId": "guid", "datetime": "<ISO-8601-now>", "sport": "gym", "duration": "45:00" }

// Steps (no sport field)
{ "userId": "guid", "datetime": "<ISO-8601-now>", "steps": 8000 }
```

`datetime` is always `new Date().toISOString()` (no date picker — always "now").

`userId` read from `localStorage.getItem('userId')`.

---

## Section 5: Dashboard Refresh

`DashboardComponent` exposes a public `loadData()` method (refactored from the current inline `ngOnInit` body).

After a successful activity log, the dialog result carries `{ points: number }`. The dashboard listens via `MatDialog.afterClosed()` and calls `loadData()` if the result is defined.

---

## Section 6: Files Touched

| File | Change |
|------|--------|
| `frontend/src/app/shared/constants/sport.constants.ts` | **Create** — shared SPORT_COLORS, SPORT_ICONS, SPORTS |
| `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` | **Create** — dialog component |
| `frontend/src/app/app.component.ts` | **Modify** — add navbar "Log Activity" button + MatDialog injection |
| `frontend/src/app/dashboard/dashboard.component.ts` | **Modify** — add FAB, expose `loadData()`, handle dialog result, import from shared constants |

---

## Section 7: Out of Scope

- Date picker (datetime always = now)
- Editing or deleting existing activities
- Backend changes (API already supports all sport/metric combos)
- Unit tests for the Angular component (per original project decision)
