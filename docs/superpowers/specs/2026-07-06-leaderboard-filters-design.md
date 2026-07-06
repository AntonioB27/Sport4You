# Leaderboard Time Period & Sport Filters Design

## Problem

The leaderboard (`GET /api/leaderboard`) always ranks users by all-time total points
across all six sports. There's no way to see "who's winning this week," "who's the top
cyclist," or any narrower slice — the leaderboard only ever answers one question.

## Goal

Let users filter the `/leaderboard` page by time period (7 days / 30 days / all-time)
and by sport (one sport, or all sports), re-ranking users by points earned within that
scope. Default (no filters) behaves exactly as today — this is additive, not a
behavior change to the existing view.

## Current State (for context)

- `LeaderboardService.GetLeaderboardAsync()` loads every user and every activity, sums
  each user's `Points` with no date or sport filter, and ranks by that total.
- `RankTrend` compares the current all-time rank against an all-time rank computed
  from activities older than 7 days (i.e., "how did the last week's activity move your
  all-time rank").
- Every registered user appears on the list, even with 0 points.
- `LeaderboardEntryDto` (Rank, UserId, FirstName, LastName, TotalPoints, RankTrend,
  ActiveAvatarImagePath, ActiveBorderCss, PrestigeLevel) is unaffected by this feature
  — its shape doesn't change, only how `TotalPoints`/`RankTrend`/list membership are
  computed.
- 4 existing backend tests (`LeaderboardControllerTests.cs`) call `GET /api/leaderboard`
  with no query params and assert today's default (all-time, all-sport, every user
  included) behavior — these must keep passing unchanged.
- The dashboard also shows a small leaderboard snippet (`dashboard.component.ts`,
  `getLeaderboard()` call) — out of scope, see Non-Goals.

## Design

### Backend — query parameters on the existing endpoint

`GET /api/leaderboard?period={7d|30d|all}&sport={all|running|walking|cycling|swimming|gym|daily_steps}`

Both parameters are optional. Omitting either defaults it to `all` — so a request with
no query string is byte-for-byte identical to today's behavior (this is what keeps the
4 existing tests passing unchanged). An unrecognized `period` or `sport` value returns
`400 Bad Request` with an error message, matching the validation style used elsewhere
in this codebase (e.g. `ActivityService.ValidateSportMetrics`).

**Filtering.** When `sport` is not `all`, only activities where `Sport == sport`
(case-insensitive, matching the lowercase convention used throughout the activity
pipeline) count toward a user's points. When `period` is `7d` or `30d`, only activities
within that rolling window (`now - 7 days` / `now - 30 days` through `now`) count.
`period=all` applies no date filter — exactly like today.

**Zero-point exclusion.** On the default view (`period=all&sport=all`, or no query
string), every user still appears, including those with 0 points — unchanged from
today. When *either* parameter is non-default, users with 0 points in that filtered
scope are excluded from the returned list entirely (not shown at the bottom, not
included at all) — a "Cycling, last 7 days" view with 35 of 40 users at "0 pts" isn't
a useful leaderboard.

**Rank trend.** This needs different logic per period, and the existing `period=all`
logic is left completely untouched:

- `period=all`: unchanged — current total vs. a total computed from activities older
  than 7 days (today's exact logic, now also scoped by the sport filter if one is
  active).
- `period=7d`: compare the current 7-day window's rank against the rank computed from
  the *immediately preceding* 7-day window (`now-14d` through `now-7d`) — a standard
  period-over-period comparison, scoped by the sport filter if one is active.
- `period=30d`: same pattern, comparing `now-30d..now` against `now-60d..now-30d`.

A user who has no activity in the *previous* comparison window (so no prior rank to
compare against) gets `RankTrend = 0` — same convention `LeaderboardService` already
uses today when a user has no prior-period data.

### Frontend — filter row on `/leaderboard` only

Two rows of pill buttons, matching the app's existing chip/pill visual language
(already used elsewhere on this page and across the redesigned dashboard/shop):

- **Time period pills:** `THIS WEEK` (7d) · `THIS MONTH` (30d) · `ALL-TIME` (default,
  selected on page load).
- **Sport pills:** `ALL SPORTS` (default, selected on page load) · one pill per sport
  using the existing `SPORT_ICON_NAMES`/`SPORT_COLORS` constants for icon + accent
  color consistency with the rest of the app (Running, Walking, Cycling, Swimming,
  Gym, Daily Steps).

Selecting a pill in either row re-fetches `GET /api/leaderboard` with the two current
filter values and re-renders the list (podium + ranked table) from the response —
no client-side re-aggregation, the backend does all the work per the Goal section.
Only one pill per row can be active at a time (radio-button behavior, not multi-select
— matches the earlier decision that this is single-sport-or-all, not a combinable
multi-select).

The dashboard's leaderboard snippet is untouched — it keeps calling
`GET /api/leaderboard` with no query params, which (per the Backend section above)
returns exactly what it returns today.

## Non-Goals

- No changes to the dashboard's leaderboard snippet — filters are `/leaderboard`-page
  only (explicit decision during design discussion).
- No custom date-range picker — only the three fixed rolling windows.
- No multi-select sport combining (e.g. "Running + Cycling together") — one sport or
  all sports.
- No changes to `LeaderboardEntryDto`'s shape, `ActiveAvatarImagePath`/
  `ActiveBorderCss`/`PrestigeLevel` computation, or the podium/table rendering
  structure beyond adding the two filter-pill rows above it.

## Testing

Backend (xUnit, real-DB integration tests via `WebApplicationFactory`, matching this
codebase's existing test style — no mocks):
- No-query-string request still returns every registered user, all-time totals,
  unchanged from today (guards the 4 existing tests, which are not being modified).
- `sport=running` with a mix of running/cycling activities: only running points count
  toward each user's total, and a user with only cycling activity in the seeded data
  is excluded from the response.
- `period=7d` with one activity inside the window and one activity 10 days old for the
  same user: only the recent activity's points count.
- `period=7d` rank-trend: a user who gains rank between the `now-14d..now-7d` window
  and the `now-7d..now` window shows a positive `RankTrend`; the equivalent for
  `period=30d` with `now-60d..now-30d` vs. `now-30d..now`.
- Invalid `period`/`sport` values return `400 Bad Request`.

Frontend: manual verification only (no new business logic beyond an HTTP call with
query params and re-rendering the existing list/podium from a new response) —
switching each pill combination on `/leaderboard` and confirming the list updates,
and confirming the dashboard snippet is visually unaffected.
