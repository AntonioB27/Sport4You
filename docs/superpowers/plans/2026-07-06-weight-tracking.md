# Weight Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user log body weight once a day and see a chart.js progress chart with an optional goal-weight target line, as a private (non-competitive) dashboard card.

**Architecture:** Two isolated backend entities (`WeightEntry` — one row per user per day via upsert; `WeightGoal` — one optional goal per user) behind a testable `WeightService` and three `UsersController` actions. A self-contained Angular `WeightCardComponent` (chart.js via the already-registered `ng2-charts`) is dropped into the dashboard grid with a kg/lb display toggle, today's input, goal setting, and stats. Weight never touches points/XP/leaderboard or the `User`/activity contracts.

**Tech Stack:** C# / ASP.NET Core 8 · EF Core (SQLite, `EnsureCreated`, `DateOnly`) · xUnit (direct in-memory `AppDbContext` for service tests, `TestFactory` for endpoint tests) · Angular 17 standalone · `ng2-charts` / `chart.js` (already installed + registered in `app.config.ts`).

## Global Constraints

- Work on `main`; no feature branches. Stage explicit file paths when committing (never `git add -A`). Do not auto-commit — the user commits. (Commit steps are written for completeness; the user runs them.)
- Weight is **private and non-competitive**: no points, XP, achievements, or leaderboard. The `User` entity and the `POST /api/users` / `POST /api/activities` contracts are untouched.
- Canonical storage is **kilograms**; the backend is unit-agnostic. kg/lb is a frontend display concern (`lb = kg * 2.20462`).
- **Once a day:** at most one `WeightEntry` per `(UserId, Date)`; logging again the same day updates that row (upsert).
- Weight validation guard: value must be `> 0` and `< 1000` (kg) — server returns `400` otherwise.
- EF uses `EnsureCreated` (no migrations); the two new tables require deleting the dev `sport4you.db` once to recreate. Tests build a fresh DB per run, so they create the tables automatically.

---

### Task 1: Backend — WeightEntry/WeightGoal, WeightService, endpoints

**Files:**
- Create: `backend/Sport4You.Api/Models/WeightEntry.cs`
- Create: `backend/Sport4You.Api/Models/WeightGoal.cs`
- Create: `backend/Sport4You.Api/DTOs/WeightDtos.cs`
- Create: `backend/Sport4You.Api/Services/IWeightService.cs`
- Create: `backend/Sport4You.Api/Services/WeightService.cs`
- Modify: `backend/Sport4You.Api/Data/AppDbContext.cs`
- Modify: `backend/Sport4You.Api/Controllers/UsersController.cs`
- Modify: `backend/Sport4You.Api/Program.cs`
- Test: `backend/Sport4You.Tests/WeightServiceTests.cs`
- Test: `backend/Sport4You.Tests/WeightEndpointTests.cs`

**Interfaces:**
- Consumes: existing `AppDbContext` (has `DbSet<User> Users`); `TestFactory` (in-memory SQLite); `RegisterUserRequest`/`POST /api/users` for seeding users in endpoint tests.
- Produces:
  - `record WeightEntryDto(string Date, decimal WeightKg)` — `Date` is `"yyyy-MM-dd"`.
  - `record WeightHistoryDto(List<WeightEntryDto> Entries, decimal? GoalKg)` — entries ascending by date.
  - `interface IWeightService { Task<WeightHistoryDto?> GetHistoryAsync(Guid userId); Task<WeightEntryDto?> UpsertTodayAsync(Guid userId, decimal weightKg); Task<bool> SetGoalAsync(Guid userId, decimal goalKg); }` — returns `null`/`false` when the user does not exist.
  - Endpoints: `GET /api/users/{userId}/weight` → `WeightHistoryDto`; `POST /api/users/{userId}/weight` `{ weightKg }` → `WeightEntryDto`; `PUT /api/users/{userId}/weight/goal` `{ goalKg }` → `{ goalKg }`.

- [ ] **Step 1: Write the failing service tests**

Create `backend/Sport4You.Tests/WeightServiceTests.cs`:

```csharp
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.Models;
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class WeightServiceTests
{
    private static AppDbContext NewDb()
    {
        var conn = new SqliteConnection("Data Source=:memory:");
        conn.Open();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(conn).Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }

    private static Guid SeedUser(AppDbContext db)
    {
        var user = new User { Id = Guid.NewGuid(), FirstName = "Wei", LastName = "Ght" };
        db.Users.Add(user);
        db.SaveChanges();
        return user.Id;
    }

    [Fact]
    public async Task UpsertToday_SameDayTwice_UpdatesSingleRow()
    {
        using var db = NewDb();
        var sut = new WeightService(db);
        var userId = SeedUser(db);

        await sut.UpsertTodayAsync(userId, 80.0m);
        await sut.UpsertTodayAsync(userId, 79.2m);

        var rows = await db.WeightEntries.Where(w => w.UserId == userId).ToListAsync();
        Assert.Single(rows);
        Assert.Equal(79.2m, rows[0].WeightKg);
    }

    [Fact]
    public async Task GetHistory_ReturnsEntriesAscendingByDate()
    {
        using var db = NewDb();
        var sut = new WeightService(db);
        var userId = SeedUser(db);

        // Seed a past-dated entry directly, then upsert today.
        var pastDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-5);
        db.WeightEntries.Add(new WeightEntry { Id = Guid.NewGuid(), UserId = userId, Date = pastDate, WeightKg = 85m });
        await db.SaveChangesAsync();
        await sut.UpsertTodayAsync(userId, 80m);

        var history = await sut.GetHistoryAsync(userId);
        Assert.NotNull(history);
        Assert.Equal(2, history!.Entries.Count);
        Assert.Equal(85m, history.Entries[0].WeightKg);        // earliest first
        Assert.True(string.CompareOrdinal(history.Entries[0].Date, history.Entries[1].Date) < 0);
        Assert.Null(history.GoalKg);
    }

    [Fact]
    public async Task SetGoal_InsertThenUpdate_KeepsSingleRow()
    {
        using var db = NewDb();
        var sut = new WeightService(db);
        var userId = SeedUser(db);

        await sut.SetGoalAsync(userId, 78m);
        await sut.SetGoalAsync(userId, 76m);

        var goals = await db.WeightGoals.Where(g => g.UserId == userId).ToListAsync();
        Assert.Single(goals);
        Assert.Equal(76m, goals[0].GoalWeightKg);

        var history = await sut.GetHistoryAsync(userId);
        Assert.Equal(76m, history!.GoalKg);
    }

    [Fact]
    public async Task UnknownUser_ReturnsNullOrFalse()
    {
        using var db = NewDb();
        var sut = new WeightService(db);
        var ghost = Guid.NewGuid();

        Assert.Null(await sut.GetHistoryAsync(ghost));
        Assert.Null(await sut.UpsertTodayAsync(ghost, 80m));
        Assert.False(await sut.SetGoalAsync(ghost, 78m));
    }
}
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~WeightServiceTests"`
Expected: FAIL to compile — `WeightService`, `WeightEntry`, `WeightGoal`, `WeightHistoryDto` don't exist.

- [ ] **Step 3: Create the entities**

Create `backend/Sport4You.Api/Models/WeightEntry.cs`:

```csharp
namespace Sport4You.Api.Models;

public class WeightEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateOnly Date { get; set; }
    public decimal WeightKg { get; set; }
}
```

Create `backend/Sport4You.Api/Models/WeightGoal.cs`:

```csharp
namespace Sport4You.Api.Models;

public class WeightGoal
{
    public Guid UserId { get; set; }
    public decimal GoalWeightKg { get; set; }
}
```

- [ ] **Step 4: Wire the entities into AppDbContext**

In `backend/Sport4You.Api/Data/AppDbContext.cs`, add the two `DbSet`s next to the others (after the `UserBorders` line):

```csharp
    public DbSet<WeightEntry> WeightEntries => Set<WeightEntry>();
    public DbSet<WeightGoal> WeightGoals => Set<WeightGoal>();
```

And in `OnModelCreating`, before the closing brace of the method, add:

```csharp
        modelBuilder.Entity<WeightEntry>()
            .HasIndex(w => new { w.UserId, w.Date })
            .IsUnique();

        modelBuilder.Entity<WeightGoal>()
            .HasKey(g => g.UserId);
```

- [ ] **Step 5: Create the DTOs**

Create `backend/Sport4You.Api/DTOs/WeightDtos.cs`:

```csharp
namespace Sport4You.Api.DTOs;

public record WeightEntryDto(string Date, decimal WeightKg);
public record WeightHistoryDto(List<WeightEntryDto> Entries, decimal? GoalKg);

public class LogWeightRequest
{
    public decimal WeightKg { get; set; }
}

public class SetWeightGoalRequest
{
    public decimal GoalKg { get; set; }
}
```

- [ ] **Step 6: Create the service interface and implementation**

Create `backend/Sport4You.Api/Services/IWeightService.cs`:

```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IWeightService
{
    Task<WeightHistoryDto?> GetHistoryAsync(Guid userId);
    Task<WeightEntryDto?> UpsertTodayAsync(Guid userId, decimal weightKg);
    Task<bool> SetGoalAsync(Guid userId, decimal goalKg);
}
```

Create `backend/Sport4You.Api/Services/WeightService.cs`:

```csharp
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;

namespace Sport4You.Api.Services;

public class WeightService : IWeightService
{
    private readonly AppDbContext _db;
    public WeightService(AppDbContext db) => _db = db;

    public async Task<WeightHistoryDto?> GetHistoryAsync(Guid userId)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == userId)) return null;

        var entries = await _db.WeightEntries
            .Where(w => w.UserId == userId)
            .OrderBy(w => w.Date)
            .Select(w => new WeightEntryDto(w.Date.ToString("yyyy-MM-dd"), w.WeightKg))
            .ToListAsync();

        var goal = await _db.WeightGoals.FindAsync(userId);
        return new WeightHistoryDto(entries, goal?.GoalWeightKg);
    }

    public async Task<WeightEntryDto?> UpsertTodayAsync(Guid userId, decimal weightKg)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == userId)) return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var existing = await _db.WeightEntries
            .FirstOrDefaultAsync(w => w.UserId == userId && w.Date == today);

        if (existing != null)
        {
            existing.WeightKg = weightKg;
        }
        else
        {
            _db.WeightEntries.Add(new WeightEntry
            {
                Id = Guid.NewGuid(), UserId = userId, Date = today, WeightKg = weightKg
            });
        }

        await _db.SaveChangesAsync();
        return new WeightEntryDto(today.ToString("yyyy-MM-dd"), weightKg);
    }

    public async Task<bool> SetGoalAsync(Guid userId, decimal goalKg)
    {
        if (!await _db.Users.AnyAsync(u => u.Id == userId)) return false;

        var goal = await _db.WeightGoals.FindAsync(userId);
        if (goal != null)
            goal.GoalWeightKg = goalKg;
        else
            _db.WeightGoals.Add(new WeightGoal { UserId = userId, GoalWeightKg = goalKg });

        await _db.SaveChangesAsync();
        return true;
    }
}
```

- [ ] **Step 7: Run the service tests to verify they pass**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~WeightServiceTests"`
Expected: PASS (4/4).

- [ ] **Step 8: Write the failing endpoint tests**

Create `backend/Sport4You.Tests/WeightEndpointTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class WeightEndpointTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;
    public WeightEndpointTests(TestFactory factory) => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task LogTwiceSameDay_KeepsOneEntryWithLatestValue()
    {
        var userId = await CreateUserAsync("Weight", "Once");

        await _client.PostAsJsonAsync($"/api/users/{userId}/weight", new { weightKg = 80.0 });
        await _client.PostAsJsonAsync($"/api/users/{userId}/weight", new { weightKg = 79.1 });

        var get = await _client.GetAsync($"/api/users/{userId}/weight");
        var body = await get.Content.ReadFromJsonAsync<JsonElement>();
        var entries = body.GetProperty("entries");
        Assert.Equal(1, entries.GetArrayLength());
        Assert.Equal(79.1, entries[0].GetProperty("weightKg").GetDouble(), 3);
    }

    [Fact]
    public async Task SetGoal_IsReturnedByHistory()
    {
        var userId = await CreateUserAsync("Weight", "Goal");

        var put = await _client.PutAsJsonAsync($"/api/users/{userId}/weight/goal", new { goalKg = 76.5 });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var get = await _client.GetAsync($"/api/users/{userId}/weight");
        var body = await get.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(76.5, body.GetProperty("goalKg").GetDouble(), 3);
    }

    [Fact]
    public async Task UnknownUser_Returns404()
    {
        var get = await _client.GetAsync($"/api/users/{Guid.NewGuid()}/weight");
        Assert.Equal(HttpStatusCode.NotFound, get.StatusCode);
    }

    [Fact]
    public async Task NonPositiveWeight_Returns400()
    {
        var userId = await CreateUserAsync("Weight", "Bad");
        var post = await _client.PostAsJsonAsync($"/api/users/{userId}/weight", new { weightKg = 0.0 });
        Assert.Equal(HttpStatusCode.BadRequest, post.StatusCode);
    }
}
```

- [ ] **Step 9: Run the endpoint tests to verify they fail**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~WeightEndpointTests"`
Expected: FAIL — endpoints return 404 (routes don't exist yet).

- [ ] **Step 10: Add the endpoints to UsersController**

In `backend/Sport4You.Api/Controllers/UsersController.cs`, add `IWeightService` to the constructor and add the three actions. Update the fields + constructor:

```csharp
    private readonly IUserService _users;
    private readonly IDashboardService _dashboard;
    private readonly IActivityService _activities;
    private readonly IXpService _xp;
    private readonly IWeightService _weight;

    public UsersController(IUserService users, IDashboardService dashboard, IActivityService activities, IXpService xp, IWeightService weight)
    {
        _users = users;
        _dashboard = dashboard;
        _activities = activities;
        _xp = xp;
        _weight = weight;
    }
```

Add these actions to the controller body (e.g. after the steps action):

```csharp
    [HttpGet("{userId}/weight")]
    public async Task<IActionResult> GetWeight(Guid userId)
    {
        var history = await _weight.GetHistoryAsync(userId);
        if (history == null) return NotFound(new { error = "User not found" });
        return Ok(history);
    }

    [HttpPost("{userId}/weight")]
    public async Task<IActionResult> LogWeight(Guid userId, [FromBody] LogWeightRequest request)
    {
        if (request.WeightKg <= 0 || request.WeightKg >= 1000)
            return BadRequest(new { error = "Weight must be between 0 and 1000 kg." });

        var entry = await _weight.UpsertTodayAsync(userId, request.WeightKg);
        if (entry == null) return NotFound(new { error = "User not found" });
        return Ok(entry);
    }

    [HttpPut("{userId}/weight/goal")]
    public async Task<IActionResult> SetWeightGoal(Guid userId, [FromBody] SetWeightGoalRequest request)
    {
        if (request.GoalKg <= 0 || request.GoalKg >= 1000)
            return BadRequest(new { error = "Goal must be between 0 and 1000 kg." });

        var ok = await _weight.SetGoalAsync(userId, request.GoalKg);
        if (!ok) return NotFound(new { error = "User not found" });
        return Ok(new { goalKg = request.GoalKg });
    }
```

- [ ] **Step 11: Register the service in Program.cs**

In `backend/Sport4You.Api/Program.cs`, add next to the other `AddScoped` registrations:

```csharp
builder.Services.AddScoped<IWeightService, WeightService>();
```

- [ ] **Step 12: Run the endpoint tests to verify they pass**

Run: `dotnet test backend/Sport4You.Tests --filter "FullyQualifiedName~WeightEndpointTests"`
Expected: PASS (4/4).

- [ ] **Step 13: Run the full backend suite**

Run: `dotnet test backend/Sport4You.Tests`
Expected: PASS (all existing tests plus the new ones). The `UsersController` constructor change resolves via DI — `IWeightService` is now registered.

- [ ] **Step 14: Commit**

```bash
git add backend/Sport4You.Api/Models/WeightEntry.cs \
        backend/Sport4You.Api/Models/WeightGoal.cs \
        backend/Sport4You.Api/DTOs/WeightDtos.cs \
        backend/Sport4You.Api/Services/IWeightService.cs \
        backend/Sport4You.Api/Services/WeightService.cs \
        backend/Sport4You.Api/Data/AppDbContext.cs \
        backend/Sport4You.Api/Controllers/UsersController.cs \
        backend/Sport4You.Api/Program.cs \
        backend/Sport4You.Tests/WeightServiceTests.cs \
        backend/Sport4You.Tests/WeightEndpointTests.cs
git commit -m "feat: weight tracking backend (entries, goal, endpoints)"
```

---

### Task 2: Frontend — WeightCardComponent + dashboard entry

**Files:**
- Create: `frontend/src/app/shared/models/weight.model.ts`
- Modify: `frontend/src/app/shared/services/api.service.ts`
- Create: `frontend/src/app/dashboard/weight-card/weight-card.component.ts`
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `GET /api/users/{id}/weight` → `WeightHistory`; `POST /api/users/{id}/weight` `{ weightKg }`; `PUT /api/users/{id}/weight/goal` `{ goalKg }` (Task 1).
- Produces: `<app-weight-card [userId]="…">` — self-contained dashboard card.

- [ ] **Step 1: Add the model**

Create `frontend/src/app/shared/models/weight.model.ts`:

```typescript
export interface WeightEntry {
  date: string;      // "yyyy-MM-dd"
  weightKg: number;
}

export interface WeightHistory {
  entries: WeightEntry[];
  goalKg: number | null;
}
```

- [ ] **Step 2: Add ApiService methods**

In `frontend/src/app/shared/services/api.service.ts`, add the import:

```typescript
import { WeightHistory } from '../models/weight.model';
```

And add these methods (next to the other user methods):

```typescript
  getWeight(userId: string): Observable<WeightHistory> {
    return this.http.get<WeightHistory>(`${this.base}/users/${userId}/weight`);
  }

  logWeight(userId: string, weightKg: number): Observable<{ date: string; weightKg: number }> {
    return this.http.post<{ date: string; weightKg: number }>(`${this.base}/users/${userId}/weight`, { weightKg });
  }

  setWeightGoal(userId: string, goalKg: number): Observable<{ goalKg: number }> {
    return this.http.put<{ goalKg: number }>(`${this.base}/users/${userId}/weight/goal`, { goalKg });
  }
```

- [ ] **Step 3: Create the WeightCardComponent**

Create `frontend/src/app/dashboard/weight-card/weight-card.component.ts`. It loads history on init, renders a chart.js line (weight + dashed goal line), a kg/lb display toggle, today's input (upsert), goal setting, and current/change/to-go stats. All values are stored/sent in kg; display converts to the selected unit:

```typescript
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../../shared/services/api.service';
import { WeightEntry } from '../../shared/models/weight.model';

const LB_PER_KG = 2.20462;

@Component({
  selector: 'app-weight-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, BaseChartDirective],
  styles: [`
    :host { display:block; }
    .card { background:#fff; border-radius:20px; box-shadow:0 12px 28px -18px rgba(16,32,62,.35); padding:18px 20px; }
    .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
    .title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; letter-spacing:.06em; color:#10203E; }
    .unit-toggle { display:flex; gap:4px; background:#EEF2F8; border-radius:9px; padding:3px; }
    .unit-toggle button { border:none; cursor:pointer; background:transparent; color:#8592ad; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; padding:4px 10px; border-radius:7px; }
    .unit-toggle button.active { background:#fff; color:#10203E; box-shadow:0 1px 3px rgba(0,0,0,.12); }
    .stats { display:flex; align-items:baseline; gap:12px; margin:8px 0 4px; }
    .current { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:30px; color:#10203E; }
    .current small { font-size:14px; color:#8592ad; }
    .change { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; }
    .change.down { color:#2f9e4f; } .change.up { color:#e5484d; } .change.flat { color:#8592ad; }
    .togo { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; color:#2E6BE6; margin-left:auto; }
    .chart-wrap { position:relative; height:150px; margin:8px 0 12px; }
    .empty { color:#8592ad; font-family:'Nunito',sans-serif; font-size:13px; padding:24px 0; text-align:center; }
    .row { display:flex; gap:8px; margin-top:8px; }
    .inp { flex:1; border:1px solid #d6e0ee; border-radius:10px; padding:9px 12px; font:inherit; }
    .btn { border:none; cursor:pointer; border-radius:10px; padding:9px 16px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; letter-spacing:.05em; }
    .btn.primary { background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E; }
    .btn.ghost { background:#fff; border:1px solid #d6e0ee; color:#5c6881; }
    .goal-row { display:flex; align-items:center; gap:8px; margin-top:8px; font-family:'Chakra Petch',sans-serif; font-size:12px; color:#5c6881; }
    .goal-row .link { color:#2E6BE6; cursor:pointer; font-weight:700; }
    .err { color:#e5484d; font-size:12px; margin-top:8px; }
  `],
  template: `
    <div class="card">
      <div class="head">
        <span class="title">⚖️ WEIGHT</span>
        <div class="unit-toggle">
          <button [class.active]="unit==='kg'" (click)="setUnit('kg')">KG</button>
          <button [class.active]="unit==='lb'" (click)="setUnit('lb')">LB</button>
        </div>
      </div>

      @if (entries.length) {
        <div class="stats">
          <span class="current">{{ display(currentKg) | number:'1.1-1' }}<small> {{ unit }}</small></span>
          <span class="change" [class]="changeClass">{{ changeLabel }}</span>
          @if (goalKg != null) { <span class="togo">{{ toGoLabel }}</span> }
        </div>
        <div class="chart-wrap">
          <canvas baseChart [type]="'line'" [data]="chartData" [options]="chartOptions"></canvas>
        </div>
      } @else {
        <div class="empty">No weigh-ins yet — log your first below to start the chart.</div>
      }

      <div class="row">
        <input class="inp" type="number" step="0.1" min="1" [placeholder]="'Weight today (' + unit + ')'"
               [(ngModel)]="input" [disabled]="loading" (keyup.enter)="log()">
        <button class="btn primary" (click)="log()" [disabled]="loading || !input">Log today</button>
      </div>

      <div class="goal-row">
        @if (editingGoal) {
          <input class="inp" type="number" step="0.1" min="1" [placeholder]="'Goal (' + unit + ')'" [(ngModel)]="goalInput">
          <button class="btn primary" (click)="saveGoal()">Save</button>
          <button class="btn ghost" (click)="editingGoal=false">Cancel</button>
        } @else {
          <span>Goal: <b>{{ goalKg != null ? (display(goalKg) | number:'1.1-1') + ' ' + unit : '—' }}</b></span>
          <span class="link" (click)="startEditGoal()">{{ goalKg != null ? 'Change' : 'Set goal' }}</span>
        }
      </div>

      @if (error) { <div class="err">{{ error }}</div> }
    </div>
  `,
})
export class WeightCardComponent implements OnInit {
  @Input() userId = '';

  entries: WeightEntry[] = [];
  goalKg: number | null = null;
  unit: 'kg' | 'lb' = 'kg';
  input: number | null = null;
  goalInput: number | null = null;
  editingGoal = false;
  loading = false;
  error = '';

  chartData: ChartData<'line'> = { labels: [], datasets: [] };
  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: false } },
  };

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    if (!this.userId) return;
    this.api.getWeight(this.userId).subscribe({
      next: h => { this.entries = h.entries; this.goalKg = h.goalKg; this.rebuildChart(); },
      error: () => { this.error = 'Could not load weight history.'; },
    });
  }

  display(kg: number): number { return this.unit === 'lb' ? kg * LB_PER_KG : kg; }
  private toKg(v: number): number { return this.unit === 'lb' ? v / LB_PER_KG : v; }

  setUnit(u: 'kg' | 'lb'): void { this.unit = u; this.rebuildChart(); }

  get currentKg(): number { return this.entries.length ? this.entries[this.entries.length - 1].weightKg : 0; }

  private get monthAgoStartKg(): number {
    // earliest entry within the last ~30 days (fallback to the first entry)
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const recent = this.entries.filter(e => new Date(e.date) >= cutoff);
    const pool = recent.length ? recent : this.entries;
    return pool.length ? pool[0].weightKg : this.currentKg;
  }

  get changeClass(): string {
    const d = this.currentKg - this.monthAgoStartKg;
    return d < -0.05 ? 'down' : d > 0.05 ? 'up' : 'flat';
  }

  get changeLabel(): string {
    const d = this.display(this.currentKg) - this.display(this.monthAgoStartKg);
    if (Math.abs(d) < 0.05) return '— this month';
    const arrow = d < 0 ? '↓' : '↑';
    return `${arrow} ${Math.abs(d).toFixed(1)} ${this.unit} this month`;
  }

  get toGoLabel(): string {
    if (this.goalKg == null) return '';
    const d = this.display(this.currentKg) - this.display(this.goalKg);
    if (Math.abs(d) < 0.05) return 'goal reached 🎉';
    return `${Math.abs(d).toFixed(1)} ${this.unit} to go`;
  }

  private rebuildChart(): void {
    const labels = this.entries.map(e => formatLabel(e.date));
    const datasets: ChartData<'line'>['datasets'] = [{
      data: this.entries.map(e => round1(this.display(e.weightKg))),
      label: 'Weight',
      borderColor: '#2E6BE6',
      backgroundColor: 'rgba(46,107,230,.12)',
      tension: 0.3,
      fill: true,
      pointRadius: 3,
      pointBackgroundColor: '#2E6BE6',
    }];
    if (this.goalKg != null && this.entries.length) {
      const goalVal = round1(this.display(this.goalKg));
      datasets.push({
        data: this.entries.map(() => goalVal),
        label: 'Goal',
        borderColor: '#9ECF10',
        borderDash: [6, 6],
        pointRadius: 0,
        fill: false,
      });
    }
    this.chartData = { labels, datasets };
  }

  log(): void {
    if (!this.input || this.input <= 0) { this.error = 'Enter a valid weight.'; return; }
    this.loading = true; this.error = '';
    this.api.logWeight(this.userId, round1(this.toKg(this.input))).subscribe({
      next: () => { this.input = null; this.loading = false; this.snackBar.open('Weight logged.', '', { duration: 2000 }); this.load(); },
      error: () => { this.loading = false; this.error = 'Failed to log. Try again.'; },
    });
  }

  startEditGoal(): void {
    this.goalInput = this.goalKg != null ? round1(this.display(this.goalKg)) : null;
    this.editingGoal = true;
  }

  saveGoal(): void {
    if (!this.goalInput || this.goalInput <= 0) { this.error = 'Enter a valid goal.'; return; }
    this.api.setWeightGoal(this.userId, round1(this.toKg(this.goalInput))).subscribe({
      next: () => { this.editingGoal = false; this.load(); },
      error: () => { this.error = 'Failed to save goal. Try again.'; },
    });
  }
}

function round1(n: number): number { return Math.round(n * 10) / 10; }
function formatLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

- [ ] **Step 4: Add the card to the dashboard**

In `frontend/src/app/dashboard/dashboard.component.ts`:

Add the import near the other component imports:

```typescript
import { WeightCardComponent } from './weight-card/weight-card.component';
```

Add `WeightCardComponent` to the standalone `imports` array in the `@Component` decorator (the array that already lists `TodayStepsCardComponent`, `RivalCardComponent`, etc.).

Add a getter to the component class for the current user id (used by the card):

```typescript
  get currentUserId(): string { return localStorage.getItem('userId') ?? ''; }
```

In the template, add the card in the right column immediately after the `<app-rival-card …></app-rival-card>` element:

```html
            <!-- Weight tracking -->
            <app-weight-card [userId]="currentUserId"></app-weight-card>
```

- [ ] **Step 5: Build the frontend to confirm it compiles**

Run: `cd frontend && npx ng build --configuration development`
Expected: build succeeds; `dashboard-component` and the new weight card compile with no errors.

- [ ] **Step 6: Manual end-to-end verification**

With the backend running (delete `backend/Sport4You.Api/sport4you.db` once first so the new tables are created) and `ng serve`:
- Dashboard shows the WEIGHT card with an empty state.
- Enter a weight, "Log today" → chart appears with one point; stats show current weight.
- Log again the same day with a different value → still one point, value updated (upsert).
- Toggle KG/LB → the current value, chart axis, stats, and goal line all convert.
- "Set goal" → enter a goal → a dashed goal line appears and "X to go" shows.
- Reload the page → data persists.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/models/weight.model.ts \
        frontend/src/app/shared/services/api.service.ts \
        frontend/src/app/dashboard/weight-card/weight-card.component.ts \
        frontend/src/app/dashboard/dashboard.component.ts
git commit -m "feat: weight tracking dashboard card with progress chart"
```

---

## Notes for the implementer

- **Do not auto-commit.** The user commits. Commit steps document intent; run them only if asked.
- **Delete `sport4you.db` once** before the first backend run after Task 1 — `EnsureCreated` won't add the new `WeightEntries`/`WeightGoals` tables to an existing database. Re-seeding is automatic on next start.
- **Weight stays private:** do not wire it into XP, achievements, missions, or the leaderboard. Only the endpoints in this plan touch weight data.
- **Units:** the backend only ever sees kilograms; all kg↔lb conversion is in `WeightCardComponent`.
- **Dashboard is a busy, actively-edited file** — Task 2 Step 4 changes only add an import, an `imports`-array entry, a getter, and one tag next to `<app-rival-card>`. Read the file first and place them precisely to avoid clobbering concurrent edits.
