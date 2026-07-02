# XP Engine & Daily Missions — Design Spec (Phase 1)

## Overview

Phase 1 introduces a dedicated XP progression system and rotating daily missions. XP is a separate currency from activity points — points determine leaderboard rank, XP drives personal progression (levels, and in future phases: achievements and avatars).

This is Phase 1 of a 4-phase rewards system:
- **Phase 1 (this spec):** XP engine + daily missions
- Phase 2: Achievement system (Bronze/Silver/Gold tiers)
- Phase 3: Avatar collection + unlock logic
- Phase 4: Leaderboard avatars + profile screen

---

## XP Earning — Activities

When a user logs an activity, XP is calculated server-side and awarded immediately in the same request. XP scales with effort using sport-specific multipliers distinct from the points formula.

| Sport | XP formula |
|-------|-----------|
| Running | `floor(km × 20)` |
| Walking | `floor(km × 10)` |
| Cycling | `floor(km × 5)` |
| Swimming | `floor(minutes × 3)` |
| Gym | `floor(minutes × 2)` |
| Daily Steps | `floor(steps / 500)` |

**Examples:** 5 km run = 100 XP · 45 min gym = 90 XP · 10,000 steps = 20 XP

---

## Level System

XP-based levels replace the current points-derived level calculation. 10 levels with an exponential gap curve — fast early progression hooks new users, the upper levels represent genuine long-term dedication.

| Level | Title | XP required | Gap |
|-------|-------|-------------|-----|
| 1 | ROOKIE | 0 | — |
| 2 | JOGGER | 200 | 200 (~2 sessions) |
| 3 | RUNNER | 600 | 400 (~4 sessions) |
| 4 | ATHLETE | 1,400 | 800 (~8 sessions) |
| 5 | COMPETITOR | 3,000 | 1,600 (~16 sessions) |
| 6 | ELITE | 6,000 | 3,000 (~30 sessions) |
| 7 | CHAMPION | 11,000 | 5,000 (~50 sessions) |
| 8 | MASTER | 20,000 | 9,000 (~90 sessions) |
| 9 | LEGEND | 35,000 | 15,000 (~150 sessions) |
| 10 | IMMORTAL | 60,000 | 25,000 (~250 sessions) |

The `XpService` exposes a pure `GetLevelInfo(totalXp)` helper that returns `{ level, title, xpInLevel, xpForNextLevel, xpPercent }` for any XP value. Used by both the dashboard endpoint and future achievement/avatar unlock checks.

---

## Daily Missions

Each user receives 3 missions per day: **1 Easy + 1 Medium + 1 Hard**. Missions are selected using a deterministic seed of `userId + date (YYYY-MM-DD)` so they are consistent throughout the day but rotate daily. Different users get different missions.

### XP Rewards

| Tier | XP reward |
|------|-----------|
| Easy | +75 XP |
| Medium | +150 XP |
| Hard | +300 XP |
| **Daily sweep bonus** (all 3 completed) | **+100 XP** |

Maximum XP from missions per day: **625 XP**

### Mission Pool (30 missions)

**Easy (10)**
1. Log any activity today
2. Walk at least 2 km
3. Log 15 minutes of any exercise
4. Hit 3,000 steps
5. Log a gym session (any duration)
6. Go for any cycle ride
7. Do any swimming today
8. Log 2 activities today
9. Run at least 1 km
10. Be active for 20 minutes total today

**Medium (10)**
1. Run at least 3 km
2. Hit 5,000 steps
3. Cycle at least 10 km
4. Swim for 20+ minutes
5. Spend 30+ minutes at the gym
6. Walk 5 km
7. Log activities in 2 different sports
8. Run for 20+ minutes
9. Cycle 15 km
10. Complete 45 minutes of exercise total today

**Hard (10)**
1. Run 10 km or more
2. Cycle 25 km or more
3. Hit 10,000 steps
4. Swim for 45+ minutes
5. Spend 60+ minutes at the gym
6. Walk 10 km
7. Log 3 activities across 3 different sports
8. Run 7 km or more
9. Complete 90+ minutes of exercise total
10. Complete 120+ minutes of exercise total today

### Mission Requirement Types

Each mission in the `DailyMission` table has a `RequirementType` that the evaluation engine checks against the user's activity log for today:

| RequirementType | Evaluated as |
|----------------|-------------|
| `activity_count` | Count of activities logged today (optionally filtered by `Sport`) |
| `distance_km` | Sum of `Distance` for activities today (optionally filtered by `Sport`) |
| `duration_min` | Sum of duration in minutes for activities today (optionally filtered by `Sport`) |
| `steps` | Sum of `Steps` for daily_steps activities today |
| `total_min` | Sum of all activity durations in minutes today (all sports) |
| `sport_count` | Count of distinct sports logged today |

`Sport` column is nullable — null means the requirement applies across all sports.

### Completion Logic

Mission evaluation is triggered automatically inside `POST /api/activities`, after the activity is saved. The server:

1. Looks up today's 3 missions for this user
2. Aggregates today's activity totals (distance, duration, steps, sport count)
3. Evaluates each incomplete mission against the totals
4. For each newly completed mission: writes a `UserMissionCompletion` row, creates an `XpTransaction`, updates `UserXp`
5. If all 3 are now complete and the sweep bonus hasn't been awarded today: awards +100 XP sweep bonus
6. Returns `missionsCompleted: [{ description, xpEarned }]` in the response

---

## Backend Architecture

### New Database Tables

**`UserXp`** — live XP balance per user (1 row per user)
```
UserId       GUID  PK / FK → Users
TotalXp      INT   NOT NULL DEFAULT 0
UpdatedAt    DATETIME
```

**`XpTransaction`** — append-only log of every XP award
```
Id           GUID  PK
UserId       GUID  FK → Users
Source       TEXT  "activity" | "mission" | "mission_sweep"
SourceId     GUID  nullable — activityId or missionId
XpEarned     INT
CreatedAt    DATETIME
```

**`DailyMission`** — static seed data, 30 rows, never modified at runtime
```
Id                GUID  PK
Tier              TEXT  "easy" | "medium" | "hard"
Description       TEXT
RequirementType   TEXT  see table above
RequirementValue  REAL  threshold to meet (km, min, steps, count)
Sport             TEXT  nullable — null = any sport
XpReward          INT   75 | 150 | 300
```

**`UserMissionCompletion`** — records completed missions per user per day
```
Id           GUID  PK
UserId       GUID  FK → Users
MissionId    GUID  FK → DailyMission
Date         TEXT  "YYYY-MM-DD"
CompletedAt  DATETIME
```

Unique constraint on `(UserId, MissionId, Date)` — prevents duplicate completions.

### New Service: `XpService`

```csharp
public interface IXpService
{
    int CalculateActivityXp(string sport, decimal? distance, string? duration, int? steps);
    Task AwardActivityXpAsync(Guid userId, Guid activityId, string sport, decimal? distance, string? duration, int? steps);
    Task<MissionEvaluationResult> EvaluateDailyMissionsAsync(Guid userId, DateOnly date);
    Task<XpSummary> GetXpSummaryAsync(Guid userId);
    LevelInfo GetLevelInfo(int totalXp);
}

public record LevelInfo(int Level, string Title, int XpInLevel, int XpForNextLevel, int XpPercent);
public record XpSummary(int TotalXp, LevelInfo LevelInfo);
public record MissionEvaluationResult(List<CompletedMissionDto> NewlyCompleted, int XpAwarded);
```

`CalculateActivityXp` is a pure method (no DB) — stateless, fully unit testable.

### API Changes

**`POST /api/activities`** — response extended:
```json
{
  "points": 1050,
  "xpEarned": 100,
  "missionsCompleted": [
    { "description": "Run at least 3 km", "xpEarned": 150 }
  ]
}
```

**`GET /api/users/{userId}/dashboard`** — response extended with two new fields:

```json
{
  "xp": {
    "total": 850,
    "level": 3,
    "levelTitle": "RUNNER",
    "xpInLevel": 250,
    "xpForNextLevel": 800,
    "xpPercent": 31
  },
  "dailyMissions": [
    {
      "id": "...",
      "tier": "easy",
      "description": "Log any activity today",
      "xpReward": 75,
      "completed": true,
      "progress": 1,
      "progressMax": 1
    },
    {
      "id": "...",
      "tier": "medium",
      "description": "Run at least 3 km",
      "xpReward": 150,
      "completed": false,
      "progress": 1.5,
      "progressMax": 3
    },
    {
      "id": "...",
      "tier": "hard",
      "description": "Cycle 25 km or more",
      "xpReward": 300,
      "completed": false,
      "progress": 0,
      "progressMax": 25
    }
  ]
}
```

No new endpoints. Both changes extend existing API contracts.

---

## Frontend Changes

### Sidebar XP Widget
- Replace hardcoded "550 XP" with live `xp.total` from dashboard response
- "NEXT LEVEL IN X XP" shows `xp.xpForNextLevel - xp.xpInLevel`
- Progress bar width binds to `xp.xpPercent`

### Dashboard Hero Card
- Level badge binds to `xp.level` and `xp.levelTitle` (currently derived from `totalPoints` — switch to XP data)
- XP bar binds to `xp.xpPercent`
- "X XP → LV N" label uses `xp.xpInLevel` and `xp.level + 1`

### Dashboard Quests Section
- Replace 3 hardcoded quests with `dailyMissions` array from API
- Each mission card: description, tier colour indicator, `+N XP` reward badge, progress bar (`progress / progressMax`), completed state
- Tier colours: Easy = green (`#C6E63B`), Medium = blue (`#2E6BE6`), Hard = orange (`#FF6A00`)

### Log Activity Confirmation Overlay
- Add `+N XP` line below the existing `+N PTS` display
- `xpEarned` comes from the activity log API response
- Style: smaller than points, neon green, Chakra Petch font

### Mission Completion Toast
- After logging an activity, if `missionsCompleted` is non-empty, show one snackbar per completed mission
- Format: `"Quest complete! {description} · +{xpEarned} XP"`
- Duration: 3500 ms, staggered 600 ms apart if multiple complete at once

---

## What Is Not In Phase 1

- No XP decay or daily caps
- No XP from social actions (following, commenting)
- No XP history screen
- No mission re-roll mechanic
- Achievements, badges, avatars, and profile screen are Phase 2–4
