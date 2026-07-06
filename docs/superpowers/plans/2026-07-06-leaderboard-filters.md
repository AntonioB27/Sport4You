# Leaderboard Time Period & Sport Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `GET /api/leaderboard` be filtered by time period (`7d`/`30d`/`all`) and
sport (`all`/one of the six sports), and add a filter-pill UI to the `/leaderboard`
page that drives it.

**Architecture:** Two query parameters on the existing endpoint, both optional and
defaulting to `all` (so a request with no query string is byte-for-byte identical to
today). The backend already loads every user/activity into memory per request and
ranks with LINQ — filtering by date range and sport before summing is an in-place
extension of that same method, not a new architecture. The frontend adds two rows of
pill buttons above the existing podium/list and re-fetches on selection.

**Tech Stack:** ASP.NET Core 8 controller/service (C#), Angular 17 standalone
component (TypeScript).

## Global Constraints

- A request to `GET /api/leaderboard` with no query string must behave exactly as it
  does today — same response shape, same users included (even 0-point ones), same
  `RankTrend` computation. This is required by 4 existing tests in
  `LeaderboardControllerTests.cs` that must keep passing unmodified.
- Valid `period` values: `7d`, `30d`, `all` (default `all`). Valid `sport` values:
  `all`, `running`, `walking`, `cycling`, `swimming`, `gym`, `daily_steps` (default
  `all`). An unrecognized value for either returns `400 Bad Request`.
- When *either* parameter is non-default, users with 0 points in that filtered scope
  are excluded from the response entirely. On the default (`all`/`all`) view, every
  user still appears, including 0-point ones — unchanged from today.
- `period=all`'s `RankTrend` computation (current all-time total vs. a total computed
  from activities older than 7 days) must not change. New logic only applies to
  `period=7d` (compare `now-7d..now` vs. `now-14d..now-7d`) and `period=30d` (compare
  `now-30d..now` vs. `now-60d..now-30d`).
- No changes to `LeaderboardEntryDto`'s shape or to the dashboard's leaderboard
  snippet — filter UI is `/leaderboard`-page only.
- Design spec: `docs/superpowers/specs/2026-07-06-leaderboard-filters-design.md`

---

### Task 1: Backend — filterable leaderboard endpoint

**Files:**
- Modify: `backend/Sport4You.Api/Services/ILeaderboardService.cs`
- Modify: `backend/Sport4You.Api/Services/LeaderboardService.cs`
- Modify: `backend/Sport4You.Api/Controllers/LeaderboardController.cs`
- Test: `backend/Sport4You.Tests/LeaderboardControllerTests.cs`

**Interfaces:**
- Consumes: `IUserRepository.GetAllAsync()`, `IActivityRepository.GetAllAsync()` (both
  pre-existing, unchanged), `Activity.Sport`/`Activity.DateTime`/`Activity.Points`/
  `Activity.UserId` (pre-existing model fields).
- Produces: `ILeaderboardService.GetLeaderboardAsync(string period = "all", string sport
  = "all")` — the default-parameter overload keeps `DashboardService.cs`'s existing
  zero-arg call (`await _leaderboard.GetLeaderboardAsync();`, currently at
  `backend/Sport4You.Api/Services/DashboardService.cs:53`) compiling and behaving
  identically without any change to that file.

- [ ] **Step 1: Write the failing tests**

Open `backend/Sport4You.Tests/LeaderboardControllerTests.cs`. Add these five test
methods inside the `LeaderboardControllerTests` class, just before its closing `}`
(after the existing `GetLeaderboard_IncludesActiveAvatarImagePath` test):

```csharp
    [Fact]
    public async Task GetLeaderboard_FilterBySport_OnlyCountsMatchingSportPoints()
    {
        var runnerId = await CreateUserAsync("Sporty", "Runner");
        var cyclistOnlyId = await CreateUserAsync("Sporty", "CyclistOnly");

        var now = DateTime.UtcNow.ToString("o");
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = runnerId, datetime = now, sport = "running", distance = 10.0 });
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = runnerId, datetime = now, sport = "cycling", distance = 10.0 });
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = cyclistOnlyId, datetime = now, sport = "cycling", distance = 10.0 });

        var response = await _client.GetAsync("/api/leaderboard?sport=running");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        Assert.NotNull(entries);

        var runner = entries!.FirstOrDefault(e => e.FirstName == "Sporty" && e.LastName == "Runner");
        Assert.NotNull(runner);
        Assert.Equal(1000, runner!.TotalPoints); // running only: floor(10km * 100) = 1000, cycling excluded

        Assert.DoesNotContain(entries, e => e.FirstName == "Sporty" && e.LastName == "CyclistOnly");
    }

    [Fact]
    public async Task GetLeaderboard_FilterByPeriod7d_OnlyCountsRecentActivity()
    {
        var userId = await CreateUserAsync("Window", "Runner");

        var tenDaysAgo = DateTime.UtcNow.AddDays(-10).ToString("o");
        var today = DateTime.UtcNow.ToString("o");

        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = tenDaysAgo, sport = "running", distance = 5.0 });  // 500 pts, outside 7d window
        await _client.PostAsJsonAsync("/api/activities",
            new { userId, datetime = today, sport = "running", distance = 2.0 });       // 200 pts, inside 7d window

        var response = await _client.GetAsync("/api/leaderboard?period=7d");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        var entry = entries!.First(e => e.FirstName == "Window" && e.LastName == "Runner");
        Assert.Equal(200, entry.TotalPoints);
    }

    [Fact]
    public async Task GetLeaderboard_Period7d_RankTrendComparesPriorWindow()
    {
        var alphaId = await CreateUserAsync("SevenDay", "Alpha");
        var betaId = await CreateUserAsync("SevenDay", "Beta");

        var priorWindowDate = DateTime.UtcNow.AddDays(-10).ToString("o");   // inside days 8-14 ago (previous 7d window)
        var currentWindowDate = DateTime.UtcNow.AddDays(-2).ToString("o"); // inside last 7 days (current window)

        // Previous window: Beta ahead of Alpha
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = priorWindowDate, sport = "running", distance = 20.0 });  // 2000 pts
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = priorWindowDate, sport = "running", distance = 5.0 });  // 500 pts

        // Current window: Alpha overtakes Beta
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = currentWindowDate, sport = "running", distance = 30.0 }); // 3000 pts
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = currentWindowDate, sport = "running", distance = 1.0 });   // 100 pts

        var response = await _client.GetAsync("/api/leaderboard?period=7d");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        var alpha = entries!.First(e => e.FirstName == "SevenDay" && e.LastName == "Alpha");
        var beta = entries!.First(e => e.FirstName == "SevenDay" && e.LastName == "Beta");

        // Current window: Alpha=3000 (rank 1), Beta=100 (rank 2)
        Assert.Equal(3000, alpha.TotalPoints);
        Assert.Equal(100, beta.TotalPoints);
        // Previous window: Beta=2000 (rank 1), Alpha=500 (rank 2) → Alpha moved up, Beta moved down
        Assert.True(alpha.RankTrend > 0, $"Alpha trend should be positive but was {alpha.RankTrend}");
        Assert.True(beta.RankTrend < 0, $"Beta trend should be negative but was {beta.RankTrend}");
    }

    [Fact]
    public async Task GetLeaderboard_Period30d_RankTrendComparesPriorWindow()
    {
        var alphaId = await CreateUserAsync("ThirtyDay", "Alpha");
        var betaId = await CreateUserAsync("ThirtyDay", "Beta");

        var priorWindowDate = DateTime.UtcNow.AddDays(-40).ToString("o");  // inside days 31-60 ago (previous 30d window)
        var currentWindowDate = DateTime.UtcNow.AddDays(-5).ToString("o"); // inside last 30 days (current window)

        // Previous window: Beta ahead of Alpha
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = priorWindowDate, sport = "running", distance = 20.0 });  // 2000 pts
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = priorWindowDate, sport = "running", distance = 5.0 });  // 500 pts

        // Current window: Alpha overtakes Beta
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = alphaId, datetime = currentWindowDate, sport = "running", distance = 30.0 }); // 3000 pts
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = betaId, datetime = currentWindowDate, sport = "running", distance = 1.0 });   // 100 pts

        var response = await _client.GetAsync("/api/leaderboard?period=30d");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        var alpha = entries!.First(e => e.FirstName == "ThirtyDay" && e.LastName == "Alpha");
        var beta = entries!.First(e => e.FirstName == "ThirtyDay" && e.LastName == "Beta");

        Assert.Equal(3000, alpha.TotalPoints);
        Assert.Equal(100, beta.TotalPoints);
        Assert.True(alpha.RankTrend > 0, $"Alpha trend should be positive but was {alpha.RankTrend}");
        Assert.True(beta.RankTrend < 0, $"Beta trend should be negative but was {beta.RankTrend}");
    }

    [Fact]
    public async Task GetLeaderboard_InvalidPeriod_ReturnsBadRequest()
    {
        var response = await _client.GetAsync("/api/leaderboard?period=90d");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetLeaderboard_InvalidSport_ReturnsBadRequest()
    {
        var response = await _client.GetAsync("/api/leaderboard?sport=chess");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~LeaderboardControllerTests"`
Expected: the 4 pre-existing tests PASS; the 6 new tests FAIL — `sport`/`period`
query params are ignored today (no filtering happens, no 400 validation exists).

- [ ] **Step 3: Update the service interface**

Replace the full contents of `backend/Sport4You.Api/Services/ILeaderboardService.cs`:

```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface ILeaderboardService
{
    Task<List<LeaderboardEntryDto>> GetLeaderboardAsync(string period = "all", string sport = "all");
}
```

- [ ] **Step 4: Implement filtering in the service**

In `backend/Sport4You.Api/Services/LeaderboardService.cs`, replace the entire
`GetLeaderboardAsync` method (currently the whole body of the class) with:

```csharp
    public async Task<List<LeaderboardEntryDto>> GetLeaderboardAsync(string period = "all", string sport = "all")
    {
        var users = await _users.GetAllAsync();
        var allActivities = await _activities.GetAllAsync();
        var avatarImageMap = await _avatars.GetAvatarImageMapAsync();
        var activeBorderMap = await _borders.GetActiveBorderCssMapAsync();
        var prestigeMap = await _xp.GetPrestigeLevelMapAsync();
        var now = DateTime.UtcNow;

        var scopedActivities = sport == "all"
            ? allActivities
            : allActivities.Where(a => a.Sport == sport).ToList();

        // Activities that count toward the ranking shown to the caller.
        var currentActivities = period switch
        {
            "7d" => scopedActivities.Where(a => a.DateTime >= now.AddDays(-7)).ToList(),
            "30d" => scopedActivities.Where(a => a.DateTime >= now.AddDays(-30)).ToList(),
            _ => scopedActivities, // "all"
        };

        // Activities used only to compute RankTrend (the prior comparison window).
        // period=all keeps the exact pre-existing convention: "points as they stood
        // before the last 7 days" vs. the true all-time total.
        var previousActivities = period switch
        {
            "7d" => scopedActivities.Where(a => a.DateTime >= now.AddDays(-14) && a.DateTime < now.AddDays(-7)).ToList(),
            "30d" => scopedActivities.Where(a => a.DateTime >= now.AddDays(-60) && a.DateTime < now.AddDays(-30)).ToList(),
            _ => scopedActivities.Where(a => a.DateTime < now.AddDays(-7)).ToList(), // "all"
        };

        var isFiltered = period != "all" || sport != "all";

        var currentPoints = users.ToDictionary(
            u => u.Id,
            u => currentActivities.Where(a => a.UserId == u.Id).Sum(a => a.Points));

        var previousPoints = users.ToDictionary(
            u => u.Id,
            u => previousActivities.Where(a => a.UserId == u.Id).Sum(a => a.Points));

        // On the default view every user appears, even at 0 points (unchanged from
        // today). Under any active filter, 0-point users are dropped entirely.
        var eligibleUsers = isFiltered
            ? users.Where(u => currentPoints[u.Id] > 0).ToList()
            : users;

        var currentRanked = eligibleUsers
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
            activeBorderMap.TryGetValue(c.User.Id, out var borderCss);

            // A user with no activity at all in the previous comparison window has no
            // meaningful prior rank to compare against — only applies to the new 7d/30d
            // windows; period=all's trend behavior is intentionally left untouched.
            var noPriorData = period != "all" && previousPoints[c.User.Id] == 0;

            return new LeaderboardEntryDto
            {
                Rank = c.Rank,
                UserId = c.User.Id,
                FirstName = c.User.FirstName,
                LastName = c.User.LastName,
                TotalPoints = c.Points,
                RankTrend = !noPriorData && previousRanked.TryGetValue(c.User.Id, out var prevRank)
                    ? prevRank - c.Rank
                    : 0,
                ActiveAvatarImagePath = c.User.ActiveAvatarId.HasValue ? imagePath : null,
                ActiveBorderCss = borderCss,
                PrestigeLevel = prestigeMap.TryGetValue(c.User.Id, out var prestige) ? prestige : 0,
            };
        }).ToList();
    }
```

- [ ] **Step 5: Validate query params in the controller**

Replace the full contents of `backend/Sport4You.Api/Controllers/LeaderboardController.cs`:

```csharp
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private static readonly HashSet<string> ValidPeriods = ["7d", "30d", "all"];
    private static readonly HashSet<string> ValidSports =
        ["all", "running", "walking", "cycling", "swimming", "gym", "daily_steps"];

    private readonly ILeaderboardService _leaderboard;
    public LeaderboardController(ILeaderboardService leaderboard) => _leaderboard = leaderboard;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string period = "all", [FromQuery] string sport = "all")
    {
        period = period.ToLower();
        sport = sport.ToLower();

        if (!ValidPeriods.Contains(period))
            return BadRequest(new { error = $"Invalid period: '{period}'. Must be one of: 7d, 30d, all." });
        if (!ValidSports.Contains(sport))
            return BadRequest(new { error = $"Invalid sport: '{sport}'. Must be one of: all, running, walking, cycling, swimming, gym, daily_steps." });

        return Ok(await _leaderboard.GetLeaderboardAsync(period, sport));
    }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~LeaderboardControllerTests"`
Expected: PASS (10/10 — the 4 pre-existing tests plus the 6 new ones).

- [ ] **Step 7: Run the full backend suite**

Run: `dotnet test backend/Sport4You.Tests`
Expected: PASS. `DashboardService.cs`'s zero-arg call to `GetLeaderboardAsync()` must
still compile and behave identically (it does — default parameters cover it), so no
dashboard-related test should regress.

- [ ] **Step 8: Commit**

```bash
git add backend/Sport4You.Api/Services/ILeaderboardService.cs \
        backend/Sport4You.Api/Services/LeaderboardService.cs \
        backend/Sport4You.Api/Controllers/LeaderboardController.cs \
        backend/Sport4You.Tests/LeaderboardControllerTests.cs
git commit -m "feat: filter leaderboard by time period and sport"
```

---

### Task 2: Frontend — filter pill UI on the leaderboard page

**Files:**
- Modify: `frontend/src/app/shared/services/api.service.ts:29-31`
- Modify: `frontend/src/app/leaderboard/leaderboard.component.ts`

**Interfaces:**
- Consumes: `GET /api/leaderboard?period=...&sport=...` (Task 1); `SPORT_ICON_NAMES`,
  `SPORT_COLORS` from `frontend/src/app/shared/constants/sport.constants.ts`
  (pre-existing: `{running, walking, cycling, swimming, gym, daily_steps}` keys map to
  icon names / hex colors respectively — see that file for the exact values); `IconComponent`
  (pre-existing, already imported in `leaderboard.component.ts`, takes `[name]` and
  `[size]` inputs).
- Produces: `ApiService.getLeaderboard(period?: 'all' | '7d' | '30d', sport?: string)`
  — the two new optional parameters both default to `'all'`, so any other existing
  caller (`dashboard.component.ts`'s `this.api.getLeaderboard()` snippet call) keeps
  compiling and behaving identically.

This is a pure UI change wired to an already-tested backend endpoint (Task 1) — there
is no new business logic to unit test. Verification is a frontend build check plus a
manual pass (see Step 4).

- [ ] **Step 1: Add the two optional filter parameters to `ApiService.getLeaderboard`**

In `frontend/src/app/shared/services/api.service.ts`, replace:

```typescript
  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${this.base}/leaderboard`);
  }
```

with:

```typescript
  getLeaderboard(period: 'all' | '7d' | '30d' = 'all', sport: string = 'all'): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${this.base}/leaderboard`, { params: { period, sport } });
  }
```

- [ ] **Step 2: Add filter state and the pill row template to `leaderboard.component.ts`**

Add the constants import near the top of `frontend/src/app/leaderboard/leaderboard.component.ts`
(alongside the existing `LeaderboardEntry`/`IconComponent` imports):

```typescript
import { SPORT_ICON_NAMES, SPORT_COLORS } from '../shared/constants/sport.constants';
```

Add these two CSS rules to the component's `styles` array, right after the existing
`.lb-header { ... }` rule (so they land in the "── Header ──" section):

```css
    .filter-row { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .sport-row { margin-bottom:22px; }
    .pill {
      border:1px solid #d6e0ee; background:#fff; color:#5c6881; cursor:pointer;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.05em;
      padding:8px 14px; display:inline-flex; align-items:center; gap:6px;
      clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
      transition: background .12s, color .12s;
    }
    .pill:hover { background:#F4F6FB; }
    .pill.active { background:linear-gradient(150deg,#2E6BE6,#1B47AE); color:#fff; border-color:transparent; }
    .sport-pill.active { background: var(--sport-color); color:#fff; border-color:transparent; }
```

In the template, insert this block right after the header's closing `</div>` (the one
that closes `<div class="s4y-cbar-fx" ...>`, immediately before the
`<div class="spinner-wrap" *ngIf="loading">` line):

```html
      <div class="filter-row">
        @for (opt of periodOptions; track opt.value) {
          <button class="pill" [class.active]="selectedPeriod === opt.value" (click)="selectPeriod(opt.value)">{{ opt.label }}</button>
        }
      </div>
      <div class="filter-row sport-row">
        @for (opt of sportOptions; track opt.value) {
          <button class="pill sport-pill" [class.active]="selectedSport === opt.value"
                  [style.--sport-color]="sportColor(opt.value)"
                  (click)="selectSport(opt.value)">
            @if (opt.value !== 'all') { <app-icon [name]="sportIcon(opt.value)" [size]="14" /> }
            {{ opt.label }}
          </button>
        }
      </div>
```

- [ ] **Step 3: Add the filter fields/methods and switch `ngOnInit` to use them**

In the `LeaderboardComponent` class, replace:

```typescript
  entries: LeaderboardEntry[] = [];
  loading = true;
  readonly defaultBorder = DEFAULT_BORDER;
  private myId = localStorage.getItem('userId') ?? '';
  myRivalUserId: string | null = null;

  constructor(private api: ApiService, private router: Router, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.api.getLeaderboard().subscribe({
      next: data => { this.entries = data; this.loading = false; },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load leaderboard. Please try again.', 'OK', { duration: 4000 });
      },
    });
    if (this.myId) {
      this.api.getRival(this.myId).subscribe({
        next: r => { this.myRivalUserId = r.rivalUserId; },
        error: () => {},
      });
    }
  }
```

with:

```typescript
  entries: LeaderboardEntry[] = [];
  loading = true;
  readonly defaultBorder = DEFAULT_BORDER;
  private myId = localStorage.getItem('userId') ?? '';
  myRivalUserId: string | null = null;

  selectedPeriod: 'all' | '7d' | '30d' = 'all';
  selectedSport = 'all';

  readonly periodOptions: { value: 'all' | '7d' | '30d'; label: string }[] = [
    { value: '7d', label: 'THIS WEEK' },
    { value: '30d', label: 'THIS MONTH' },
    { value: 'all', label: 'ALL-TIME' },
  ];

  readonly sportOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'ALL SPORTS' },
    { value: 'running', label: 'RUNNING' },
    { value: 'walking', label: 'WALKING' },
    { value: 'cycling', label: 'CYCLING' },
    { value: 'swimming', label: 'SWIMMING' },
    { value: 'gym', label: 'GYM' },
    { value: 'daily_steps', label: 'STEPS' },
  ];

  constructor(private api: ApiService, private router: Router, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.loadLeaderboard();
    if (this.myId) {
      this.api.getRival(this.myId).subscribe({
        next: r => { this.myRivalUserId = r.rivalUserId; },
        error: () => {},
      });
    }
  }

  loadLeaderboard(): void {
    this.loading = true;
    this.api.getLeaderboard(this.selectedPeriod, this.selectedSport).subscribe({
      next: data => { this.entries = data; this.loading = false; },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load leaderboard. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }

  selectPeriod(period: 'all' | '7d' | '30d'): void {
    if (this.selectedPeriod === period) return;
    this.selectedPeriod = period;
    this.loadLeaderboard();
  }

  selectSport(sport: string): void {
    if (this.selectedSport === sport) return;
    this.selectedSport = sport;
    this.loadLeaderboard();
  }

  sportIcon(sport: string): string {
    return SPORT_ICON_NAMES[sport] ?? 'trophy';
  }

  sportColor(sport: string): string {
    return SPORT_COLORS[sport] ?? '#2E6BE6';
  }
```

- [ ] **Step 4: Build and manually verify**

Run: `cd frontend && npx ng build --configuration development`
Expected: build succeeds with no new errors from `leaderboard.component.ts` or
`api.service.ts` (pre-existing warnings from unrelated files being edited elsewhere
in the frontend are not this task's concern).

With the backend and `ng serve` running, open `/leaderboard` and check:
- Default load shows `ALL-TIME` and `ALL SPORTS` pills highlighted, list matches
  today's behavior exactly.
- Clicking `THIS WEEK` re-fetches and re-ranks by the last 7 days only; clicking a
  sport pill (e.g. `CYCLING`) re-fetches scoped to that sport, with its pill tinted
  using that sport's `SPORT_COLORS` value when active.
- A sport/period combination with very few qualifying users shows a short list (not
  every registered user at 0 points).
- Switching back to `ALL-TIME` / `ALL SPORTS` restores the original full list.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/services/api.service.ts \
        frontend/src/app/leaderboard/leaderboard.component.ts
git commit -m "feat: add time period and sport filter pills to the leaderboard page"
```
