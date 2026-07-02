# Avatar Collection — Design Spec (Phase 3)

**Date:** 2026-07-02
**Project:** NEOGOV Take-Home Assignment — Sport4You
**Stack:** C# / ASP.NET Core · Angular · SQLite · Entity Framework Core

---

## Overview

Phase 3 introduces a 20-avatar collection system. Each avatar is a variant of Sporty (the mascot). Avatars unlock through diverse conditions — XP level, specific achievements, streak milestones, and total activities logged. Unlocks are evaluated eagerly after every activity log and surface via the existing overlay queue in `LogActivityDialog`. Users equip one avatar as their active avatar, which appears on the dashboard hero section. A dedicated `/avatars` page shows the full collection.

This is Phase 3 of the rewards system:
- Phase 1 (complete): XP engine + daily missions
- Phase 2 (complete): Achievement system
- **Phase 3 (this spec):** Avatar collection + unlock logic
- Phase 4: Leaderboard avatars + profile screen

---

## Section 1: Data Model

### `Avatar` (seeded, read-only at runtime)

| Column | Type | Constraints |
|--------|------|-------------|
| Id | GUID | PK |
| Name | TEXT | Display name |
| Description | TEXT | Unlock hint shown on locked cards |
| UnlockType | TEXT | See table below |
| UnlockValue | REAL | Numeric threshold (0 for `default`) |
| UnlockAchievementId | GUID? | Nullable — FK → Achievements, only set when `UnlockType = achievement_earned` |
| ImagePath | TEXT | e.g. `assets/avatars/starter-sporty.png` |

**UnlockType values:**

| Value | Meaning |
|-------|---------|
| `default` | Always available; awarded at registration |
| `level_reached` | User's XP level ≥ UnlockValue |
| `achievement_earned` | User has earned the achievement at UnlockAchievementId |
| `streak_days` | Current consecutive-day streak ≥ UnlockValue |
| `activities_logged` | Total activities logged ≥ UnlockValue |

### `UserAvatar` (one row per unlock, permanent)

| Column | Type | Constraints |
|--------|------|-------------|
| UserId | GUID | FK → Users, composite PK |
| AvatarId | GUID | FK → Avatars, composite PK |
| UnlockedAt | DATETIME | UTC |

Composite PK on `(UserId, AvatarId)` — each avatar unlocked at most once per user.

### `User` (modified)

Add one column:

| Column | Type | Constraints |
|--------|------|-------------|
| ActiveAvatarId | GUID? | Nullable FK → Avatars |

The default avatar is auto-unlocked and auto-equipped at user registration time (`UserService.RegisterAsync`).

**EF Core config notes:**
- `UserAvatar` uses `HasKey(u => new { u.UserId, u.AvatarId })`
- `User.ActiveAvatarId` is a nullable FK; no cascade delete
- `Avatar` seeded in `DataSeeder.SeedAvatars()` with guard `if (db.Avatars.Any()) return`
- Delete `sport4you.db` after schema changes — `EnsureCreated` does not migrate existing DBs

---

## Section 2: Avatar Catalogue (20 total)

### Default (1)

| # | Name | UnlockType | Condition |
|---|------|-----------|-----------|
| 1 | Starter Sporty | `default` | Always unlocked (given at registration) |

### XP Level (4)

| # | Name | UnlockType | UnlockValue |
|---|------|-----------|-------------|
| 2 | Energized Sporty | `level_reached` | 2 |
| 3 | Athletic Sporty | `level_reached` | 4 |
| 4 | Elite Sporty | `level_reached` | 7 |
| 5 | Legend Sporty | `level_reached` | 10 |

### Achievement Earned (10)

| # | Name | UnlockType | Achievement Required |
|---|------|-----------|---------------------|
| 6 | First Blood Sporty | `achievement_earned` | First Blood |
| 7 | Marathon Sporty | `achievement_earned` | Marathon Legend |
| 8 | Tour Sporty | `achievement_earned` | Tour Crusher |
| 9 | Aqua Sporty | `achievement_earned` | Open Water |
| 10 | Iron Sporty | `achievement_earned` | Iron Legend |
| 11 | Steps Legend Sporty | `achievement_earned` | Steps Legend |
| 12 | Champion Sporty | `achievement_earned` | Champion |
| 13 | All-Rounder Sporty | `achievement_earned` | All-Rounder |
| 14 | Centurion Sporty | `achievement_earned` | Centurion |
| 15 | Triple Crown Sporty | `achievement_earned` | Triple Crown |

### Streak Days (2)

| # | Name | UnlockType | UnlockValue |
|---|------|-----------|-------------|
| 16 | Habit Sporty | `streak_days` | 14 |
| 17 | Iron Habit Sporty | `streak_days` | 30 |

### Activities Logged (3)

| # | Name | UnlockType | UnlockValue |
|---|------|-----------|-------------|
| 18 | Active Sporty | `activities_logged` | 10 |
| 19 | Committed Sporty | `activities_logged` | 50 |
| 20 | Veteran Sporty | `activities_logged` | 100 |

---

## Section 3: Backend Architecture

### New Files

- `backend/Sport4You.Api/Models/Avatar.cs`
- `backend/Sport4You.Api/Models/UserAvatar.cs`
- `backend/Sport4You.Api/DTOs/AvatarDtos.cs`
- `backend/Sport4You.Api/Services/IAvatarService.cs`
- `backend/Sport4You.Api/Services/AvatarService.cs`
- `backend/Sport4You.Api/Controllers/AvatarsController.cs`

### Modified Files

- `AppDbContext.cs` — add `DbSet<Avatar>`, `DbSet<UserAvatar>`, composite PK config, `User.ActiveAvatarId` FK
- `DataSeeder.cs` — add `SeedAvatars(db)` with 20 rows and guard
- `Models/User.cs` — add `ActiveAvatarId Guid?` and nav property
- `Services/UserService.cs` — after creating user, unlock default avatar row in `UserAvatars` and set `ActiveAvatarId`
- `Services/IActivityService.cs` — extend `ActivityResult` with `List<UnlockedAvatarDto> AvatarsUnlocked`
- `Services/ActivityService.cs` — call `EvaluateAvatarsAsync(userId)` after `EvaluateAchievementsAsync`; thread result through `ActivityResult.Success`
- `Controllers/ActivitiesController.cs` — include `avatarsUnlocked` in `POST /api/activities` response
- `DTOs/DashboardDto.cs` — add `AvatarStatusDto? ActiveAvatar`
- `Services/DashboardService.cs` — fetch `User.ActiveAvatarId`, include in dashboard response
- `Program.cs` — register `IAvatarService`

### DTOs

```csharp
// AvatarDtos.cs
namespace Sport4You.Api.DTOs;

public record UnlockedAvatarDto(Guid Id, string Name, string Description, string ImagePath);

public record AvatarStatusDto(
    Guid Id, string Name, string Description, string ImagePath,
    string UnlockType, string UnlockHint,
    bool Unlocked, DateTime? UnlockedAt, bool IsActive);

public record SetActiveAvatarRequest(Guid AvatarId);
```

### Service Interface

```csharp
public interface IAvatarService
{
    Task<List<UnlockedAvatarDto>> EvaluateAvatarsAsync(Guid userId);
    Task<List<AvatarStatusDto>> GetUserAvatarsAsync(Guid userId);
    Task<bool> SetActiveAvatarAsync(Guid userId, Guid avatarId);
}
```

### Evaluation Logic (`EvaluateAvatarsAsync`)

Single-pass approach — mirrors `AchievementService.EvaluateAchievementsAsync`:

1. Load all avatars the user has NOT yet unlocked (exclude `UserAvatar` rows)
2. Compute aggregates from DB in one pass:
   - Current XP level (from `UserXp.TotalXp` → `XpService.GetLevelInfo`)
   - Current streak (consecutive days — same logic as dashboard)
   - Total activities count (`Activities.Count(a => a.UserId == userId)`)
   - Set of earned achievement IDs (`UserAchievements.Where(ua => ua.UserId == userId).Select(ua => ua.AchievementId)`)
3. For each unearned avatar, evaluate its `UnlockType` against aggregates:
   - `default` → always met (handles registration race conditions)
   - `level_reached` → currentLevel >= UnlockValue
   - `achievement_earned` → earnedAchievementIds.Contains(UnlockAchievementId)
   - `streak_days` → currentStreak >= UnlockValue
   - `activities_logged` → totalActivities >= UnlockValue
4. Batch-insert all newly earned `UserAvatar` rows in one `SaveChangesAsync`
5. Return `List<UnlockedAvatarDto>` for the newly unlocked avatars

`EvaluateAvatarsAsync` is called after `EvaluateAchievementsAsync` in `ActivityService.LogActivityAsync`. No XP is awarded for avatar unlocks.

### New Endpoints

**`GET /api/users/{userId}/avatars`** → `List<AvatarStatusDto>`

Returns all 20 avatars with `unlocked`, `unlockedAt`, and `isActive` per user.

**`PUT /api/users/{userId}/avatar`** `{ "avatarId": "guid" }`

Sets `User.ActiveAvatarId`. Returns 404 if the avatar is not yet unlocked by that user. Returns 200 with the updated `AvatarStatusDto` on success.

### Activity Response Addition

```json
{
  "activityId": "guid",
  "points": 500,
  "xpEarned": 120,
  "missionsCompleted": [],
  "achievementsUnlocked": [],
  "avatarsUnlocked": [
    { "id": "guid", "name": "Active Sporty", "description": "Log 10 activities", "imagePath": "assets/avatars/active-sporty.png" }
  ]
}
```

### Dashboard Response Addition

```json
"activeAvatar": {
  "id": "guid",
  "name": "Starter Sporty",
  "imagePath": "assets/avatars/starter-sporty.png",
  "unlocked": true,
  "unlockedAt": "2026-07-02T...",
  "isActive": true
}
```

---

## Section 4: Frontend Architecture

### New Files

- `frontend/src/app/avatars/avatars.component.ts` — standalone component

### Modified Files

- `frontend/src/app/shared/models/dashboard.model.ts` — add `UnlockedAvatar`, `AvatarStatus` interfaces; extend `LogActivityResponse` with `avatarsUnlocked: UnlockedAvatar[]`; add `activeAvatar: AvatarStatus | null` to `DashboardData`
- `frontend/src/app/shared/services/api.service.ts` — add `getAvatars(userId)` and `setActiveAvatar(userId, avatarId)`
- `frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts` — avatar unlocks appended to overlay queue after achievement cards, with "AVATAR UNLOCKED" header and avatar image displayed large
- `frontend/src/app/dashboard/dashboard.component.ts` — show active avatar image + name in hero section
- `frontend/src/app/app.routes.ts` — add lazy `/avatars` route
- `frontend/src/app/app.component.ts` — add "AVATARS" nav link

### Frontend Models

```typescript
export interface UnlockedAvatar {
  id: string;
  name: string;
  description: string;
  imagePath: string;
}

export interface AvatarStatus extends UnlockedAvatar {
  unlockType: string;
  unlockHint: string;
  unlocked: boolean;
  unlockedAt: string | null;
  isActive: boolean;
}

// LogActivityResponse gains:
avatarsUnlocked: UnlockedAvatar[];

// DashboardData gains:
activeAvatar: AvatarStatus | null;
```

### `/avatars` Page

Grid of all 20 avatar cards:
- **Unlocked:** full colour, avatar image, name, unlock date, "EQUIP" button (disabled + "ACTIVE" label if already equipped)
- **Locked:** desaturated (opacity + grayscale CSS), name visible, description as unlock hint
- Active avatar has a distinct coloured border ring (brand blue `#2E6BE6`)
- Equipping calls `PUT /api/users/{userId}/avatar`; updates local state optimistically

### Overlay Queue Flow (after logging an activity)

1. Mission toasts fire (snackbar, non-blocking) — existing
2. Achievement overlay cards shown one by one — existing
3. Avatar overlay cards shown one by one — new; same overlay component, "AVATAR UNLOCKED" heading, avatar image displayed at 120×120px

---

## Section 5: Image Assets

Avatar images live at `frontend/src/assets/avatars/`. Naming: `{slugified-name}.png` (no tier prefix — avatars have no tier).

| File | Avatar |
|------|--------|
| `starter-sporty.png` | Starter Sporty |
| `energized-sporty.png` | Energized Sporty |
| `athletic-sporty.png` | Athletic Sporty |
| `elite-sporty.png` | Elite Sporty |
| `legend-sporty.png` | Legend Sporty |
| `first-blood-sporty.png` | First Blood Sporty |
| `marathon-sporty.png` | Marathon Sporty |
| `tour-sporty.png` | Tour Sporty |
| `aqua-sporty.png` | Aqua Sporty |
| `iron-sporty.png` | Iron Sporty |
| `steps-legend-sporty.png` | Steps Legend Sporty |
| `champion-sporty.png` | Champion Sporty |
| `all-rounder-sporty.png` | All-Rounder Sporty |
| `centurion-sporty.png` | Centurion Sporty |
| `triple-crown-sporty.png` | Triple Crown Sporty |
| `habit-sporty.png` | Habit Sporty |
| `iron-habit-sporty.png` | Iron Habit Sporty |
| `active-sporty.png` | Active Sporty |
| `committed-sporty.png` | Committed Sporty |
| `veteran-sporty.png` | Veteran Sporty |

### AI Image Generation Prompts

**Style brief (include in every prompt):**
> Sporty is a cute, friendly blue water bottle character with a rounded cap head, big expressive eyes, short stubby arms and legs, and a clean blue body. Render in 3D Pixar animation style — smooth soft lighting, vibrant colours, slight subsurface scattering on the plastic body, white background, square 1:1 aspect ratio. No text. No props outside the description.

---

**1. Starter Sporty** (`starter-sporty.png`)
> Sporty standing in a relaxed, friendly neutral pose, arms slightly open in a welcoming gesture. Clean bright blue body, subtle smile, soft white background. This is the default avatar — approachable and cheerful, no special equipment.

**2. Energized Sporty** (`energized-sporty.png`)
> Sporty wearing a bright yellow sweatband around their cap, fists pumped in the air with excitement, body slightly leaning forward with energy. Electric sparks or motion lines around them suggesting a burst of energy. Vibrant, playful.

**3. Athletic Sporty** (`athletic-sporty.png`)
> Sporty wearing a sleek white athletic tank top draped over their body, a small silver medal hanging from a ribbon around their neck. Confident upright stance, slight flex of the arms. Clean and sporty aesthetic.

**4. Elite Sporty** (`elite-sporty.png`)
> Sporty with a subtle metallic silver sheen on their body, wearing a sleek dark navy athletic jacket with a small collar. Composed, professional pose with arms crossed. Cool lighting, premium feel.

**5. Legend Sporty** (`legend-sporty.png`)
> Sporty radiating a golden glow, body gleaming with a warm gold shimmer, surrounded by a soft aura of golden light particles. Heroic pose — one arm raised to the sky. Epic lighting, sense of achievement and power.

**6. First Blood Sporty** (`first-blood-sporty.png`)
> Sporty looking fresh and determined, wearing a brand-new pair of tiny white sneakers on their feet, laces tied. Holding a small starter flag in one hand. Bright, enthusiastic expression — this is their very first day.

**7. Marathon Sporty** (`marathon-sporty.png`)
> Sporty in full marathon runner mode — wearing a racing bib numbered "1" on their chest, a red finisher medal around their neck, and tiny running shoes. Mid-stride pose, motion blur on the legs, triumphant expression.

**8. Tour Sporty** (`tour-sporty.png`)
> Sporty wearing a bright yellow cycling jersey and a sleek aerodynamic cycling helmet. Leaning forward in a cycling tuck pose as if riding at speed. Wind-swept effect. Sunglasses resting on the helmet.

**9. Aqua Sporty** (`aqua-sporty.png`)
> Sporty wearing blue swimming goggles pushed up on their cap and a swim cap. Body has a slight aqua-teal tint and wet-look sheen. Water droplets on the surface. Relaxed confident post-swim pose.

**10. Iron Sporty** (`iron-sporty.png`)
> Sporty in a gym setting aesthetic — wearing tiny weightlifting gloves on their hands, flexing both arms to show off tiny but defined muscles. A small dumbbell sits at their feet. Dark charcoal and red accent colours.

**11. Steps Legend Sporty** (`steps-legend-sporty.png`)
> Sporty with enormously oversized colourful sneakers dominating the composition, body glowing with a soft pulse of energy at each foot. A tiny odometer counter badge on their chest showing a large step count. Walking mid-stride, proud expression.

**12. Champion Sporty** (`champion-sporty.png`)
> Sporty standing on a gold podium marked "#1", holding a large gleaming trophy above their head with both arms. Confetti raining down around them in brand colours (blue, yellow, white). Golden light from below.

**13. All-Rounder Sporty** (`all-rounder-sporty.png`)
> Sporty surrounded by six tiny floating sport icons (running shoe, bicycle, swimming goggles, dumbbell, walking boot, step counter), each orbiting around them like a halo. Body has a rainbow shimmer effect. Joyful, arms wide open.

**14. Centurion Sporty** (`centurion-sporty.png`)
> Sporty wearing a miniature Roman centurion helmet (red plume on top) and a tiny breastplate armour piece over their body. Holding a small laurel wreath in one hand. Stoic but proud expression. Classic sandstone and gold colour palette.

**15. Triple Crown Sporty** (`triple-crown-sporty.png`)
> Sporty wearing three small stacked crowns on their cap head — one bronze, one silver, one gold — in a precarious but triumphant tower. Both arms raised in celebration. Royal purple and gold accents.

**16. Habit Sporty** (`habit-sporty.png`)
> Sporty holding a small calendar with 14 consecutive days marked with checkmarks, expression focused and consistent. Wearing a simple green fitness band on one wrist. Calm, disciplined energy — no flashy effects, just steady confidence.

**17. Iron Habit Sporty** (`iron-habit-sporty.png`)
> Sporty with a body texture that appears forged from brushed iron/steel, surface gleaming like polished metal. Wearing a 30-day streak badge pinned to their chest. Unbreakable pose — feet firmly planted, arms at sides, unwavering expression.

**18. Active Sporty** (`active-sporty.png`)
> Sporty in a dynamic jumping pose, legs kicked out to the sides, arms raised, big smile. Bright and energetic colours, motion lines around the body. This is someone just getting started and loving it.

**19. Committed Sporty** (`committed-sporty.png`)
> Sporty wearing a determined expression, brow slightly furrowed in focus, fists clenched at their sides. A sweat drop on their forehead. Wearing a training wristband. Muted but strong colour palette — deep blue and grey tones.

**20. Veteran Sporty** (`veteran-sporty.png`)
> Sporty with a battle-worn but proud look — a small worn patch badge on their chest reading "100", a few tiny scuff marks on their body (still clean, just experienced). Standing tall with quiet confidence. Warm sepia-tinged lighting, sense of hard-earned wisdom.

---

## Section 6: Testing

### Unit Tests (`AvatarServiceTests.cs`)

- `EvaluateAvatarsAsync` — default avatar always unlocks (for a brand-new user with no activities)
- Idempotency — calling evaluate twice does not create duplicate `UserAvatar` rows
- `level_reached` — unlocks at exact threshold, not below
- `achievement_earned` — unlocks when specific achievement ID present in earned set
- `streak_days` — unlocks at exact threshold
- `activities_logged` — unlocks at exact threshold
- `SetActiveAvatarAsync` — returns false when avatar is not unlocked by user
- `SetActiveAvatarAsync` — updates `User.ActiveAvatarId` when avatar is unlocked

### Integration Tests

- `POST /api/users` response includes default avatar equipped on new user
- `POST /api/activities` response includes `avatarsUnlocked` array (may be empty)
- `GET /api/users/{userId}/avatars` returns all 20 avatars; unlocked ones have `unlockedAt` set and `isActive` for the equipped one
- `PUT /api/users/{userId}/avatar` with locked avatar returns 404
- Dashboard response includes `activeAvatar`

---

## What Is Not In Phase 3

- Avatar display on the leaderboard (Phase 4)
- User profile screen (Phase 4)
- Animated avatar effects or idle animations
- Avatar trading or gifting
