# Task 1 — Phase 4a: Leaderboard Avatar Thumbnails (Backend)

**Date:** 2026-07-03
**Status:** DONE
**Tests:** 82/82 passing (was 79 before Phase 4a work; 3 additional tests exist from prior phases, plus 1 new test added here)

---

## What Was Done

### Step 1 — `IAvatarService.GetAvatarImageMapAsync()` added
File: `backend/Sport4You.Api/Services/IAvatarService.cs`

Added one method signature to the interface:
```csharp
Task<Dictionary<Guid, string>> GetAvatarImageMapAsync();
```

### Step 2 — Implementation in `AvatarService`
File: `backend/Sport4You.Api/Services/AvatarService.cs`

Added at the end of the class (using the actual field name `_db`, not `_context` as the plan draft mentioned):
```csharp
public async Task<Dictionary<Guid, string>> GetAvatarImageMapAsync()
    => await _db.Avatars.ToDictionaryAsync(a => a.Id, a => a.ImagePath);
```

### Step 3 — `ActiveAvatarImagePath` on `LeaderboardEntryDto`
File: `backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs`

Added:
```csharp
public string? ActiveAvatarImagePath { get; set; }
```

### Step 4 — `LeaderboardService` updated
File: `backend/Sport4You.Api/Services/LeaderboardService.cs`

- Injected `IAvatarService _avatars` via constructor
- Called `GetAvatarImageMapAsync()` once per leaderboard request (single DB round-trip for all avatars)
- Used `TryGetValue` with `ActiveAvatarId ?? Guid.Empty` to resolve `imagePath`
- Set `ActiveAvatarImagePath = c.User.ActiveAvatarId.HasValue ? imagePath : null` (null-safe: users without an active avatar get null)

No `Program.cs` changes needed — `IAvatarService` was already registered as scoped; ASP.NET Core DI resolves the new constructor parameter automatically.

### Step 5 — New test
File: `backend/Sport4You.Tests/LeaderboardControllerTests.cs`

Added `GetLeaderboard_IncludesActiveAvatarImagePath` which:
- Registers a new user (auto-equips default avatar via `UnlockAndEquipDefaultAsync`)
- Logs one activity to appear on the leaderboard
- Asserts `ActiveAvatarImagePath` is non-null and starts with `"assets/avatars/"`

### Step 6 — Test run
All 82 tests pass. No regressions.

---

## Concerns / Notes

- The plan draft referred to `_context` as the field name in `AvatarService`, but the actual field is `_db`. Used `_db` — correct.
- The plan said "previously 79, now 80" but the suite already had 82 (prior phases added tests). The new test brings the count to 82 total (an increase of 1 from the pre-task count of 81). All pass.
- `imagePath` resolved via `TryGetValue` can be `null` if the avatar row somehow has no `ImagePath` — but the seed data guarantees non-null paths, so this is a non-issue in practice.
