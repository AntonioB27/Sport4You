# Weight Tracking — Design Spec

**Date:** 2026-07-06
**Status:** Approved (design), ready for spec review → planning
**Branch:** work on `main` (per project preference; no feature branches)

## Problem / Goal

Let a user record their body weight once a day and see a chart of their progress over time,
with an optional goal weight drawn as a target line. This is a private personal-progress tracker,
deliberately **separate from the competitive game layer** — weight is not scored, ranked, or shown
on the leaderboard (heavier ≠ worse, and body weight is sensitive).

## Constraints & Principles

- **Non-competitive / private:** no points, no XP, no achievements, no leaderboard involvement.
- **Does not touch the sacred contracts:** the `User` entity and the `POST /api/users` /
  `POST /api/activities` contracts are untouched. Weight lives in its own tables and endpoints.
- **Canonical storage in kg:** the backend is unit-agnostic and always stores/returns kilograms.
  Unit display (kg/lb) is a frontend concern.
- **Once a day:** at most one entry per user per calendar day; re-logging the same day updates that
  day's value (upsert), it does not create a second row.
- EF `EnsureCreated` is used (no migrations). Adding new tables means the dev `sport4you.db` must be
  deleted once to recreate the schema (documented project gotcha). Tests use a fresh in-memory DB
  per run, so new tables are created automatically there.

## Data Model

Two new entities, both isolated from `User` (referenced by `UserId` only):

- **`WeightEntry`**
  - `Id` (Guid, PK)
  - `UserId` (Guid)
  - `Date` (`DateOnly`) — the calendar day of the measurement
  - `WeightKg` (decimal) — canonical kilograms
  - Invariant: at most one row per `(UserId, Date)`.
- **`WeightGoal`**
  - `UserId` (Guid, PK) — one optional goal per user
  - `GoalWeightKg` (decimal) — canonical kilograms

Both added as `DbSet`s on `AppDbContext`.

## Backend API

New actions on `UsersController` (keeping the existing per-user route style
`/api/users/{userId}/…`), delegating to a new `IWeightService`:

- **`GET /api/users/{userId}/weight`** →
  `{ entries: [ { date: "yyyy-MM-dd", weightKg: number } ] (ascending by date), goalKg: number | null }`
  - Returns `404` if the user does not exist.
- **`POST /api/users/{userId}/weight`** body `{ weightKg: number }` →
  upserts today's (`DateOnly.FromDateTime(DateTime.UtcNow)`) entry; returns the saved
  `{ date, weightKg }`. `404` if user missing; `400` if `weightKg` is non-positive or absurd
  (guard: must be `> 0` and `< 1000`).
- **`PUT /api/users/{userId}/weight/goal`** body `{ goalKg: number }` →
  sets/updates the user's goal; returns `{ goalKg }`. `404` if user missing; `400` on invalid value
  (same `> 0` / `< 1000` guard).

### `IWeightService` (testable core)
- `Task<WeightHistoryDto> GetHistoryAsync(Guid userId)` — entries ascending by date + goal.
- `Task<WeightEntryDto> UpsertTodayAsync(Guid userId, decimal weightKg)` — insert or update today's row.
- `Task SetGoalAsync(Guid userId, decimal goalKg)` — insert or update the goal row.
- User-existence checks return a not-found result the controller maps to `404`.

## Frontend

A self-contained **`WeightCardComponent`** (mirroring `TodayStepsCardComponent` /
`RivalCardComponent`) placed into the dashboard grid — `dashboard.component.ts` gains only an import
and one `<app-weight-card>` tag, minimizing churn in that file. The component takes the user id and
calls `ApiService`.

Card contents:
- **Unit toggle** kg/lb — display only. Stored/sent values are always kg; when lb is selected, the
  card converts for display (`lb = kg * 2.20462`) and converts the user's lb input back to kg before
  POST.
- **Current weight** (latest entry) + a **change stat** (latest vs the earliest entry within the
  last ~30 days, e.g. "↓ 1.2 kg this month") + **"X to go"** toward the goal (when a goal is set).
- **Progress chart** — the app's first `chart.js` line chart via the already-registered
  `ng2-charts` (`provideCharts` is in `app.config.ts`). X = date, Y = weight in the selected unit.
  The **goal** is rendered as a second, flat dashed dataset at the goal value across the date range
  (no extra annotation plugin needed).
- **Today's input** — a number field (in the selected unit) + "Log today" → `POST …/weight`
  (upsert), then refresh.
- **Set-goal affordance** — a small inline control to set/update the goal → `PUT …/weight/goal`.

New `ApiService` methods: `getWeight(userId)`, `logWeight(userId, weightKg)`,
`setWeightGoal(userId, goalKg)`. New model file `weight.model.ts`
(`WeightHistory`, `WeightEntry`).

## Error Handling

- Invalid/blank input is validated client-side (positive number) and server-side
  (`> 0` and `< 1000`) → friendly message; nothing is saved.
- API failures show a retry-able message; the rest of the dashboard is unaffected (the card fails
  in isolation).
- Empty state (no entries yet): the card prompts for a first weigh-in and shows an empty chart.

## Testing

- **Backend (TDD):** `WeightService`
  - upsert same day updates the existing row (no duplicate);
  - a new day appends a second row;
  - `GetHistoryAsync` returns entries ascending by date and includes the goal (null when unset);
  - `SetGoalAsync` inserts then updates a single goal row.
  - Endpoint integration tests (`TestFactory`): POST twice same day → `GET` shows one entry with the
    latest value; `PUT` goal then `GET` returns it; unknown user → `404`; non-positive weight →
    `400`.
- **Frontend:** build passes + manual checklist (log today, unit toggle math, goal line renders,
  change/"to go" stats, empty state). Chart rendering is not meaningfully unit-tested here.

## Out of Scope (possible later increments)

- Weigh-in reminders/notifications; streaks or XP for logging consistency.
- BMI / body-fat / measurements; imperial stone units.
- Editing/deleting past entries; back-dating a weigh-in to a prior day.
- Multiple weigh-ins per day averaged.
