# Seed 30 Users with 3-Month Histories — Design

**Date:** 2026-07-07
**Status:** Approved, ready for planning

## Why

The current `DataSeeder.SeedUsers` hand-lists ~40 activities for 5 users across the
last 14 days as literal tuples. That produces a thin leaderboard and near-empty
dashboards/profiles. We want a populated, realistic demo: **30 users, each with a
heavy activity history spanning the last ~3 months, and full game-layer state** (XP,
levels, achievements, avatars, borders) so the leaderboard, the new public profiles
(radar + heatmap), and the dashboard charts all look alive.

## Decisions (locked)

- **Depth:** full game-layer — replay activities through the real reward services.
- **Sport mix:** uniform random across all 6 sports per activity.
- **Volume:** heavy, ~6–7 activities/week → **~55–90 activities per user** over the window.
- **Reproducibility:** random each reseed (no fixed RNG seed).
- **Users:** 30 brand-new users; the existing 5 (Maria, James, Sophie, Luca, Amara) are removed.
- **Span:** activities spread across the last **~90 days, up to today** (recent days included).
- **Equipped look:** each user's equipped avatar and border set to their best earned items.

## Architecture

Two phases, because rank-based achievements (Top 10 / Podium / Champion) and cross-user
convergence require all users to exist before rewards can be finalized.

### Phase 1 — Populate

For each of the 30 users:
1. Create the `User` row.
2. Synthesize `N` activities (`N` random in ~55–90) with datetimes spread across the last
   ~90 days up to now, each a uniformly-random sport with a realistic metric value:
   - running/walking/cycling → distance in km (per-sport range, e.g. running 3–15,
     walking 2–8, cycling 8–40)
   - swimming/gym → duration `mm:ss` (e.g. swimming 15–60 min, gym 30–90 min)
   - daily_steps → steps (e.g. 4,000–18,000)
3. Points computed via `IScoringService.CalculatePoints` at write time (production parity).
4. Award XP per activity via `IXpService.AwardActivityXpAsync` (authentic XP-transaction
   trail and level curve).

Missions, loot-box grants, and streak-boxes are **skipped** — they are "today"-anchored
and meaningless for backfilled history.

### Phase 2 — Settle rewards

After all 30 users and their activities exist, run a **convergence loop** across all users:
repeatedly call `IAchievementService.EvaluateAchievementsAsync` and
`IAvatarService.EvaluateAvatarsAsync` for every user until a full pass yields no new
unlocks. This lets these resolve correctly:
- cumulative threshold achievements (distance/duration/steps totals),
- streak achievements (heavy near-daily volume yields long streaks),
- level-based cascades (achievement XP can push a user into a new level, unlocking further
  level_reached achievements/avatars),
- rank-based achievements (evaluated against the final 30-user leaderboard).

### Phase 3 — Equip best items

For each user, set the equipped avatar to their highest-tier unlocked avatar and equip a
border they have earned, so leaderboard/profile show real cosmetics rather than defaults.
(Exact equip mechanism — field on `User`/`UserAvatar.IsEquipped`, `UserBorder` — to be
confirmed against the models during planning and matched to how the app equips them.)

## Wiring

`Program.cs` already creates a DI scope for seeding. Resolve `IXpService`,
`IAchievementService`, and `IAvatarService` there and pass them into `DataSeeder.Seed(...)`
alongside the existing `db` and `IScoringService`. The seed-guard switches from the old 5
names to the new 30. The generator lives in focused new methods, replacing the tuple block;
the other seed methods (missions, achievements, avatars, borders, loot-box, shop) are
untouched.

## Data flow

`Program.cs` (DI scope) → `DataSeeder.Seed(db, scoring, xp, achievements, avatars)` →
Phase 1 (create users + activities + activity XP) → Phase 2 (convergence eval of
achievements + avatars across all users) → Phase 3 (equip best avatar + border) →
`SaveChanges`.

## Testing

Unit-test the pure generator helpers:
- activity count falls in the intended range,
- generated datetimes fall within the last 90 days and are ≤ now,
- every generated (sport, metric) pair is valid so `ScoringService.CalculatePoints`
  never throws (no swimming-with-distance, etc.).

Reward replay is integration-covered by the existing Xp/Achievement/Avatar service tests;
a smoke test can assert that after seeding, at least one user has level > 1 and ≥ 1
unlocked achievement.

## Testing performance & configurability (refinement)

`TestFactory` boots the whole app via `WebApplicationFactory<Program>`, so the seeder runs
on every test-factory instantiation (16 test classes). To keep the suite fast and avoid
destabilizing the existing rank-trend test (which assumes seeded activity sits within the
last ~14 days), seed volume is **read from `IConfiguration`**:

- `Seeding:UserCount` (default **30**)
- `Seeding:ActivitiesPerUserMin` / `Seeding:ActivitiesPerUserMax` (default **55 / 90**)
- `Seeding:HistoryDays` (default **90**)

`Program.cs` reads these (production defaults) and passes a `SeedOptions` into the seeder.
`TestFactory` overrides them to a light seed (**5 users, 6–12 activities, 14-day window**)
so tests stay fast and keep today's data shape.

Phase-1 XP is computed via the pure `IXpService.CalculateActivityXp` and **bulk-inserted**
(`UserXp` + `XpTransaction` rows, batched `SaveChanges`) rather than per-activity
`AwardActivityXpAsync`. This is faster and avoids the incidental level-up loot-box grants
that `AwardActivityXpAsync` triggers (we skip loot boxes anyway).

## Cost & ops

- The heavy 30-user seed runs only in the real app on an empty DB; batched inserts keep it
  to well under a few seconds.
- Reseeding requires deleting `sport4you.db` (seeder only runs on empty tables).
- The `feature/auth` worktree keeps its own DB; this change is on `main` only.

## Out of scope

- No fixed RNG seed (random each reseed by choice).
- No missions/loot-box/streak-box backfill.
- No changes to the assignment's API contracts or any endpoint.
