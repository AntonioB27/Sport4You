# Loot Box — Design Spec
**Date:** 2026-07-03
**Phase:** 5

---

## Overview

A box-opening system that rewards players with exclusive cosmetics (avatars and avatar borders) earned through daily activity. Boxes are earned automatically from streak maintenance, mission completion, and leveling up. Opening a box reveals one item from a rarity-weighted pool; duplicates grant XP instead.

---

## Section 1: Reward Pool

### Avatars (loot-box exclusive)

15 avatars exist only in the loot box pool — they cannot be earned through normal play.

| Rarity | Count | Roll weight |
|--------|-------|-------------|
| Common | 5 | 60% of avatar rolls |
| Rare | 5 | 30% of avatar rolls |
| Legendary | 5 | 10% of avatar rolls |

### Borders

6 borders apply a CSS ring around the user's avatar circle everywhere it appears.

| Rarity | Count | Roll weight |
|--------|-------|-------------|
| Common | 2 | 60% of border rolls |
| Rare | 2 | 30% of border rolls |
| Legendary | 2 | 10% of border rolls |

### Combined pool

Each box roll first picks a type (avatar or border) with equal probability (50/50), then picks a rarity within that type using the weights above, then picks uniformly among items of that rarity.

### Duplicate handling

If the rolled item is already owned by the user:

| Rarity | XP awarded |
|--------|-----------|
| Common | 50 XP |
| Rare | 150 XP |
| Legendary | 400 XP |

The XP is granted via the existing `XpService.GrantXpAsync`.

---

## Section 2: Box Earning Triggers

Boxes are earned automatically — no user action required beyond normal play.

| Trigger | Boxes earned |
|---------|-------------|
| Level up | 1 box |
| Activity logged that extends the current streak | 1 box per day |
| Daily mission completed | 1 box per mission (up to 3/day) |

A streak box is granted once per calendar day when `ActivityService` detects the streak count increased. Mission boxes are granted inside `XpService` when a mission transitions to completed.

---

## Section 3: Backend Models

### `LootBox`

One row per box earned. Opened boxes reference their reward.

```csharp
public class LootBox
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string EarnReason { get; set; } = string.Empty; // "level_up" | "streak" | "mission"
    public DateTime EarnedAt { get; set; }
    public DateTime? OpenedAt { get; set; }
    public Guid? RewardId { get; set; }          // FK → LootBoxReward; null until opened
    public bool WasDuplicate { get; set; }
    public int DuplicateXpAwarded { get; set; }
}
```

### `LootBoxReward`

Seed-only catalog of all 21 earnable items. Never created at runtime.

```csharp
public class LootBoxReward
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;    // "avatar" | "border"
    public string Rarity { get; set; } = string.Empty;  // "common" | "rare" | "legendary"
    public string Name { get; set; } = string.Empty;
    public string ImagePath { get; set; } = string.Empty;
    public Guid? AvatarId { get; set; }   // FK → Avatar; set only when Type == "avatar"
    public Guid? BorderId { get; set; }   // FK → Border; set only when Type == "border"
}
```

### `Border`

Cosmetic ring applied around avatar circles.

```csharp
public class Border
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Rarity { get; set; } = string.Empty;  // "common" | "rare" | "legendary"
    public string BorderCss { get; set; } = string.Empty; // e.g. "3px solid #FFD700"
    public string ImagePath { get; set; } = string.Empty; // preview image for the reward card
}
```

### `UserBorder`

Tracks which borders a user owns and which is active.

```csharp
public class UserBorder
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid BorderId { get; set; }
    public DateTime UnlockedAt { get; set; }
    public bool IsActive { get; set; }
}
```

---

## Section 4: Backend Services & API

### `ILootBoxService` / `LootBoxService`

```csharp
public interface ILootBoxService
{
    Task EarnBoxAsync(Guid userId, string reason);
    Task<OpenBoxResultDto> OpenBoxAsync(Guid userId);
    Task<int> GetPendingCountAsync(Guid userId);
}
```

**`EarnBoxAsync`:** Creates one `LootBox` row with `EarnedAt = DateTime.UtcNow` and `OpenedAt = null`.

**`OpenBoxAsync`:**
1. Fetch the oldest unopened `LootBox` for the user (order by `EarnedAt` asc). Return error if none.
2. Pick reward type: `random.Next(2) == 0 ? "avatar" : "border"`.
3. Pick rarity: weighted random using 60/30/10 distribution.
4. Pick item: uniform random among catalog items of that type + rarity.
5. Check if user already owns the item (`UserAvatar` or `UserBorder` table).
6. If new: insert `UserAvatar` or `UserBorder` row.
7. If duplicate: call `XpService.GrantXpAsync(userId, duplicateXp, "loot_box_duplicate")`.
8. Mark the `LootBox` row as opened: set `OpenedAt`, `RewardId`, `WasDuplicate`, `DuplicateXpAwarded`.
9. Return `OpenBoxResultDto`.

**`GetPendingCountAsync`:** `COUNT` of `LootBox` rows where `UserId == userId && OpenedAt == null`.

### `OpenBoxResultDto`

```csharp
public record OpenBoxResultDto(
    string Type,           // "avatar" | "border"
    string Rarity,         // "common" | "rare" | "legendary"
    string Name,
    string ImagePath,
    bool WasDuplicate,
    int DuplicateXpAwarded,
    int RemainingBoxes
);
```

### Modifications to existing services

**`XpService`** — inject `ILootBoxService`:
- In `GrantXpAsync`: after level increases, call `await _lootBox.EarnBoxAsync(userId, "level_up")`.
- In mission completion logic: when a mission transitions to `Completed`, call `await _lootBox.EarnBoxAsync(userId, "mission")`.

**`ActivityService`** — inject `ILootBoxService`:
- After logging an activity, compute the current streak. If `currentStreak > previousStreak`, call `await _lootBox.EarnBoxAsync(userId, "streak")`.

**`LeaderboardService`** — add `ActiveBorderCss` to each entry:
- After fetching the avatar image map, also fetch active borders for all users in one query.
- Populate `ActiveBorderCss` on `LeaderboardEntryDto`.

### New API endpoints — `LootBoxController`

```
GET  /api/users/{userId}/boxes       → { pendingCount: int, recentOpened: OpenBoxResultDto[] }
POST /api/users/{userId}/boxes/open  → OpenBoxResultDto
PUT  /api/users/{userId}/border      → 204 No Content  (body: { borderId: string })
```

### DTOs updated

`LeaderboardEntryDto` gains:
```csharp
public string? ActiveBorderCss { get; set; }
```

---

## Section 5: Database Seeding

`DbSeeder` seeds:

**6 borders** (2 per rarity):
- Common 1: `"3px solid #9E9E9E"` — "Iron Ring"
- Common 2: `"3px solid #66BB6A"` — "Leaf Ring"
- Rare 1: `"3px double #2196F3"` — "Sapphire Band"
- Rare 2: `"3px solid transparent; border-image: linear-gradient(135deg,#2196F3,#9C27B0) 1"` — "Aurora Band"
- Legendary 1: `"3px solid #FFD700"` — "Gold Crown Ring"
- Legendary 2: `"3px solid transparent; border-image: linear-gradient(135deg,#FFD700,#FF6F00,#FFD700) 1"` — "Inferno Halo"

**15 loot-box-exclusive avatars** (5 per rarity), each with an `ImagePath` pointing to `assets/avatars/loot-box/` and a linked `LootBoxReward` row.

**21 `LootBoxReward` rows** linking each avatar/border to its catalog entry with the correct `Type`, `Rarity`, `AvatarId`/`BorderId`, `Name`, and `ImagePath`.

---

## Section 6: Frontend

### Dashboard (`dashboard.component.ts`)

- Hero area gains a `📦 N` chip (hidden when `pendingCount === 0`). Clicking it opens `LootBoxModalComponent` as a `MatDialog`.
- On dialog close, refresh `pendingCount` from `GET /api/users/{userId}/boxes`.

### `LootBoxModalComponent` (`loot-box/loot-box-modal.component.ts`)

State machine: `idle → opening → revealed`.

**`idle`:** Shows a box graphic (📦 emoji, 96px) and an OPEN button.

**`opening`:** Button click triggers a CSS animation (`@keyframes popOpen`: scale 1→1.3→0.9→1 over 600ms with a glow `box-shadow`). After 600ms transitions to `revealed`.

**`revealed`:** Reward card slides in (`@keyframes slideIn`: translateY(20px)→0, opacity 0→1, 300ms). Card shows:
- Item image (80px circle for avatars, ring preview for borders)
- Rarity badge (color-coded pill: grey/blue/gold)
- Item name
- If duplicate: item greyed out, "Already owned — +N XP" label in brand blue

Two action buttons:
- "OPEN ANOTHER" — resets to `idle`, visible only if `remainingBoxes > 0`
- "DONE" — closes the dialog

### Profile AVATARS tab (`profile.component.ts`)

Gains a **Borders** section below the avatar grid (lazy-loaded alongside avatars on first tab open):
- Unlocked border cards: preview ring swatch + name + rarity badge + EQUIP button (disabled + blue ring if already active).
- Locked border cards: greyed out (opacity 0.45, grayscale 0.7), no button.
- Equip calls `PUT /api/users/{userId}/border`, updates `isActive` locally on success.

`loadAvatars()` is renamed `loadAvatarsAndBorders()` and also calls `GET /api/users/{userId}/borders`.

New endpoint on `ApiService`:
```typescript
getBorders(userId: string): Observable<BorderStatus[]>
equipBorder(userId: string, borderId: string): Observable<void>
```

`BorderStatus` model:
```typescript
interface BorderStatus {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  borderCss: string;
  imagePath: string;
  unlocked: boolean;
  unlockedAt?: string;
  isActive: boolean;
}
```

### Leaderboard (`leaderboard.component.ts`)

Avatar `<img>` and `.av-initial` elements gain `[style.border]="entry.activeBorderCss ?? '2px solid rgba(255,255,255,.35)'"` — replacing the static CSS border with the user's active border, or the existing default if none.

### `leaderboard.model.ts`

```typescript
activeBorderCss?: string;
```

---

## Section 7: Error States

- `POST /api/users/{userId}/boxes/open` with no pending boxes → 400 Bad Request.
- Unknown `userId` on any loot-box endpoint → 404.
- Network error opening a box → snackbar "Failed to open box. Please try again." (4000ms); box is not consumed (the `OpenedAt` field is only written after the reward is fully resolved).
- Equip border failure → snackbar "Failed to equip border. Please try again." (4000ms).

---

## Section 8: Files Changed

| Action | File |
|--------|-------|
| Create | `backend/Sport4You.Api/Models/LootBox.cs` |
| Create | `backend/Sport4You.Api/Models/LootBoxReward.cs` |
| Create | `backend/Sport4You.Api/Models/Border.cs` |
| Create | `backend/Sport4You.Api/Models/UserBorder.cs` |
| Create | `backend/Sport4You.Api/DTOs/OpenBoxResultDto.cs` |
| Create | `backend/Sport4You.Api/Services/ILootBoxService.cs` |
| Create | `backend/Sport4You.Api/Services/LootBoxService.cs` |
| Create | `backend/Sport4You.Api/Controllers/LootBoxController.cs` |
| Create | `frontend/src/app/loot-box/loot-box-modal.component.ts` |
| Create | `frontend/src/app/shared/models/border.model.ts` |
| Modify | `backend/Sport4You.Api/Data/AppDbContext.cs` |
| Modify | `backend/Sport4You.Api/Data/DbSeeder.cs` |
| Modify | `backend/Sport4You.Api/Services/XpService.cs` |
| Modify | `backend/Sport4You.Api/Services/ActivityService.cs` |
| Modify | `backend/Sport4You.Api/Services/LeaderboardService.cs` |
| Modify | `backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs` |
| Modify | `frontend/src/app/dashboard/dashboard.component.ts` |
| Modify | `frontend/src/app/profile/profile.component.ts` |
| Modify | `frontend/src/app/leaderboard/leaderboard.component.ts` |
| Modify | `frontend/src/app/shared/models/leaderboard.model.ts` |
| Modify | `frontend/src/app/shared/services/api.service.ts` |
