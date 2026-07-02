# Achievement System — Design Spec (Phase 2)

**Date:** 2026-07-02
**Project:** NEOGOV Take-Home Assignment — Sport4You
**Stack:** C# / ASP.NET Core · Angular · SQLite · Entity Framework Core

---

## Overview

Phase 2 introduces a 34-achievement system spanning sport milestones, streaks, XP journey, leaderboard feats, and one-time feats. Achievements have three tiers (Bronze / Silver / Gold) and award XP on unlock. Unlocks are detected eagerly on every activity log and surfaced immediately via a full-screen overlay queue. A compact widget on the dashboard shows recent unlocks; a dedicated `/achievements` page shows the full grid.

This is Phase 2 of the rewards system:
- Phase 1 (complete): XP engine + daily missions
- **Phase 2 (this spec):** Achievement system
- Phase 3: Avatar collection + unlock logic
- Phase 4: Leaderboard avatars + profile screen

---

## Section 1: Data Model

### `Achievement` (seeded, read-only at runtime)

| Column | Type | Constraints |
|--------|------|-------------|
| Id | GUID | PK |
| Tier | TEXT | `"bronze"` / `"silver"` / `"gold"` |
| Name | TEXT | Display name |
| Description | TEXT | Human-readable requirement |
| RequirementType | TEXT | See table below |
| RequirementValue | REAL | Threshold to meet or exceed |
| Sport | TEXT? | Nullable — set only for sport-specific achievements |
| XpReward | INT | 50 (Bronze) / 150 (Silver) / 300 (Gold) |

**RequirementType values:**

| Value | Meaning |
|-------|---------|
| `total_km` | Cumulative km logged for `Sport` |
| `total_minutes` | Cumulative minutes logged for `Sport` |
| `total_steps` | Cumulative steps logged (all time) |
| `streak_days` | Current consecutive-day streak |
| `level_reached` | XP level attained |
| `leaderboard_rank` | Current leaderboard rank ≤ RequirementValue |
| `first_activity` | At least 1 activity logged (RequirementValue = 1) |
| `first_mission` | At least 1 daily mission completed (RequirementValue = 1) |
| `first_sweep` | At least 1 daily sweep completed (RequirementValue = 1) |
| `all_sports` | All 6 sport types logged at least once (RequirementValue = 6) |
| `points_in_day` | Max points earned in any single calendar day (all time) ≥ RequirementValue |

### `UserAchievement` (one row per unlock, permanent)

| Column | Type | Constraints |
|--------|------|-------------|
| UserId | GUID | FK → Users |
| AchievementId | GUID | FK → Achievements |
| UnlockedAt | DATETIME | UTC |

Composite PK on `(UserId, AchievementId)` — each achievement unlocked at most once per user.

**EF Core config notes:**
- `UserAchievement` uses `HasKey(u => new { u.UserId, u.AchievementId })`
- Unique index on `(UserId, AchievementId)` (redundant with PK but explicit)
- `Achievement` seeded in `DataSeeder.SeedAchievements()` with guard `if (db.Achievements.Any()) return`

---

## Section 2: Achievement Catalogue (34 total)

### Sport Distance Milestones (9)

| Name | Tier | Sport | RequirementType | Value | XP |
|------|------|-------|-----------------|-------|----|
| First Strides | Bronze | running | total_km | 10 | 50 |
| Road Warrior | Silver | running | total_km | 50 | 150 |
| Marathon Legend | Gold | running | total_km | 200 | 300 |
| Weekend Walker | Bronze | walking | total_km | 20 | 50 |
| Trail Blazer | Silver | walking | total_km | 100 | 150 |
| Pathfinder | Gold | walking | total_km | 500 | 300 |
| Casual Rider | Bronze | cycling | total_km | 30 | 50 |
| Chain Breaker | Silver | cycling | total_km | 150 | 150 |
| Tour Crusher | Gold | cycling | total_km | 500 | 300 |

### Sport Duration Milestones (6)

| Name | Tier | Sport | RequirementType | Value | XP |
|------|------|-------|-----------------|-------|----|
| Pool Diver | Bronze | swimming | total_minutes | 60 | 50 |
| Lap Master | Silver | swimming | total_minutes | 300 | 150 |
| Open Water | Gold | swimming | total_minutes | 1000 | 300 |
| Iron Starter | Bronze | gym | total_minutes | 120 | 50 |
| Pump Master | Silver | gym | total_minutes | 600 | 150 |
| Iron Legend | Gold | gym | total_minutes | 2000 | 300 |

### Steps Milestones (3)

| Name | Tier | RequirementType | Value | XP |
|------|------|-----------------|-------|----|
| First March | Bronze | total_steps | 50000 | 50 |
| Step Hunter | Silver | total_steps | 250000 | 150 |
| Steps Legend | Gold | total_steps | 1000000 | 300 |

### Streak Achievements (3)

| Name | Tier | RequirementType | Value | XP |
|------|------|-----------------|-------|----|
| On a Roll | Bronze | streak_days | 3 | 50 |
| Week Warrior | Silver | streak_days | 7 | 150 |
| Iron Habit | Gold | streak_days | 30 | 300 |

### XP Journey (3)

| Name | Tier | RequirementType | Value | XP |
|------|------|-----------------|-------|----|
| Leveling Up | Bronze | level_reached | 3 | 50 |
| Getting Serious | Silver | level_reached | 6 | 150 |
| Immortal | Gold | level_reached | 10 | 300 |

### Leaderboard Feats (3)

| Name | Tier | RequirementType | Value | XP |
|------|------|-----------------|-------|----|
| Top 10 | Bronze | leaderboard_rank | 10 | 50 |
| Podium | Silver | leaderboard_rank | 3 | 150 |
| Champion | Gold | leaderboard_rank | 1 | 300 |

> **Note:** Leaderboard rank is checked at the moment of activity logging. Once unlocked the achievement is permanent — it won't be revoked if the user's rank later drops. New achievements can be added at any time by adding rows to `DataSeeder.SeedAchievements()` — no other code changes required.

### One-Time Feats (6)

| Name | Tier | RequirementType | Value | XP |
|------|------|-----------------|-------|----|
| First Blood | Bronze | first_activity | 1 | 50 |
| Mission Possible | Bronze | first_mission | 1 | 50 |
| Triple Crown | Silver | first_sweep | 1 | 150 |
| All-Rounder | Silver | all_sports | 6 | 150 |
| Century | Bronze | points_in_day | 1000 | 50 |
| Centurion | Gold | points_in_day | 10000 | 300 |

---

## Section 3: Backend Architecture

### New Files

- `backend/Sport4You.Api/Models/Achievement.cs`
- `backend/Sport4You.Api/Models/UserAchievement.cs`
- `backend/Sport4You.Api/Services/IAchievementService.cs`
- `backend/Sport4You.Api/Services/AchievementService.cs`
- `backend/Sport4You.Api/Controllers/AchievementsController.cs`

### Modified Files

- `AppDbContext.cs` — add `DbSet<Achievement>`, `DbSet<UserAchievement>`, configure composite PK
- `DataSeeder.cs` — add `SeedAchievements()` method
- `ActivityService.cs` — call `EvaluateAchievementsAsync` after missions, include result in `ActivityResult`
- `IActivityService.cs` — extend `ActivityResult` with `List<UnlockedAchievementDto> AchievementsUnlocked`
- `ActivitiesController.cs` — include `achievementsUnlocked` in response body
- `DashboardDto.cs` — add `List<AchievementStatusDto> RecentAchievements`
- `DashboardService.cs` — fetch 3 most recent unlocks for dashboard widget
- `Program.cs` — register `IAchievementService`

### Service Interface

```csharp
public record UnlockedAchievementDto(Guid Id, string Tier, string Name, string Description, int XpReward);
public record AchievementStatusDto(Guid Id, string Tier, string Name, string Description,
    int XpReward, bool Unlocked, DateTime? UnlockedAt);

public interface IAchievementService
{
    Task<List<UnlockedAchievementDto>> EvaluateAchievementsAsync(Guid userId);
    Task<List<AchievementStatusDto>> GetUserAchievementsAsync(Guid userId);
}
```

### Evaluation Logic (`EvaluateAchievementsAsync`)

Single-pass approach — one aggregate query, all checks in memory:

1. Load all achievements the user has NOT yet unlocked
2. Compute aggregates from the DB in one pass:
   - Total km per sport (running, walking, cycling)
   - Total minutes per sport (swimming, gym)
   - Total steps
   - Current streak (consecutive days — already computed in dashboard, reuse logic)
   - Current XP level (from `UserXp.TotalXp` → `XpService.GetLevelInfo`)
   - Current leaderboard rank (rank of this user by total points)
   - Count of distinct sports logged
   - Max points earned in a single calendar day
   - Whether any mission completion exists (`UserMissionCompletion`)
   - Whether any sweep XP transaction exists (`XpTransactions` where `Source == "mission_sweep"`)
3. For each unearned achievement, check if aggregate meets `RequirementValue`
4. For newly earned achievements: insert `UserAchievement` row + call `XpService.AwardGenericXpAsync(userId, xpReward, "achievement", achievementId)` — this requires a new method on `IXpService`: `Task<int> AwardGenericXpAsync(Guid userId, int xp, string source, Guid sourceId)` that updates `UserXp` and inserts an `XpTransaction` row (same logic as the tail of `AwardActivityXpAsync`, extracted into a shared helper)
5. Return list of `UnlockedAchievementDto` for newly unlocked achievements

`EvaluateAchievementsAsync` is called after `EvaluateDailyMissionsAsync` in `ActivityService.LogActivityAsync`.

### Activity Response

```csharp
public record ActivityResult(
    bool IsError, bool IsNotFound, string? Error,
    Guid ActivityId, int Points, int XpEarned,
    List<CompletedMissionDto> MissionsCompleted,
    List<UnlockedAchievementDto> AchievementsUnlocked);
```

`POST /api/activities` response:
```json
{
  "activityId": "guid",
  "points": 500,
  "xpEarned": 120,
  "missionsCompleted": [{ "description": "...", "xpEarned": 75 }],
  "achievementsUnlocked": [
    { "id": "guid", "tier": "bronze", "name": "First Blood", "description": "Log your first activity", "xpReward": 50 }
  ]
}
```

### New Endpoint

`GET /api/users/{userId}/achievements` → `List<AchievementStatusDto>`

Returns all 34 achievements with `unlocked` and `unlockedAt` per user. Locked achievements return `unlocked: false, unlockedAt: null`.

### Dashboard Endpoint Addition

`GET /api/users/{userId}/dashboard` response gains:
```json
"recentAchievements": [
  { "id": "...", "tier": "bronze", "name": "First Blood", "description": "Log your first activity", "xpReward": 50, "unlocked": true, "unlockedAt": "2026-07-02T..." }
]
```
Maximum 3 entries, ordered by `UnlockedAt` descending. Empty array if none unlocked.

---

## Section 4: Frontend Architecture

### New Files

- `frontend/src/app/achievements/achievements.component.ts`

### Modified Files

- `frontend/src/app/shared/models/dashboard.model.ts` — add `UnlockedAchievement`, `AchievementStatus` interfaces; extend `LogActivityResponse` and `DashboardData`
- `frontend/src/app/shared/services/api.service.ts` — add `getAchievements(userId)`
- `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` — achievement overlay queue
- `frontend/src/app/dashboard/dashboard.component.ts` — recent achievements widget
- `frontend/src/app/app.component.ts` — add "BADGES" nav link to `/achievements`
- `frontend/src/app/app.routes.ts` — register `/achievements` route

### Achievement Unlock Overlay

Lives inside `LogActivityDialogComponent`. After `logActivity()` resolves:

1. If `res.achievementsUnlocked.length > 0`, push them into a local `achievementQueue: UnlockedAchievement[]`
2. Show achievement overlay immediately after the activity confirmation (on top of it, z-index higher)
3. Overlay content:
   - Tier badge pill with tier color (bronze `#CD7F32` / silver `#C0C0C0` / gold `#FFD700`)
   - "ACHIEVEMENT UNLOCKED" label
   - Achievement name (large, Chakra Petch font)
   - Description text
   - `+XP` reward in brand yellow-green
   - Button: "NEXT →" if more achievements queued, "DONE 🎉" if last
4. Each tap shifts the queue; when empty, overlay hides and activity confirmation is visible again

Mission toasts (`MatSnackBar`) still fire for mission completions — they appear alongside the overlay since toasts are non-blocking.

### Dashboard Widget

New "Recent Achievements" section below Daily Missions. Uses `data.recentAchievements` from the dashboard response:

- Up to 3 compact rows: tier color strip on left, name + description, relative unlock date ("2 days ago")
- If `recentAchievements.length === 0`: placeholder text "No achievements yet — keep going!"
- "See all →" link navigating to `/achievements`

### `/achievements` Page

New standalone component. Calls `GET /api/users/{userId}/achievements` on load.

Layout:
- Page header: "ACHIEVEMENTS" + stats pill showing `X / 34 unlocked`
- Achievements grouped by category: Sport Milestones · Duration Milestones · Steps · Streaks · XP Journey · Leaderboard Feats · One-Time Feats
- Each achievement card:
  - **Unlocked:** tier color background, name, description, unlock date, XP rewarded
  - **Locked:** desaturated / dark card, lock icon, name visible, description visible (no spoiler)
- Within each group, Bronze → Silver → Gold order

### Frontend Models

```typescript
export interface UnlockedAchievement {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  name: string;
  description: string;
  xpReward: number;
}

export interface AchievementStatus extends UnlockedAchievement {
  unlocked: boolean;
  unlockedAt: string | null;
}

// LogActivityResponse gains:
achievementsUnlocked: UnlockedAchievement[];

// DashboardData gains:
recentAchievements: AchievementStatus[];
```

---

## Section 5: Testing

### Unit Tests (`XpServiceTests.cs` / new `AchievementServiceTests.cs`)

- `EvaluateAchievementsAsync` with mocked aggregates: verify correct achievements unlock at threshold boundaries
- Idempotency: calling evaluate twice does not double-award
- All 11 requirement types covered by at least one test case

### Integration Tests

- `POST /api/activities` response includes `achievementsUnlocked` array (may be empty)
- First activity log unlocks "First Blood"
- `GET /api/users/{userId}/achievements` returns all 34 achievements; unlocked ones have `unlockedAt` set
- Dashboard response includes `recentAchievements`

---

## What Is Not In Phase 2

- Avatar unlocks tied to achievements (Phase 3)
- Push notifications for achievement unlocks
- Achievement sharing or social feed
- Retroactive unlock on existing users (achievements only evaluated going forward from when the feature ships — a fresh DB is required since `EnsureCreated` doesn't migrate)
