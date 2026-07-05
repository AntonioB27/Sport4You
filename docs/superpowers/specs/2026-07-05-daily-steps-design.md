# Daily Steps as a Separate, Accumulating Feature

**Date:** 2026-07-05
**Status:** Approved design

## Problem

`daily_steps` is currently modeled as just another `Sport` value on the `Activity`
table. It is entered through the same "Log Activity" dialog as running, gym, etc.,
and each submission creates a new `Activity` row. This is wrong for two reasons:

1. **Semantic mismatch.** An activity implies a discrete workout session. Steps are
   a cumulative daily total, not a session.
2. **No daily aggregation.** A user can log steps many times in one day, each
   creating a separate row and stacking points independently. There is no concept
   of "today's step count."

## Goal

Treat daily steps as a distinct feature with a dedicated dashboard widget, where a
user reports steps for the current day and those steps **accumulate into a single
per-day total** (log 5,000 this morning, add 3,000 later → 8,000 for the day).

## Chosen Approach

Keep `daily_steps` as an `Activity` row, but enforce **one accumulating row per user
per calendar day**. Every downstream consumer — leaderboard, dashboard line/donut
charts, achievements, streaks — already derives everything by reading and summing
the `Activity` table (there is no denormalized total anywhere). Keeping steps as an
`Activity` therefore leaves all of those consumers untouched.

A separate `DailySteps` table was rejected: it would force the leaderboard,
dashboard, achievements, and streak logic to each merge a second data source, adding
code and risk for a distinction the data model does not need (YAGNI).

## Scoring (unchanged formulas)

- **Points:** `floor(totalSteps / 100)`
- **XP:** `floor(totalSteps / 500)`

Both are computed from the day's running total, not per-submission, so floor
rounding stays exact across multiple entries.

## Backend

### New endpoint

`POST /api/users/{userId}/steps`

Request body:

```json
{ "steps": 3000 }
```

Response:

```json
{
  "todayTotalSteps": 8000,
  "pointsEarned": 30,
  "xpEarned": 6,
  "newAchievements": [],
  "newAvatars": [],
  "completedMissions": []
}
```

`pointsEarned` / `xpEarned` are the **delta** earned by *this* submission, so the
widget can show what the entry earned and trigger the correct splash animations.

### `ActivityService.LogDailyStepsAsync`

1. Parse and validate `userId`; return 404 if the user does not exist.
2. Validate `steps`: must be an integer, `> 0`, and `<= 100_000` (single-entry
   sanity cap to blunt fat-finger and gaming). Reject otherwise with 400.
3. Determine "today" as a **UTC calendar day**. This matches how daily missions
   (`dateTime.ToUniversalTime()`) and the leaderboard (`DateTime.UtcNow`) already
   define day boundaries. Deliberate simplification: a user in a non-UTC timezone
   sees UTC day boundaries. Acceptable for this app's scope and consistent with
   existing behavior.
4. Find the user's existing `daily_steps` `Activity` whose `DateTime` falls on
   today (UTC).
   - **Exists:** `oldTotal = row.Steps`; `newTotal = oldTotal + steps`. Set
     `row.Steps = newTotal`, `row.Points = floor(newTotal / 100)`,
     `row.DateTime = DateTime.UtcNow`. Update.
   - **None:** `oldTotal = 0`; `newTotal = steps`. Create a new `daily_steps`
     `Activity` with `Steps = newTotal`, `Points = floor(newTotal / 100)`,
     `DateTime = DateTime.UtcNow`, `Distance = null`, `Duration = null`.
5. Compute deltas:
   - `pointsEarned = floor(newTotal / 100) - floor(oldTotal / 100)`
   - `xpEarned = floor(newTotal / 500) - floor(oldTotal / 500)`
6. Run the same post-log gamification pipeline the activity path already uses:
   - Award XP for the **delta** (`xpEarned`).
   - Evaluate daily missions for today.
   - Evaluate achievements and avatars (they aggregate `Activity.Steps` across all
     rows, so accumulation is naturally reflected).
   - Streak loot box: award only if `newStreak > prevStreak`. Because a same-day
     second entry does not change the streak (today already counted), no duplicate
     box is awarded.
7. Return the response payload above.

### `POST /api/activities` rejects `daily_steps`

Now that steps have a dedicated endpoint, the generic activity endpoint rejects any
request resolving to `daily_steps` with a 400. This guarantees a single entry path
and removes ambiguity.

### Dashboard

Add `TodaySteps` (int) to `DashboardDto`, populated from the user's `daily_steps`
`Activity` for the current UTC day (0 if none). The widget renders the day's total
directly instead of recomputing it client-side.

## Frontend

### `TodayStepsCard` component (new, on the dashboard)

- Displays **today's total steps** (from `DashboardDto.todaySteps`).
- Progress ring toward a **10,000-step daily goal**.
- Shows **points earned from steps today**.
- Input field + "Add steps" button → `POST /api/users/{userId}/steps`.
- On success: refresh dashboard data and fire the existing unlock / level-up /
  mission splash animations from the returned payload.

### Log Activity dialog

- Remove `daily_steps` from the `SPORTS` constant and the dialog's sport picker.
- Keep the `SPORT_COLORS` and `SPORT_ICON_NAMES` entries for `daily_steps` — they
  are still used to render historical step rows in the charts and activity feed.

## Edge Cases

- `steps <= 0` or non-integer → 400.
- Single entry `> 100_000` → 400.
- Second entry on the same UTC day accumulates into the existing row; it does not
  create a new row and does not re-award a streak loot box.
- Deltas cross floor boundaries correctly (e.g. 50 steps then 60 steps → 0 points
  then 1 point; total 110 → `floor(110/100) = 1`).
- Existing seed data is unchanged (historical step rows are already one per day).

## Testing

- First steps entry of the day creates exactly one `daily_steps` `Activity`.
- Second entry the same day accumulates into the **same** row (row count unchanged,
  `Steps` and `Points` updated).
- Points and XP deltas are correct across floor boundaries.
- `POST /api/activities` rejects `daily_steps` with 400.
- `steps <= 0` and `steps > 100_000` rejected with 400.
- Non-existent user → 404.
- `DashboardDto.TodaySteps` reflects the correct current-day total.
```
