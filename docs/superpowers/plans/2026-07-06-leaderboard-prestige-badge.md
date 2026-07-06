# Leaderboard Prestige Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface each athlete's prestige level as a star badge (`★{n}`) overlaid on their avatar in the leaderboard's ranked list and podium.

**Architecture:** Backend adds a `PrestigeLevel` field to `LeaderboardEntryDto`, populated in `LeaderboardService` from a new batch map helper on `IXpService` (mirroring the existing avatar/border map helpers — no N+1). Frontend adds `prestigeLevel` to the `LeaderboardEntry` model and renders an amber corner badge on each avatar when `prestigeLevel > 0`.

**Tech Stack:** C# / ASP.NET Core 8 · EF Core · xUnit integration tests · Angular 17 standalone component (inline template + styles).

## Global Constraints

- Assignment API contracts on `main` are sacred: `POST /api/users` and `POST /api/activities` shapes must not change. This feature only **adds** a field to the `GET /api/leaderboard` response DTO — additive, no breaking change.
- Prestige is stored on `UserXp.PrestigeLevel` (int, default 0). Users who have never earned XP have **no `UserXp` row** — absence means prestige 0.
- Leaderboard ordering is by points and must remain untouched. This feature is visual only; no sorting/tiebreak changes.
- Follow the existing map-helper pattern: `IAvatarService.GetAvatarImageMapAsync()` and `IBorderService.GetActiveBorderCssMapAsync()` both return `Task<Dictionary<Guid, string>>`. The prestige helper returns `Task<Dictionary<Guid, int>>`.
- Angular dev server does not need an asset restart here (no new asset files).

---

### Task 1: Backend — carry `PrestigeLevel` through the leaderboard

**Files:**
- Modify: `backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs`
- Modify: `backend/Sport4You.Api/Services/IXpService.cs`
- Modify: `backend/Sport4You.Api/Services/XpService.cs`
- Modify: `backend/Sport4You.Api/Services/LeaderboardService.cs:13-67`
- Test: `backend/Sport4You.Tests/LeaderboardControllerTests.cs`

**Interfaces:**
- Consumes: existing `AppDbContext _db` field and `UserXp` entity (`UserXp.UserId`, `UserXp.PrestigeLevel`); existing `IXpService` registration (scoped) and `LeaderboardService` constructor.
- Produces:
  - `LeaderboardEntryDto.PrestigeLevel` — `int`, defaults to 0.
  - `IXpService.GetPrestigeLevelMapAsync()` → `Task<Dictionary<Guid, int>>` mapping `UserId → PrestigeLevel` for every `UserXp` row.

- [ ] **Step 1: Add the DTO field so it can hold prestige**

In `backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs`, add the property after `ActiveBorderCss`:

```csharp
public class LeaderboardEntryDto
{
    public int Rank { get; set; }
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int TotalPoints { get; set; }
    public int RankTrend { get; set; }
    public string? ActiveAvatarImagePath { get; set; }
    public string? ActiveBorderCss { get; set; }
    public int PrestigeLevel { get; set; }
}
```

- [ ] **Step 2: Write the failing integration test**

Add to `backend/Sport4You.Tests/LeaderboardControllerTests.cs`. Reuse the class's existing `CreateUserAsync` helper and the prestige setup pattern (a 3000 km run lands exactly on the Level 10 threshold, after which `POST /prestige` succeeds):

```csharp
    // Level 10 (IMMORTAL) starts at 60,000 XP; running awards floor(km * 20) XP.
    // 3000 km in one activity lands exactly on the threshold, enabling prestige.
    private async Task ReachLevel10Async(string userId)
    {
        await _client.PostAsJsonAsync("/api/activities", new
        { userId, sport = "running", distance = 3000, datetime = DateTime.UtcNow.ToString("o") });
    }

    [Fact]
    public async Task GetLeaderboard_ReportsPrestigeLevel()
    {
        var prestigedId = await CreateUserAsync("Prestiged", "Athlete");
        var plainId = await CreateUserAsync("Plain", "Athlete");

        // prestigedId climbs to Level 10 and prestiges once.
        await ReachLevel10Async(prestigedId);
        var pr = await _client.PostAsync($"/api/users/{prestigedId}/prestige", null);
        Assert.Equal(HttpStatusCode.OK, pr.StatusCode);

        // plainId logs a normal activity but never prestiges.
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = plainId, datetime = "2026-06-30T10:00:00Z", sport = "running", distance = 5.0 });

        var response = await _client.GetAsync("/api/leaderboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        Assert.NotNull(entries);

        var prestiged = entries!.First(e => e.FirstName == "Prestiged" && e.LastName == "Athlete");
        var plain = entries!.First(e => e.FirstName == "Plain" && e.LastName == "Athlete");

        Assert.Equal(1, prestiged.PrestigeLevel);
        Assert.Equal(0, plain.PrestigeLevel);
    }
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~LeaderboardControllerTests.GetLeaderboard_ReportsPrestigeLevel"`
Expected: FAIL — `prestiged.PrestigeLevel` is 0 (the service never sets it), so `Assert.Equal(1, prestiged.PrestigeLevel)` fails. The test compiles (the DTO field exists from Step 1).

- [ ] **Step 4: Declare the map helper on the interface**

In `backend/Sport4You.Api/Services/IXpService.cs`, add to the `IXpService` interface, next to `GetPrestigeLevelAsync`:

```csharp
    Task<int> GetPrestigeLevelAsync(Guid userId);
    Task<Dictionary<Guid, int>> GetPrestigeLevelMapAsync();
```

- [ ] **Step 5: Implement the map helper in XpService**

In `backend/Sport4You.Api/Services/XpService.cs`, add next to the existing `GetPrestigeLevelAsync` method (around line 266). `_db` is the `AppDbContext` field already on the class; `using Microsoft.EntityFrameworkCore;` is already imported:

```csharp
    public async Task<int> GetPrestigeLevelAsync(Guid userId)
        => (await _db.UserXp.FindAsync(userId))?.PrestigeLevel ?? 0;

    public async Task<Dictionary<Guid, int>> GetPrestigeLevelMapAsync()
        => await _db.UserXp.ToDictionaryAsync(x => x.UserId, x => x.PrestigeLevel);
```

(The `GetPrestigeLevelAsync` line above is unchanged — shown for placement only; add just the new method.)

- [ ] **Step 6: Inject IXpService into LeaderboardService and populate the field**

In `backend/Sport4You.Api/Services/LeaderboardService.cs`, add the dependency. Update the fields and constructor (lines 8-20):

```csharp
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IAvatarService _avatars;
    private readonly IBorderService _borders;
    private readonly IXpService _xp;

    public LeaderboardService(IUserRepository users, IActivityRepository activities,
        IAvatarService avatars, IBorderService borders, IXpService xp)
    {
        _users = users;
        _activities = activities;
        _avatars = avatars;
        _borders = borders;
        _xp = xp;
    }
```

Fetch the prestige map alongside the other maps (after line 27, `activeBorderMap` fetch):

```csharp
        var activeBorderMap = await _borders.GetActiveBorderCssMapAsync();
        var prestigeMap = await _xp.GetPrestigeLevelMapAsync();
```

Set the field inside the `currentRanked.Select(...)` projection, next to `ActiveBorderCss`:

```csharp
                ActiveAvatarImagePath = c.User.ActiveAvatarId.HasValue ? imagePath : null,
                ActiveBorderCss = borderCss,
                PrestigeLevel = prestigeMap.TryGetValue(c.User.Id, out var prestige) ? prestige : 0,
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~LeaderboardControllerTests.GetLeaderboard_ReportsPrestigeLevel"`
Expected: PASS.

- [ ] **Step 8: Run the full backend test suite to confirm nothing broke**

Run: `dotnet test backend/Sport4You.Tests`
Expected: PASS (all existing tests plus the new one). The `LeaderboardService` constructor change is covered by DI — `IXpService` is registered scoped in `Program.cs:19`.

- [ ] **Step 9: Commit**

```bash
git add backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs \
        backend/Sport4You.Api/Services/IXpService.cs \
        backend/Sport4You.Api/Services/XpService.cs \
        backend/Sport4You.Api/Services/LeaderboardService.cs \
        backend/Sport4You.Tests/LeaderboardControllerTests.cs
git commit -m "feat: expose prestige level on leaderboard entries"
```

---

### Task 2: Frontend — render the prestige badge on avatars

**Files:**
- Modify: `frontend/src/app/shared/models/leaderboard.model.ts`
- Modify: `frontend/src/app/leaderboard/leaderboard.component.ts`

**Interfaces:**
- Consumes: `LeaderboardEntryDto.PrestigeLevel` from Task 1, deserialized into the `LeaderboardEntry` model as `prestigeLevel`.
- Produces: visual badge only — no exported API.

- [ ] **Step 1: Add `prestigeLevel` to the frontend model**

In `frontend/src/app/shared/models/leaderboard.model.ts`, add the field:

```typescript
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  rankTrend: number;
  activeAvatarImagePath?: string;
  activeBorderCss?: string;
  prestigeLevel: number;
}
```

- [ ] **Step 2: Add the badge styles**

In `frontend/src/app/leaderboard/leaderboard.component.ts`, add to the `styles` array (append after the existing avatar rules near line 101, before the closing `` ` ``):

```css
    /* prestige badge overlay */
    .av-wrap { position: relative; display: inline-flex; flex-shrink: 0; }
    .prestige-badge {
      position: absolute; top: -4px; right: -4px;
      display: inline-flex; align-items: center; justify-content: center;
      font-family: 'Chakra Petch', sans-serif; font-weight: 800; line-height: 1;
      color: #fff; background: linear-gradient(150deg,#FFD24A,#F5A200);
      border: 1.5px solid #fff; border-radius: 999px;
      box-shadow: 0 2px 6px -1px rgba(180,120,0,.6);
      white-space: nowrap;
    }
    /* list-row (sm) size */
    .av-wrap.sm .prestige-badge { font-size: 9px; padding: 1px 4px; min-width: 15px; height: 15px; }
    /* podium (lg) size */
    .av-wrap.lg .prestige-badge { font-size: 11px; padding: 1px 5px; min-width: 18px; height: 18px; top: -5px; right: -5px; }
```

- [ ] **Step 3: Wrap the list-row avatar and add the badge**

In `frontend/src/app/leaderboard/leaderboard.component.ts`, replace the list-row avatar block (currently lines 177-182, inside `.athlete-name`):

```html
              @if (e.activeAvatarImagePath) {
                <img class="av-thumb sm" [src]="e.activeAvatarImagePath" [alt]="e.firstName"
                     [style.border]="e.activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
              } @else {
                <span class="av-initial sm" [style.border]="e.activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ e.firstName[0] }}</span>
              }
```

with:

```html
              <span class="av-wrap sm">
                @if (e.activeAvatarImagePath) {
                  <img class="av-thumb sm" [src]="e.activeAvatarImagePath" [alt]="e.firstName"
                       [style.border]="e.activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
                } @else {
                  <span class="av-initial sm" [style.border]="e.activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ e.firstName[0] }}</span>
                }
                @if (e.prestigeLevel > 0) {
                  <span class="prestige-badge">★{{ e.prestigeLevel }}</span>
                }
              </span>
```

- [ ] **Step 4: Wrap the three podium avatars and add badges**

In the same file, each podium slot (2nd place ~lines 117-122, 1st place ~lines 132-137, 3rd place ~lines 146-151) has an avatar block of the same shape using the `lg` size and `entries[N]`. For **each** of the three, wrap the existing `@if/@else` avatar block in `<span class="av-wrap lg"> ... </span>` and append the badge inside the wrapper.

2nd place — replace:

```html
              @if (entries[1].activeAvatarImagePath) {
                <img class="av-thumb lg" [src]="entries[1].activeAvatarImagePath" [alt]="entries[1].firstName"
                     [style.border]="entries[1].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
              } @else {
                <span class="av-initial lg" [style.border]="entries[1].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[1].firstName[0] }}</span>
              }
```

with:

```html
              <span class="av-wrap lg">
                @if (entries[1].activeAvatarImagePath) {
                  <img class="av-thumb lg" [src]="entries[1].activeAvatarImagePath" [alt]="entries[1].firstName"
                       [style.border]="entries[1].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
                } @else {
                  <span class="av-initial lg" [style.border]="entries[1].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[1].firstName[0] }}</span>
                }
                @if (entries[1].prestigeLevel > 0) {
                  <span class="prestige-badge">★{{ entries[1].prestigeLevel }}</span>
                }
              </span>
```

1st place — replace:

```html
              @if (entries[0].activeAvatarImagePath) {
                <img class="av-thumb lg" [src]="entries[0].activeAvatarImagePath" [alt]="entries[0].firstName"
                     [style.border]="entries[0].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
              } @else {
                <span class="av-initial lg" [style.border]="entries[0].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[0].firstName[0] }}</span>
              }
```

with:

```html
              <span class="av-wrap lg">
                @if (entries[0].activeAvatarImagePath) {
                  <img class="av-thumb lg" [src]="entries[0].activeAvatarImagePath" [alt]="entries[0].firstName"
                       [style.border]="entries[0].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
                } @else {
                  <span class="av-initial lg" [style.border]="entries[0].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[0].firstName[0] }}</span>
                }
                @if (entries[0].prestigeLevel > 0) {
                  <span class="prestige-badge">★{{ entries[0].prestigeLevel }}</span>
                }
              </span>
```

3rd place — replace:

```html
              @if (entries[2].activeAvatarImagePath) {
                <img class="av-thumb lg" [src]="entries[2].activeAvatarImagePath" [alt]="entries[2].firstName"
                     [style.border]="entries[2].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
              } @else {
                <span class="av-initial lg" [style.border]="entries[2].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[2].firstName[0] }}</span>
              }
```

with:

```html
              <span class="av-wrap lg">
                @if (entries[2].activeAvatarImagePath) {
                  <img class="av-thumb lg" [src]="entries[2].activeAvatarImagePath" [alt]="entries[2].firstName"
                       [style.border]="entries[2].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">
                } @else {
                  <span class="av-initial lg" [style.border]="entries[2].activeBorderCss ?? '2px solid rgba(255,255,255,.35)'">{{ entries[2].firstName[0] }}</span>
                }
                @if (entries[2].prestigeLevel > 0) {
                  <span class="prestige-badge">★{{ entries[2].prestigeLevel }}</span>
                }
              </span>
```

- [ ] **Step 5: Build the frontend to confirm it compiles**

Run: `cd frontend && npx ng build --configuration development`
Expected: build succeeds with no template/type errors. (`prestigeLevel` is now a required field on `LeaderboardEntry`; the template references resolve.)

- [ ] **Step 6: Verify visually in the running app**

With the backend running and `ng serve` up, open `/leaderboard`. Confirm:
- A prestiged user (set one up via the dashboard PRESTIGE flow, or seed) shows an amber `★{n}` badge on the top-right of their avatar in both the ranked list and, if top 3, the podium.
- A prestige-0 user shows no badge and the avatar/name layout is unchanged.
- The badge sits on the avatar corner without pushing the name text.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/models/leaderboard.model.ts \
        frontend/src/app/leaderboard/leaderboard.component.ts
git commit -m "feat: show prestige star badge on leaderboard avatars"
```

---

## Notes for the implementer

- **Prestige is hard to reach manually.** The cheapest setup is the test's `ReachLevel10Async` trick: a single 3000 km running activity hits the Level 10 threshold (`floor(3000 * 20) = 60000` XP), after which `POST /api/users/{id}/prestige` returns 200 and sets `PrestigeLevel = 1`. Use the same approach if you need a prestiged user for the visual check in Task 2 Step 6.
- **Do not change leaderboard ordering.** The `currentRanked` ordering by points stays exactly as-is; you are only adding a field to the projection.
- **No new assets**, so the "restart ng serve after adding assets" gotcha does not apply here.
