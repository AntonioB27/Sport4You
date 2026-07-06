# Personal Records Page — Design

Status: approved
Date: 2026-07-06

## Purpose

A "you vs. yourself" section on the owner's own profile page: per-sport bests,
the single biggest points day, and the longest streak ever achieved. Distinct
from Achievements (which are fixed badges everyone can unlock) — these are
purely personal-history stats, no unlock ceremony, no XP/points awarded for
reaching one.

## Scope

- Per-sport bests: one record per sport the user has ever logged (running,
  walking, cycling: max distance; swimming, gym: max duration; daily_steps:
  max single-day step count).
- Biggest single-day point haul: the calendar day (local, matching the
  contribution heatmap's day-grouping) with the highest summed `Points`
  across all activities logged that day.
- Longest streak ever: the longest run of consecutive calendar days with at
  least one activity logged, across the user's entire history — NOT the same
  as the dashboard's "current streak" (which only reports the active streak
  ending today/yesterday).
- Visible only when viewing your own profile (`isOwnProfile`), same
  visibility rule as the AVATARS/borders tabs and Prestige's action button.
- No visibility on other users' public profiles.

## Data & API

New DTOs in `backend/Sport4You.Api/DTOs/`:

```csharp
public record SportRecordDto(string Sport, decimal? BestDistance, string? BestDuration, int? BestSteps, DateTime AchievedAt);

public record PersonalRecordsDto(
    List<SportRecordDto> SportRecords,
    int BestDayPoints,
    DateTime? BestDayDate,
    int LongestStreakEver);
```

New endpoint: `GET /api/users/{userId}/personal-records` → returns
`PersonalRecordsDto`.

New `PersonalRecordsService` (backend/Sport4You.Api/Services/):
- Calls the existing `IActivityRepository.GetByUserIdAsync(userId)` once (no
  new repository method needed).
- Groups activities by `Sport`; for distance sports takes the max
  `Distance`, for duration sports takes the max parsed `Duration` (mm:ss →
  compare as total seconds), for `daily_steps` takes the max `Steps`. Records
  the `DateTime` of whichever activity produced that max as `AchievedAt`.
  Sports with zero logged activities are simply omitted from the list — no
  placeholder record.
- Groups activities by local calendar day (same grouping approach as
  `pointsOverTime`), sums `Points` per day, and returns the day/point-total
  of the maximum. If the user has zero activities, `BestDayPoints = 0` and
  `BestDayDate = null`.
- Calls a new `ActivityStreakHelper.ComputeLongestStreakEver(IEnumerable<DateTime>)`
  method (sibling to the existing `ComputeCurrentStreak`): same
  group-by-`DateOnly`-and-order approach, but instead of stopping at the
  first gap from today, it scans every consecutive-day run in the full
  history and returns the length of the longest one. Returns 0 for a user
  with no activities.

No schema/database changes — this is entirely computed on demand from
existing `Activity` rows.

## Frontend

- New standalone component:
  `frontend/src/app/profile/personal-records/personal-records.component.ts`.
- Embedded as a "RECORDS" `.section` card on `profile.component.ts`, gated by
  the existing `isOwnProfile` flag, placed after the ACHIEVEMENTS section.
- Layout: a card grid — one small card per sport with a logged record
  (sport icon + name + formatted best value + date achieved: "12.4 km",
  "45:30", "8,200 steps"), plus two standout cards: "Biggest Day" (points +
  date) and "Longest Streak" (days, all-time). Reuses the profile page's
  existing card/stat-tile styling (font, lime accent on the headline number)
  — no new visual language introduced.
- Empty state: if the user has zero logged activities at all, render a
  single placeholder card ("Log your first activity to start setting
  records") instead of an empty grid.
- No unlock ceremony, animation, or splash on this page — static "look back"
  view only.
- New `ApiService.getPersonalRecords(userId)` method calling the new
  endpoint; new `PersonalRecordsDto`-equivalent TypeScript interfaces in
  `frontend/src/app/shared/models/dashboard.model.ts` (or a new
  `personal-records.model.ts` if that file is getting crowded).

## Testing

- Backend unit tests for `PersonalRecordsService` and
  `ActivityStreakHelper.ComputeLongestStreakEver`:
  - Multiple sports with distinct bests.
  - A day with multiple activities summing into the biggest-day record.
  - A broken-then-resumed streak where an earlier historical streak is
    longer than the current active one (proves it's not just reusing
    `ComputeCurrentStreak`'s logic unchanged).
  - Zero activities (empty response, no exceptions).
- Live Playwright verification: register a user, log activities across
  multiple sports and days (including a multi-activity day and a streak
  longer than the current one), confirm the page renders correct values for
  each record type and the empty state.

## Out of scope

- No historical "record broken!" celebration/notification when a new record
  is set (that would be a separate future feature, not requested here).
- No public visibility on other profiles.
- No editing/deleting individual records — purely derived/read-only.
