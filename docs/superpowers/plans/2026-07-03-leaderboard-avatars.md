# Phase 4a: Leaderboard Avatar Thumbnails — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each user's active avatar thumbnail (or name initial as fallback) on the leaderboard — in both the ranked list rows and the top-3 podium cards.

**Architecture:** Add `activeAvatarImagePath` (nullable string) to `LeaderboardEntryDto`; resolve it in `LeaderboardService` via a new lightweight `GetAvatarImageMapAsync()` method on `IAvatarService`; update the Angular leaderboard component to render a circular `<img>` (avatar present) or initial badge (no avatar) everywhere the sport emoji currently appears.

**Tech Stack:** C# 12 / ASP.NET Core 8 / EF Core 8 — backend; Angular 17 standalone, `@if`/`@for` control flow — frontend.

## Global Constraints

- No new routes or API endpoints.
- No changes to existing test assertions — only add new ones.
- Avatar image size in list rows: 32 px circle. In podium cards: 48 px circle.
- Fallback when `activeAvatarImagePath` is null: show first letter of `firstName` in a filled circle (`#2E6BE6` background, white text), same size as the avatar img.
- Keep the 👑 crown decoration on the 1st-place podium card. Only replace the `athleteEmoji` below it.
- No-commit rule: project rule is that Antonio commits. Never call `git commit`.
- All 79+ existing backend tests must continue to pass after changes.

---

### Task 1: Backend — expose `activeAvatarImagePath` in leaderboard response

**Files:**
- Modify: `backend/Sport4You.Api/Services/IAvatarService.cs`
- Modify: `backend/Sport4You.Api/Services/AvatarService.cs`
- Modify: `backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs`
- Modify: `backend/Sport4You.Api/Services/LeaderboardService.cs`
- Modify: `backend/Sport4You.Tests/LeaderboardControllerTests.cs`

**Interfaces:**
- Produces: `LeaderboardEntryDto.ActiveAvatarImagePath string?`
- Produces: `IAvatarService.GetAvatarImageMapAsync() → Task<Dictionary<Guid, string>>`

- [ ] **Step 1: Add `GetAvatarImageMapAsync` to `IAvatarService`**

Open `backend/Sport4You.Api/Services/IAvatarService.cs`. Add one method to the interface:

```csharp
Task<Dictionary<Guid, string>> GetAvatarImageMapAsync();
```

Full file after edit:

```csharp
// backend/Sport4You.Api/Services/IAvatarService.cs
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IAvatarService
{
    Task<List<UnlockedAvatarDto>> EvaluateAvatarsAsync(Guid userId);
    Task<List<AvatarStatusDto>> GetUserAvatarsAsync(Guid userId);
    Task<bool> SetActiveAvatarAsync(Guid userId, Guid avatarId);
    Task<AvatarStatusDto?> GetActiveAvatarAsync(Guid userId);
    Task UnlockAndEquipDefaultAsync(Guid userId);
    Task<Dictionary<Guid, string>> GetAvatarImageMapAsync();
}
```

- [ ] **Step 2: Implement `GetAvatarImageMapAsync` in `AvatarService`**

Open `backend/Sport4You.Api/Services/AvatarService.cs`. Add the implementation at the end of the class (before the closing `}`):

```csharp
    public async Task<Dictionary<Guid, string>> GetAvatarImageMapAsync()
        => await _context.Avatars.ToDictionaryAsync(a => a.Id, a => a.ImagePath);
```

`_context` already exists in `AvatarService` (`AppDbContext _context`). `ToDictionaryAsync` is from `Microsoft.EntityFrameworkCore` which is already imported.

- [ ] **Step 3: Add `ActiveAvatarImagePath` to `LeaderboardEntryDto`**

Open `backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs`. Add one property:

```csharp
namespace Sport4You.Api.DTOs;

public class LeaderboardEntryDto
{
    public int Rank { get; set; }
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int TotalPoints { get; set; }
    public int RankTrend { get; set; }
    public string? ActiveAvatarImagePath { get; set; }
}
```

- [ ] **Step 4: Populate `ActiveAvatarImagePath` in `LeaderboardService`**

Open `backend/Sport4You.Api/Services/LeaderboardService.cs`. Inject `IAvatarService` and use the map to resolve each user's image path.

Full file after edit:

```csharp
using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class LeaderboardService : ILeaderboardService
{
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IAvatarService _avatars;

    public LeaderboardService(IUserRepository users, IActivityRepository activities, IAvatarService avatars)
    {
        _users = users;
        _activities = activities;
        _avatars = avatars;
    }

    public async Task<List<LeaderboardEntryDto>> GetLeaderboardAsync()
    {
        var users = await _users.GetAllAsync();
        var allActivities = await _activities.GetAllAsync();
        var avatarImageMap = await _avatars.GetAvatarImageMapAsync();
        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);
        var oldActivities = allActivities.Where(a => a.DateTime < sevenDaysAgo).ToList();

        var currentPoints = users.ToDictionary(
            u => u.Id,
            u => allActivities.Where(a => a.UserId == u.Id).Sum(a => a.Points));

        var previousPoints = users.ToDictionary(
            u => u.Id,
            u => oldActivities.Where(a => a.UserId == u.Id).Sum(a => a.Points));

        var currentRanked = users
            .OrderByDescending(u => currentPoints[u.Id])
            .Select((u, i) => new { User = u, Rank = i + 1, Points = currentPoints[u.Id] })
            .ToList();

        var previousRanked = users
            .OrderByDescending(u => previousPoints[u.Id])
            .Select((u, i) => new { UserId = u.Id, Rank = i + 1 })
            .ToDictionary(x => x.UserId, x => x.Rank);

        return currentRanked.Select(c =>
        {
            avatarImageMap.TryGetValue(c.User.ActiveAvatarId ?? Guid.Empty, out var imagePath);
            return new LeaderboardEntryDto
            {
                Rank = c.Rank,
                UserId = c.User.Id,
                FirstName = c.User.FirstName,
                LastName = c.User.LastName,
                TotalPoints = c.Points,
                RankTrend = previousRanked.TryGetValue(c.User.Id, out var prevRank)
                    ? prevRank - c.Rank
                    : 0,
                ActiveAvatarImagePath = c.User.ActiveAvatarId.HasValue ? imagePath : null,
            };
        }).ToList();
    }
}
```

- [ ] **Step 5: Add a test for `activeAvatarImagePath`**

Open `backend/Sport4You.Tests/LeaderboardControllerTests.cs`. Add one new test at the end of the class. When a user registers, `UserService.CreateUserAsync` calls `UnlockAndEquipDefaultAsync`, so every user gets the default avatar automatically. The leaderboard should therefore return a non-null `ActiveAvatarImagePath` for that user.

```csharp
    [Fact]
    public async Task GetLeaderboard_IncludesActiveAvatarImagePath()
    {
        var userId = await CreateUserAsync("Avatar", "Leaderboard");

        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = "2026-06-30T10:00:00Z", sport = "running", distance = 1.0 });

        var response = await _client.GetAsync("/api/leaderboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        var entry = entries!.First(e => e.FirstName == "Avatar" && e.LastName == "Leaderboard");
        Assert.NotNull(entry.ActiveAvatarImagePath);
        Assert.StartsWith("assets/avatars/", entry.ActiveAvatarImagePath);
    }
```

- [ ] **Step 6: Run all backend tests**

```bash
cd /Users/antoniobecic/repo/neogov/sport4you/backend && dotnet test -v minimal 2>&1 | tail -10
```

Expected: all tests pass (previously 79, now 80).

---

### Task 2: Frontend — render avatar thumbnails and initial badges

**Files:**
- Modify: `frontend/src/app/shared/models/leaderboard.model.ts`
- Modify: `frontend/src/app/leaderboard/leaderboard.component.ts`

**Interfaces:**
- Consumes: `LeaderboardEntry.activeAvatarImagePath?: string` (from Task 1)
- Produces: circular avatar `<img>` (32 px in list, 48 px in podium) or initial badge fallback

- [ ] **Step 1: Add `activeAvatarImagePath` to `LeaderboardEntry`**

Replace `frontend/src/app/shared/models/leaderboard.model.ts` entirely:

```typescript
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  rankTrend: number;
  activeAvatarImagePath?: string;
}
```

- [ ] **Step 2: Add avatar CSS to `leaderboard.component.ts`**

In the `styles: [\`...\`]` block of `LeaderboardComponent`, add these rules before the closing backtick. Find the end of the existing styles and append:

```css
    /* avatar thumbnails */
    .av-thumb, .av-initial {
      display:inline-block; border-radius:50%; object-fit:cover; vertical-align:middle; flex-shrink:0;
    }
    .av-thumb  { border:2px solid rgba(255,255,255,.35); }
    .av-initial {
      background:#2E6BE6; color:#fff;
      font-family:'Chakra Petch',sans-serif; font-weight:700;
      display:inline-flex; align-items:center; justify-content:center;
      border:2px solid rgba(255,255,255,.35);
    }
    /* list row size */
    .av-thumb.sm, .av-initial.sm { width:32px; height:32px; font-size:13px; }
    /* podium size */
    .av-thumb.lg, .av-initial.lg { width:48px; height:48px; font-size:20px; margin-bottom:6px; }
```

- [ ] **Step 3: Update the ranked list rows**

In the template, find the `athlete-name` div:

```html
            <div class="athlete-name">
              {{ athleteEmoji(i) }} {{ e.firstName }} {{ e.lastName }}
              <span class="you-badge" *ngIf="isMe(e)">YOU</span>
            </div>
```

Replace with:

```html
            <div class="athlete-name">
              @if (e.activeAvatarImagePath) {
                <img class="av-thumb sm" [src]="e.activeAvatarImagePath" [alt]="e.firstName">
              } @else {
                <span class="av-initial sm">{{ e.firstName[0] }}</span>
              }
              {{ e.firstName }} {{ e.lastName }}
              <span class="you-badge" *ngIf="isMe(e)">YOU</span>
            </div>
```

- [ ] **Step 4: Update the podium cards**

The leaderboard has three podium slots. In each `podium-card`, find the `podium-emoji` div (e.g. `<div class="podium-emoji" style="font-size:22px">{{ athleteEmoji(0) }}</div>`) and replace it with the avatar/initial pattern. Do this for all three slots (rank 0, 1, 2). The 👑 div stays untouched.

For 1st place (entries[0]):
```html
            <div class="podium-card" style="background: linear-gradient(150deg,#FFE27A,#FFC200); box-shadow: 0 0 28px rgba(255,194,0,.5);">
              <div style="font-size:34px">👑</div>
              @if (entries[0].activeAvatarImagePath) {
                <img class="av-thumb lg" [src]="entries[0].activeAvatarImagePath" [alt]="entries[0].firstName">
              } @else {
                <span class="av-initial lg">{{ entries[0].firstName[0] }}</span>
              }
              <div class="podium-name">{{ entries[0].firstName }} {{ entries[0].lastName }}</div>
              <div class="podium-pts">{{ entries[0].totalPoints | number }}</div>
            </div>
```

For 2nd place (entries[1], left slot). Find the podium-card div for 2nd place and replace:
```html
            <div class="podium-card">
              @if (entries[1].activeAvatarImagePath) {
                <img class="av-thumb lg" [src]="entries[1].activeAvatarImagePath" [alt]="entries[1].firstName">
              } @else {
                <span class="av-initial lg">{{ entries[1].firstName[0] }}</span>
              }
              <div class="podium-name">{{ entries[1].firstName }} {{ entries[1].lastName }}</div>
              <div class="podium-pts">{{ entries[1].totalPoints | number }}</div>
            </div>
```

For 3rd place (entries[2], right slot). Find its podium-card and replace:
```html
            <div class="podium-card" [style.background]="'#FDF0E6'">
              @if (entries[2].activeAvatarImagePath) {
                <img class="av-thumb lg" [src]="entries[2].activeAvatarImagePath" [alt]="entries[2].firstName">
              } @else {
                <span class="av-initial lg">{{ entries[2].firstName[0] }}</span>
              }
              <div class="podium-name">{{ entries[2].firstName }} {{ entries[2].lastName }}</div>
              <div class="podium-pts">{{ entries[2].totalPoints | number }}</div>
            </div>
```

- [ ] **Step 5: Remove the now-unused `athleteEmoji` method and `ATHLETE_EMOJIS` constant**

The `athleteEmoji(i)` method is no longer called anywhere in the template. Remove it from the class and remove the `ATHLETE_EMOJIS` constant near the top of the file.

Find and delete the constant (it looks like):
```typescript
const ATHLETE_EMOJIS = [...];
```

Find and delete the method in the class:
```typescript
  athleteEmoji(i: number) { return ATHLETE_EMOJIS[i % ATHLETE_EMOJIS.length]; }
```

- [ ] **Step 6: Build check**

```bash
cd /Users/antoniobecic/repo/neogov/sport4you/frontend && npx ng build --no-progress 2>&1 | tail -5
```

Expected: 0 errors, `Application bundle generation complete`.
