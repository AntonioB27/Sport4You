# Fitness Challenge Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack fitness gamification app with a C# ASP.NET Core backend, Angular frontend, and SQLite database that allows users to log activities, earn normalized points, and compete on a global leaderboard.

**Architecture:** Classic layered architecture — Controllers delegate to Services, Services delegate to Repositories, Repositories use Entity Framework Core. Angular standalone components call a single shared ApiService. Points are calculated once at write time and stored, keeping reads fast.

**Tech Stack:** .NET 8, ASP.NET Core Web API, Entity Framework Core 8, SQLite, xUnit, Angular 17 (standalone), Angular Material 17, Chart.js, ng2-charts v6.

## Global Constraints

- All backend namespaces use `Sport4You.Api.*`
- All sport values stored lowercase with underscores: `running`, `walking`, `cycling`, `gym`, `swimming`, `daily_steps`
- API error responses always use shape: `{ "error": "message" }`
- Points are always stored as integers; floor is applied at calculation time
- Duration strings are always in `mm:ss` format; only the minute component counts
- `userId` is a GUID everywhere (backend `Guid`, frontend `string`)
- CORS: backend allows `http://localhost:4200`
- Angular app runs on port 4200, backend on port 5000

---

## File Map

### Backend
```
backend/
├── Sport4You.sln
├── Sport4You.Api/
│   ├── Sport4You.Api.csproj
│   ├── Program.cs
│   ├── Data/
│   │   └── AppDbContext.cs
│   ├── Models/
│   │   ├── User.cs
│   │   └── Activity.cs
│   ├── DTOs/
│   │   ├── RegisterUserRequest.cs
│   │   ├── RegisterUserResponse.cs
│   │   ├── LogActivityRequest.cs
│   │   ├── LogActivityResponse.cs
│   │   ├── LeaderboardEntryDto.cs
│   │   └── DashboardDto.cs
│   ├── Repositories/
│   │   ├── IUserRepository.cs
│   │   ├── UserRepository.cs
│   │   ├── IActivityRepository.cs
│   │   └── ActivityRepository.cs
│   ├── Services/
│   │   ├── IScoringService.cs
│   │   ├── ScoringService.cs
│   │   ├── IUserService.cs
│   │   ├── UserService.cs
│   │   ├── IActivityService.cs
│   │   ├── ActivityService.cs
│   │   ├── ILeaderboardService.cs
│   │   ├── LeaderboardService.cs
│   │   ├── IDashboardService.cs
│   │   └── DashboardService.cs
│   ├── Controllers/
│   │   ├── UsersController.cs
│   │   ├── ActivitiesController.cs
│   │   └── LeaderboardController.cs
│   └── Middleware/
│       └── ExceptionMiddleware.cs
└── Sport4You.Tests/
    ├── Sport4You.Tests.csproj
    ├── Helpers/
    │   └── TestFactory.cs
    ├── ScoringServiceTests.cs
    ├── UsersControllerTests.cs
    ├── ActivitiesControllerTests.cs
    └── LeaderboardControllerTests.cs
```

### Frontend
```
frontend/
└── src/
    └── app/
        ├── app.component.ts
        ├── app.config.ts
        ├── app.routes.ts
        ├── shared/
        │   ├── models/
        │   │   ├── leaderboard.model.ts
        │   │   └── dashboard.model.ts
        │   ├── services/
        │   │   └── api.service.ts
        │   └── components/
        │       └── register-dialog/
        │           └── register-dialog.component.ts
        ├── leaderboard/
        │   └── leaderboard.component.ts
        └── dashboard/
            └── dashboard.component.ts
```

---

## Task 1: Backend Scaffold — Solution, Projects, Models, DbContext

**Files:**
- Create: `backend/Sport4You.sln`
- Create: `backend/Sport4You.Api/Sport4You.Api.csproj`
- Create: `backend/Sport4You.Api/Program.cs`
- Create: `backend/Sport4You.Api/Data/AppDbContext.cs`
- Create: `backend/Sport4You.Api/Models/User.cs`
- Create: `backend/Sport4You.Api/Models/Activity.cs`
- Create: `backend/Sport4You.Tests/Sport4You.Tests.csproj`

**Interfaces:**
- Produces: `AppDbContext` with `Users` and `Activities` DbSets, `User` and `Activity` models

- [ ] **Step 1: Scaffold the .NET solution**

Run from `sport4you/`:
```bash
mkdir backend && cd backend
dotnet new sln -n Sport4You
dotnet new webapi -n Sport4You.Api --no-openapi -f net8.0
dotnet new xunit -n Sport4You.Tests -f net8.0
dotnet sln add Sport4You.Api/Sport4You.Api.csproj
dotnet sln add Sport4You.Tests/Sport4You.Tests.csproj
dotnet add Sport4You.Tests/Sport4You.Tests.csproj reference Sport4You.Api/Sport4You.Api.csproj
```

Expected: no errors, three folders created.

- [ ] **Step 2: Install backend packages**

```bash
cd Sport4You.Api
dotnet add package Microsoft.EntityFrameworkCore.Sqlite --version 8.0.0
dotnet add package Microsoft.EntityFrameworkCore.Design --version 8.0.0
dotnet add package Microsoft.EntityFrameworkCore.Tools --version 8.0.0
cd ../Sport4You.Tests
dotnet add package Microsoft.AspNetCore.Mvc.Testing --version 8.0.0
dotnet add package Microsoft.Data.Sqlite --version 8.0.0
dotnet add package Microsoft.EntityFrameworkCore.Sqlite --version 8.0.0
```

- [ ] **Step 3: Create the User model**

`backend/Sport4You.Api/Models/User.cs`:
```csharp
namespace Sport4You.Api.Models;

public class User
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public ICollection<Activity> Activities { get; set; } = new List<Activity>();
}
```

- [ ] **Step 4: Create the Activity model**

`backend/Sport4You.Api/Models/Activity.cs`:
```csharp
namespace Sport4You.Api.Models;

public class Activity
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime DateTime { get; set; }
    public string Sport { get; set; } = string.Empty;
    public decimal? Distance { get; set; }
    public string? Duration { get; set; }
    public int? Steps { get; set; }
    public int Points { get; set; }
}
```

- [ ] **Step 5: Create the DbContext**

`backend/Sport4You.Api/Data/AppDbContext.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Models;

namespace Sport4You.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Activity> Activities => Set<Activity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.FirstName, u.LastName })
            .IsUnique();
    }
}
```

- [ ] **Step 6: Write Program.cs (placeholder — services registered in later tasks)**

`backend/Sport4You.Api/Program.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=sport4you.db"));

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();
app.UseMiddleware<Sport4You.Api.Middleware.ExceptionMiddleware>();
app.UseCors();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.Run();

public partial class Program { }
```

Note: `public partial class Program { }` at the bottom is required for WebApplicationFactory in tests.

- [ ] **Step 7: Create the ExceptionMiddleware (needed by Program.cs above)**

`backend/Sport4You.Api/Middleware/ExceptionMiddleware.cs`:
```csharp
namespace Sport4You.Api.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;

    public ExceptionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception)
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred" });
        }
    }
}
```

- [ ] **Step 8: Delete the auto-generated WeatherForecast files**

```bash
rm backend/Sport4You.Api/WeatherForecast.cs
rm backend/Sport4You.Api/Controllers/WeatherForecastController.cs
```

- [ ] **Step 9: Verify the project builds**

```bash
cd backend
dotnet build
```

Expected: `Build succeeded. 0 Error(s)`

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend solution with models and DbContext"
```

---

## Task 2: ScoringService (TDD)

**Files:**
- Create: `backend/Sport4You.Api/Services/IScoringService.cs`
- Create: `backend/Sport4You.Api/Services/ScoringService.cs`
- Create: `backend/Sport4You.Tests/ScoringServiceTests.cs`

**Interfaces:**
- Produces: `IScoringService.CalculatePoints(string sport, decimal? distance, string? duration, int? steps) → int`

- [ ] **Step 1: Write the failing tests**

`backend/Sport4You.Tests/ScoringServiceTests.cs`:
```csharp
using Sport4You.Api.Services;

namespace Sport4You.Tests;

public class ScoringServiceTests
{
    private readonly ScoringService _sut = new();

    [Theory]
    [InlineData(1.0, 100)]
    [InlineData(5.0, 500)]
    [InlineData(42.195, 4219)]  // floor(42.195 * 100) = floor(4219.5) = 4219
    [InlineData(0.005, 0)]      // floor(0.5) = 0
    public void Running_ReturnsCorrectPoints(decimal distance, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("running", distance, null, null));

    [Theory]
    [InlineData(1.0, 50)]
    [InlineData(1.55, 77)]   // floor(1.55 * 50) = floor(77.5) = 77
    [InlineData(0.01, 0)]    // floor(0.5) = 0
    public void Walking_ReturnsCorrectPoints(decimal distance, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("walking", distance, null, null));

    [Theory]
    [InlineData(1.0, 25)]
    [InlineData(2.5, 62)]    // floor(2.5 * 25) = floor(62.5) = 62
    [InlineData(0.01, 0)]
    public void Cycling_ReturnsCorrectPoints(decimal distance, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("cycling", distance, null, null));

    [Theory]
    [InlineData("1:00", 15)]
    [InlineData("1:55", 15)]  // 1 full minute only; seconds discarded
    [InlineData("0:59", 0)]   // 0 full minutes
    [InlineData("10:00", 150)]
    [InlineData("0:00", 0)]
    public void Swimming_ReturnsCorrectPoints(string duration, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("swimming", null, duration, null));

    [Theory]
    [InlineData("1:00", 5)]
    [InlineData("1:55", 5)]   // 1 full minute only
    [InlineData("0:59", 0)]   // 0 full minutes
    [InlineData("10:00", 50)]
    public void Gym_ReturnsCorrectPoints(string duration, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("gym", null, duration, null));

    [Theory]
    [InlineData(100, 1)]
    [InlineData(399, 3)]    // floor(399/100) = 3
    [InlineData(99, 0)]     // floor(99/100) = 0
    [InlineData(1000, 10)]
    [InlineData(10000, 100)]
    public void DailySteps_ReturnsCorrectPoints(int steps, int expected)
        => Assert.Equal(expected, _sut.CalculatePoints("daily_steps", null, null, steps));
}
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd backend
dotnet test --filter "ScoringServiceTests"
```

Expected: compile error — `ScoringService` does not exist yet.

- [ ] **Step 3: Create the interface**

`backend/Sport4You.Api/Services/IScoringService.cs`:
```csharp
namespace Sport4You.Api.Services;

public interface IScoringService
{
    int CalculatePoints(string sport, decimal? distance, string? duration, int? steps);
}
```

- [ ] **Step 4: Implement ScoringService**

`backend/Sport4You.Api/Services/ScoringService.cs`:
```csharp
namespace Sport4You.Api.Services;

public class ScoringService : IScoringService
{
    public int CalculatePoints(string sport, decimal? distance, string? duration, int? steps)
    {
        return sport switch
        {
            "running"      => (int)(distance!.Value * 100),
            "walking"      => (int)(distance!.Value * 50),
            "cycling"      => (int)(distance!.Value * 25),
            "swimming"     => ParseMinutes(duration!) * 15,
            "gym"          => ParseMinutes(duration!) * 5,
            "daily_steps"  => steps!.Value / 100,
            _              => throw new ArgumentException($"Unknown sport: {sport}")
        };
    }

    private static int ParseMinutes(string duration)
    {
        var colonIndex = duration.IndexOf(':');
        return int.Parse(duration[..colonIndex]);
    }
}
```

Note: `(int)` cast in C# truncates toward zero, which equals floor for positive decimals. `steps / 100` is integer division, which also floors. `ParseMinutes` takes only the part before `:`, discarding seconds entirely.

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd backend
dotnet test --filter "ScoringServiceTests" -v normal
```

Expected: all tests PASS (21 test cases).

- [ ] **Step 6: Commit**

```bash
git add backend/Sport4You.Api/Services/ backend/Sport4You.Tests/ScoringServiceTests.cs
git commit -m "feat: add ScoringService with full test coverage"
```

---

## Task 3: User Registration API

**Files:**
- Create: `backend/Sport4You.Api/DTOs/RegisterUserRequest.cs`
- Create: `backend/Sport4You.Api/Repositories/IUserRepository.cs`
- Create: `backend/Sport4You.Api/Repositories/UserRepository.cs`
- Create: `backend/Sport4You.Api/Services/IUserService.cs`
- Create: `backend/Sport4You.Api/Services/UserService.cs`
- Create: `backend/Sport4You.Api/Controllers/UsersController.cs`
- Create: `backend/Sport4You.Tests/Helpers/TestFactory.cs`
- Create: `backend/Sport4You.Tests/UsersControllerTests.cs`
- Modify: `backend/Sport4You.Api/Program.cs`

**Interfaces:**
- Consumes: `AppDbContext` (Task 1)
- Produces: `POST /api/users` → `{ userId: guid }` or `409 { error }`
- Produces: `IUserRepository.GetByIdAsync(Guid) → User?`, `ExistsByNameAsync(string, string) → bool`, `CreateAsync(User) → User`

- [ ] **Step 1: Create the request DTO**

`backend/Sport4You.Api/DTOs/RegisterUserRequest.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace Sport4You.Api.DTOs;

public class RegisterUserRequest
{
    [Required]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    public string LastName { get; set; } = string.Empty;
}
```

- [ ] **Step 2: Create the user repository**

`backend/Sport4You.Api/Repositories/IUserRepository.cs`:
```csharp
using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id);
    Task<bool> ExistsByNameAsync(string firstName, string lastName);
    Task<User> CreateAsync(User user);
    Task<List<User>> GetAllAsync();
}
```

`backend/Sport4You.Api/Repositories/UserRepository.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _db;
    public UserRepository(AppDbContext db) => _db = db;

    public Task<User?> GetByIdAsync(Guid id)
        => _db.Users.FirstOrDefaultAsync(u => u.Id == id);

    public Task<bool> ExistsByNameAsync(string firstName, string lastName)
        => _db.Users.AnyAsync(u => u.FirstName == firstName && u.LastName == lastName);

    public async Task<User> CreateAsync(User user)
    {
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    public Task<List<User>> GetAllAsync()
        => _db.Users.ToListAsync();
}
```

- [ ] **Step 3: Create the user service**

`backend/Sport4You.Api/Services/IUserService.cs`:
```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record RegisterResult(bool IsConflict, Guid UserId, string? Error)
{
    public static RegisterResult Success(Guid id) => new(false, id, null);
    public static RegisterResult Conflict() => new(true, Guid.Empty, "User with this name already exists");
}

public interface IUserService
{
    Task<RegisterResult> RegisterAsync(RegisterUserRequest request);
}
```

`backend/Sport4You.Api/Services/UserService.cs`:
```csharp
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _users;
    public UserService(IUserRepository users) => _users = users;

    public async Task<RegisterResult> RegisterAsync(RegisterUserRequest request)
    {
        if (await _users.ExistsByNameAsync(request.FirstName, request.LastName))
            return RegisterResult.Conflict();

        var user = new User
        {
            Id = Guid.NewGuid(),
            FirstName = request.FirstName,
            LastName = request.LastName
        };

        await _users.CreateAsync(user);
        return RegisterResult.Success(user.Id);
    }
}
```

- [ ] **Step 4: Create the UsersController**

`backend/Sport4You.Api/Controllers/UsersController.cs`:
```csharp
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _users;
    private readonly IDashboardService _dashboard;

    public UsersController(IUserService users, IDashboardService dashboard)
    {
        _users = users;
        _dashboard = dashboard;
    }

    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterUserRequest request)
    {
        var result = await _users.RegisterAsync(request);
        if (result.IsConflict)
            return Conflict(new { error = result.Error });
        return Ok(new { userId = result.UserId });
    }

    [HttpGet("{userId}/dashboard")]
    public async Task<IActionResult> GetDashboard(Guid userId)
    {
        var dashboard = await _dashboard.GetDashboardAsync(userId);
        if (dashboard == null)
            return NotFound(new { error = "User not found" });
        return Ok(dashboard);
    }
}
```

Note: `IDashboardService` is created in Task 6. For now this will fail to compile — that's expected. We'll wire it up when we implement the dashboard.

- [ ] **Step 5: Register services in Program.cs**

Add these lines to `Program.cs` before `var app = builder.Build();`:
```csharp
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserService, UserService>();
```

Also add the missing usings at the top of `Program.cs`:
```csharp
using Sport4You.Api.Repositories;
using Sport4You.Api.Services;
```

- [ ] **Step 6: Create the test factory**

`backend/Sport4You.Tests/Helpers/TestFactory.cs`:
```csharp
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Data;

namespace Sport4You.Tests.Helpers;

public class TestFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        _connection.Open();

        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>));
            if (descriptor != null) services.Remove(descriptor);

            services.AddDbContext<AppDbContext>(o => o.UseSqlite(_connection));

            using var scope = services.BuildServiceProvider().CreateScope();
            scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        _connection.Dispose();
    }
}
```

- [ ] **Step 7: Write integration tests for user registration**

`backend/Sport4You.Tests/UsersControllerTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class UsersControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public UsersControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    [Fact]
    public async Task Register_ValidRequest_ReturnsUserId()
    {
        var response = await _client.PostAsJsonAsync("/api/users",
            new { firstName = "Alice", lastName = "Smith" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(body);
        Assert.True(Guid.TryParse(body["userId"], out _));
    }

    [Fact]
    public async Task Register_DuplicateName_Returns409()
    {
        await _client.PostAsJsonAsync("/api/users",
            new { firstName = "Bob", lastName = "Jones" });

        var response = await _client.PostAsJsonAsync("/api/users",
            new { firstName = "Bob", lastName = "Jones" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("User with this name already exists", body!["error"]);
    }

    [Fact]
    public async Task Register_MissingFirstName_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/users",
            new { lastName = "Smith" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
```

- [ ] **Step 8: Run tests — they will fail because IDashboardService is unresolved**

Skip this step for now — the controller references `IDashboardService` which doesn't exist yet. We'll run all tests together after Task 6.

- [ ] **Step 9: Commit what compiles**

```bash
git add backend/
git commit -m "feat: add user registration API with repository and service layers"
```

---

## Task 4: Activity Ingestion API

**Files:**
- Create: `backend/Sport4You.Api/DTOs/LogActivityRequest.cs`
- Create: `backend/Sport4You.Api/Repositories/IActivityRepository.cs`
- Create: `backend/Sport4You.Api/Repositories/ActivityRepository.cs`
- Create: `backend/Sport4You.Api/Services/IActivityService.cs`
- Create: `backend/Sport4You.Api/Services/ActivityService.cs`
- Create: `backend/Sport4You.Api/Controllers/ActivitiesController.cs`
- Create: `backend/Sport4You.Tests/ActivitiesControllerTests.cs`

**Interfaces:**
- Consumes: `IScoringService.CalculatePoints` (Task 2), `IUserRepository.GetByIdAsync` (Task 3)
- Produces: `POST /api/activities` → `{ activityId, points }` or `400 { error }`
- Produces: `IActivityRepository.GetByUserIdAsync`, `GetAllAsync`, `GetBeforeDateAsync`

- [ ] **Step 1: Create the request DTO**

`backend/Sport4You.Api/DTOs/LogActivityRequest.cs`:
```csharp
using System.ComponentModel.DataAnnotations;

namespace Sport4You.Api.DTOs;

public class LogActivityRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;

    [Required]
    public string Datetime { get; set; } = string.Empty;

    public string? Sport { get; set; }
    public decimal? Distance { get; set; }
    public string? Duration { get; set; }
    public int? Steps { get; set; }
}
```

- [ ] **Step 2: Create the activity repository**

`backend/Sport4You.Api/Repositories/IActivityRepository.cs`:
```csharp
using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public interface IActivityRepository
{
    Task<Activity> CreateAsync(Activity activity);
    Task<List<Activity>> GetByUserIdAsync(Guid userId);
    Task<List<Activity>> GetAllAsync();
    Task<List<Activity>> GetBeforeDateAsync(DateTime before);
}
```

`backend/Sport4You.Api/Repositories/ActivityRepository.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.Models;

namespace Sport4You.Api.Repositories;

public class ActivityRepository : IActivityRepository
{
    private readonly AppDbContext _db;
    public ActivityRepository(AppDbContext db) => _db = db;

    public async Task<Activity> CreateAsync(Activity activity)
    {
        _db.Activities.Add(activity);
        await _db.SaveChangesAsync();
        return activity;
    }

    public Task<List<Activity>> GetByUserIdAsync(Guid userId)
        => _db.Activities.Where(a => a.UserId == userId).OrderByDescending(a => a.DateTime).ToListAsync();

    public Task<List<Activity>> GetAllAsync()
        => _db.Activities.ToListAsync();

    public Task<List<Activity>> GetBeforeDateAsync(DateTime before)
        => _db.Activities.Where(a => a.DateTime < before).ToListAsync();
}
```

- [ ] **Step 3: Create the activity service with validation logic**

`backend/Sport4You.Api/Services/IActivityService.cs`:
```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public record ActivityResult(bool IsError, string? Error, Guid ActivityId, int Points)
{
    public static ActivityResult Success(Guid id, int points) => new(false, null, id, points);
    public static ActivityResult BadRequest(string error) => new(true, error, Guid.Empty, 0);
    public static ActivityResult NotFound(string error) => new(true, error, Guid.Empty, 0);
}

public interface IActivityService
{
    Task<ActivityResult> LogActivityAsync(LogActivityRequest request);
}
```

`backend/Sport4You.Api/Services/ActivityService.cs`:
```csharp
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class ActivityService : IActivityService
{
    private static readonly HashSet<string> DistanceSports = ["running", "walking", "cycling"];
    private static readonly HashSet<string> DurationSports = ["gym", "swimming"];

    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IScoringService _scoring;

    public ActivityService(IUserRepository users, IActivityRepository activities, IScoringService scoring)
    {
        _users = users;
        _activities = activities;
        _scoring = scoring;
    }

    public async Task<ActivityResult> LogActivityAsync(LogActivityRequest request)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
            return ActivityResult.BadRequest("Invalid userId format");

        var user = await _users.GetByIdAsync(userId);
        if (user == null)
            return ActivityResult.BadRequest("User not found");

        if (!DateTime.TryParse(request.Datetime, out var dateTime))
            return ActivityResult.BadRequest("Invalid datetime format");

        var (isValid, error, sport) = ValidateSportMetrics(request);
        if (!isValid)
            return ActivityResult.BadRequest(error!);

        var points = _scoring.CalculatePoints(sport, request.Distance, request.Duration, request.Steps);

        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DateTime = dateTime,
            Sport = sport,
            Distance = request.Distance,
            Duration = request.Duration,
            Steps = request.Steps,
            Points = points
        };

        await _activities.CreateAsync(activity);
        return ActivityResult.Success(activity.Id, points);
    }

    private static (bool isValid, string? error, string sport) ValidateSportMetrics(LogActivityRequest r)
    {
        var sport = r.Sport?.ToLower();

        if (sport == null && r.Steps == null)
            return (false, "Either sport or steps must be provided", string.Empty);

        if (r.Steps.HasValue && sport == null)
        {
            if (r.Distance.HasValue || r.Duration != null)
                return (false, "Steps activity cannot include distance or duration", string.Empty);
            return (true, null, "daily_steps");
        }

        if (DistanceSports.Contains(sport!))
        {
            if (!r.Distance.HasValue)
                return (false, $"{sport} requires a distance value", string.Empty);
            if (r.Duration != null || r.Steps.HasValue)
                return (false, $"{sport} cannot include duration or steps", string.Empty);
            return (true, null, sport!);
        }

        if (DurationSports.Contains(sport!))
        {
            if (r.Duration == null)
                return (false, $"{sport} requires a duration value", string.Empty);
            if (r.Distance.HasValue || r.Steps.HasValue)
                return (false, $"{sport} cannot include distance or steps", string.Empty);
            if (!IsValidDuration(r.Duration))
                return (false, "Duration must be in mm:ss format", string.Empty);
            return (true, null, sport!);
        }

        return (false, $"Unknown sport: {sport}", string.Empty);
    }

    private static bool IsValidDuration(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length == 2
            && int.TryParse(parts[0], out var minutes) && minutes >= 0
            && int.TryParse(parts[1], out var seconds) && seconds is >= 0 and < 60;
    }
}
```

- [ ] **Step 4: Create ActivitiesController**

`backend/Sport4You.Api/Controllers/ActivitiesController.cs`:
```csharp
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ActivitiesController : ControllerBase
{
    private readonly IActivityService _activities;
    public ActivitiesController(IActivityService activities) => _activities = activities;

    [HttpPost]
    public async Task<IActionResult> LogActivity([FromBody] LogActivityRequest request)
    {
        var result = await _activities.LogActivityAsync(request);
        if (result.IsError)
            return BadRequest(new { error = result.Error });
        return Ok(new { activityId = result.ActivityId, points = result.Points });
    }
}
```

- [ ] **Step 5: Register new services in Program.cs**

Add to the services section in `Program.cs`:
```csharp
builder.Services.AddScoped<IActivityRepository, ActivityRepository>();
builder.Services.AddScoped<IScoringService, ScoringService>();
builder.Services.AddScoped<IActivityService, ActivityService>();
```

- [ ] **Step 6: Write integration tests**

`backend/Sport4You.Tests/ActivitiesControllerTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class ActivitiesControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public ActivitiesControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first = "Test", string last = "User")
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task LogActivity_Running_ReturnsPoints()
    {
        var userId = await CreateUserAsync("Run", "Ner");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-06-30T10:00:00Z",
            sport = "running",
            distance = 5.0
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.Equal(500, ((System.Text.Json.JsonElement)body!["points"]).GetInt32());
    }

    [Fact]
    public async Task LogActivity_SwimmingWithDistance_Returns400()
    {
        var userId = await CreateUserAsync("Swim", "Mer");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-06-30T10:00:00Z",
            sport = "swimming",
            distance = 42.195
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Contains("duration", body!["error"]);
    }

    [Fact]
    public async Task LogActivity_StepsWithoutSport_ReturnsDailyStepsPoints()
    {
        var userId = await CreateUserAsync("Step", "Per");
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId,
            datetime = "2026-06-30T10:00:00Z",
            steps = 1000
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>();
        Assert.Equal(10, ((System.Text.Json.JsonElement)body!["points"]).GetInt32());
    }

    [Fact]
    public async Task LogActivity_InvalidUserId_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/activities", new
        {
            userId = "00000000-0000-0000-0000-000000000000",
            datetime = "2026-06-30T10:00:00Z",
            sport = "running",
            distance = 5.0
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
```

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: add activity ingestion API with sport validation and scoring"
```

---

## Task 5: Leaderboard API

**Files:**
- Create: `backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs`
- Create: `backend/Sport4You.Api/Services/ILeaderboardService.cs`
- Create: `backend/Sport4You.Api/Services/LeaderboardService.cs`
- Create: `backend/Sport4You.Api/Controllers/LeaderboardController.cs`
- Create: `backend/Sport4You.Tests/LeaderboardControllerTests.cs`

**Interfaces:**
- Consumes: `IUserRepository.GetAllAsync` (Task 3), `IActivityRepository.GetAllAsync`, `IActivityRepository.GetBeforeDateAsync` (Task 4)
- Produces: `GET /api/leaderboard` → `LeaderboardEntryDto[]`

- [ ] **Step 1: Create the DTO**

`backend/Sport4You.Api/DTOs/LeaderboardEntryDto.cs`:
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
}
```

- [ ] **Step 2: Create the leaderboard service**

`backend/Sport4You.Api/Services/ILeaderboardService.cs`:
```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface ILeaderboardService
{
    Task<List<LeaderboardEntryDto>> GetLeaderboardAsync();
}
```

`backend/Sport4You.Api/Services/LeaderboardService.cs`:
```csharp
using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class LeaderboardService : ILeaderboardService
{
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;

    public LeaderboardService(IUserRepository users, IActivityRepository activities)
    {
        _users = users;
        _activities = activities;
    }

    public async Task<List<LeaderboardEntryDto>> GetLeaderboardAsync()
    {
        var users = await _users.GetAllAsync();
        var allActivities = await _activities.GetAllAsync();
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

        return currentRanked.Select(c => new LeaderboardEntryDto
        {
            Rank = c.Rank,
            UserId = c.User.Id,
            FirstName = c.User.FirstName,
            LastName = c.User.LastName,
            TotalPoints = c.Points,
            RankTrend = previousRanked.TryGetValue(c.User.Id, out var prevRank)
                ? prevRank - c.Rank
                : 0
        }).ToList();
    }
}
```

Note: `RankTrend = previousRank - currentRank`. If a user was rank 5 before and is rank 3 now, trend = 5 - 3 = +2 (positive means improved).

- [ ] **Step 3: Create the LeaderboardController**

`backend/Sport4You.Api/Controllers/LeaderboardController.cs`:
```csharp
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private readonly ILeaderboardService _leaderboard;
    public LeaderboardController(ILeaderboardService leaderboard) => _leaderboard = leaderboard;

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _leaderboard.GetLeaderboardAsync());
}
```

- [ ] **Step 4: Register services in Program.cs**

Add:
```csharp
builder.Services.AddScoped<ILeaderboardService, LeaderboardService>();
```

- [ ] **Step 5: Write integration tests**

`backend/Sport4You.Tests/LeaderboardControllerTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using Sport4You.Api.DTOs;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class LeaderboardControllerTests : IClassFixture<TestFactory>
{
    private readonly HttpClient _client;

    public LeaderboardControllerTests(TestFactory factory)
        => _client = factory.CreateClient();

    private async Task<string> CreateUserAsync(string first, string last)
    {
        var r = await _client.PostAsJsonAsync("/api/users", new { firstName = first, lastName = last });
        var body = await r.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return body!["userId"];
    }

    [Fact]
    public async Task GetLeaderboard_ReturnsUsersRankedByPoints()
    {
        var aliceId = await CreateUserAsync("Alice", "Leader");
        var bobId = await CreateUserAsync("Bob", "Leader");

        await _client.PostAsJsonAsync("/api/activities",
            new { userId = aliceId, datetime = "2026-06-30T10:00:00Z", sport = "running", distance = 10.0 });
        await _client.PostAsJsonAsync("/api/activities",
            new { userId = bobId, datetime = "2026-06-30T10:00:00Z", sport = "running", distance = 5.0 });

        var response = await _client.GetAsync("/api/leaderboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var entries = await response.Content.ReadFromJsonAsync<List<LeaderboardEntryDto>>();
        Assert.NotNull(entries);
        Assert.True(entries!.Count >= 2);

        var alice = entries.First(e => e.FirstName == "Alice" && e.LastName == "Leader");
        var bob = entries.First(e => e.FirstName == "Bob" && e.LastName == "Leader");
        Assert.True(alice.Rank < bob.Rank);
        Assert.Equal(1000, alice.TotalPoints);
        Assert.Equal(500, bob.TotalPoints);
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add leaderboard API with rank trend calculation"
```

---

## Task 6: Dashboard API

**Files:**
- Create: `backend/Sport4You.Api/DTOs/DashboardDto.cs`
- Create: `backend/Sport4You.Api/Services/IDashboardService.cs`
- Create: `backend/Sport4You.Api/Services/DashboardService.cs`
- Modify: `backend/Sport4You.Api/Program.cs`

**Interfaces:**
- Consumes: `IUserRepository.GetByIdAsync` (Task 3), `IActivityRepository.GetByUserIdAsync` (Task 4)
- Produces: `GET /api/users/{userId}/dashboard` → `DashboardDto`

- [ ] **Step 1: Create the dashboard DTOs**

`backend/Sport4You.Api/DTOs/DashboardDto.cs`:
```csharp
namespace Sport4You.Api.DTOs;

public class DashboardDto
{
    public UserInfoDto User { get; set; } = new();
    public int TotalPoints { get; set; }
    public List<ActivityDto> Activities { get; set; } = [];
    public List<PointsOverTimeDto> PointsOverTime { get; set; } = [];
    public List<SportBreakdownDto> SportBreakdown { get; set; } = [];
}

public class UserInfoDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
}

public class ActivityDto
{
    public Guid Id { get; set; }
    public string DateTime { get; set; } = string.Empty;
    public string Sport { get; set; } = string.Empty;
    public decimal? Distance { get; set; }
    public string? Duration { get; set; }
    public int? Steps { get; set; }
    public int Points { get; set; }
}

public class PointsOverTimeDto
{
    public string Date { get; set; } = string.Empty;
    public int Points { get; set; }
}

public class SportBreakdownDto
{
    public string Sport { get; set; } = string.Empty;
    public int Points { get; set; }
}
```

- [ ] **Step 2: Create the dashboard service**

`backend/Sport4You.Api/Services/IDashboardService.cs`:
```csharp
using Sport4You.Api.DTOs;

namespace Sport4You.Api.Services;

public interface IDashboardService
{
    Task<DashboardDto?> GetDashboardAsync(Guid userId);
}
```

`backend/Sport4You.Api/Services/DashboardService.cs`:
```csharp
using Sport4You.Api.DTOs;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;

    public DashboardService(IUserRepository users, IActivityRepository activities)
    {
        _users = users;
        _activities = activities;
    }

    public async Task<DashboardDto?> GetDashboardAsync(Guid userId)
    {
        var user = await _users.GetByIdAsync(userId);
        if (user == null) return null;

        var activities = await _activities.GetByUserIdAsync(userId);

        var pointsOverTime = activities
            .GroupBy(a => a.DateTime.Date)
            .Select(g => new PointsOverTimeDto
            {
                Date = g.Key.ToString("yyyy-MM-dd"),
                Points = g.Sum(a => a.Points)
            })
            .OrderBy(x => x.Date)
            .ToList();

        var sportBreakdown = activities
            .GroupBy(a => a.Sport)
            .Select(g => new SportBreakdownDto
            {
                Sport = g.Key,
                Points = g.Sum(a => a.Points)
            })
            .ToList();

        return new DashboardDto
        {
            User = new UserInfoDto { FirstName = user.FirstName, LastName = user.LastName },
            TotalPoints = activities.Sum(a => a.Points),
            Activities = activities.Select(a => new ActivityDto
            {
                Id = a.Id,
                DateTime = a.DateTime.ToString("o"),
                Sport = a.Sport,
                Distance = a.Distance,
                Duration = a.Duration,
                Steps = a.Steps,
                Points = a.Points
            }).ToList(),
            PointsOverTime = pointsOverTime,
            SportBreakdown = sportBreakdown
        };
    }
}
```

- [ ] **Step 3: Register DashboardService in Program.cs**

Add:
```csharp
builder.Services.AddScoped<IDashboardService, DashboardService>();
```

- [ ] **Step 4: Run all backend tests**

```bash
cd backend
dotnet test -v normal
```

Expected: all tests pass. If `UsersControllerTests` fails due to missing dashboard route returning 500, check that `IDashboardService` is registered.

- [ ] **Step 5: Manually verify the API works**

```bash
cd backend
dotnet run --project Sport4You.Api
```

In a separate terminal:
```bash
# Register a user
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Alice","lastName":"Smith"}'

# Copy the userId from the response, then log an activity
curl -X POST http://localhost:5000/api/activities \
  -H "Content-Type: application/json" \
  -d '{"userId":"<paste-id-here>","datetime":"2026-06-30T10:00:00Z","sport":"running","distance":10.0}'

# Check leaderboard
curl http://localhost:5000/api/leaderboard

# Check dashboard
curl http://localhost:5000/api/users/<paste-id-here>/dashboard
```

Expected: all four requests return valid JSON with no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add dashboard API with points-over-time and sport breakdown"
```

---

## Task 7: Angular Scaffold + App Shell

**Files:**
- Create: `frontend/` (entire Angular project)
- Create: `frontend/src/app/app.config.ts`
- Create: `frontend/src/app/app.routes.ts`
- Create: `frontend/src/app/app.component.ts`

**Interfaces:**
- Produces: working Angular app at `http://localhost:4200` with navbar and routing

- [ ] **Step 1: Create the Angular project**

Run from `sport4you/`:
```bash
cd frontend || npx @angular/cli@17 new frontend --routing --style=scss --standalone --skip-git
```

If `ng` is not installed globally:
```bash
npx @angular/cli@17 new frontend --routing --style=scss --standalone --skip-git
```

When prompted:
- Which stylesheet format? → **SCSS**
- Enable SSR? → **No**

- [ ] **Step 2: Install Angular Material**

```bash
cd frontend
ng add @angular/material
```

When prompted:
- Choose a prebuilt theme → **Indigo/Pink** (or any)
- Set up global typography? → **Yes**
- Include animations? → **Yes**

- [ ] **Step 3: Install Chart.js and ng2-charts**

```bash
npm install chart.js ng2-charts
```

- [ ] **Step 4: Update app.config.ts**

`frontend/src/app/app.config.ts`:
```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    provideCharts(withDefaultRegisterables()),
  ],
};
```

- [ ] **Step 5: Update app.routes.ts**

`frontend/src/app/app.routes.ts`:
```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'leaderboard', pathMatch: 'full' },
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('./leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
];
```

- [ ] **Step 6: Update app.component.ts**

`frontend/src/app/app.component.ts`:
```typescript
import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RegisterDialogComponent } from './shared/components/register-dialog/register-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar color="primary">
      <span style="font-weight: 700; letter-spacing: 1px;">Sport4You 🏆</span>
      <span style="flex: 1"></span>
      <button mat-button routerLink="/leaderboard">Leaderboard</button>
      <button mat-button routerLink="/dashboard">My Dashboard</button>
    </mat-toolbar>
    <router-outlet />
  `,
})
export class AppComponent implements OnInit {
  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    if (!localStorage.getItem('userId')) {
      this.dialog.open(RegisterDialogComponent, { disableClose: true, width: '400px' });
    }
  }
}
```

- [ ] **Step 7: Create placeholder pages so routing compiles**

Create these two placeholder files so the lazy routes resolve:

`frontend/src/app/leaderboard/leaderboard.component.ts`:
```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  template: '<p>Leaderboard coming soon</p>',
})
export class LeaderboardComponent {}
```

`frontend/src/app/dashboard/dashboard.component.ts`:
```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: '<p>Dashboard coming soon</p>',
})
export class DashboardComponent {}
```

- [ ] **Step 8: Verify the Angular app compiles**

```bash
cd frontend
ng serve
```

Open `http://localhost:4200` — you should see the toolbar and be redirected to `/leaderboard`.

- [ ] **Step 9: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: scaffold Angular app with Material, routing, and app shell"
```

---

## Task 8: Shared Layer — ApiService, Models, Register Dialog

**Files:**
- Create: `frontend/src/app/shared/models/leaderboard.model.ts`
- Create: `frontend/src/app/shared/models/dashboard.model.ts`
- Create: `frontend/src/app/shared/services/api.service.ts`
- Create: `frontend/src/app/shared/components/register-dialog/register-dialog.component.ts`

**Interfaces:**
- Produces: `ApiService` with `registerUser`, `getLeaderboard`, `getDashboard`, `logActivity` methods
- Produces: `RegisterDialogComponent` opened by `AppComponent`

- [ ] **Step 1: Create TypeScript models**

`frontend/src/app/shared/models/leaderboard.model.ts`:
```typescript
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  rankTrend: number;
}
```

`frontend/src/app/shared/models/dashboard.model.ts`:
```typescript
export interface DashboardData {
  user: { firstName: string; lastName: string };
  totalPoints: number;
  activities: ActivityItem[];
  pointsOverTime: { date: string; points: number }[];
  sportBreakdown: { sport: string; points: number }[];
}

export interface ActivityItem {
  id: string;
  dateTime: string;
  sport: string;
  distance?: number;
  duration?: string;
  steps?: number;
  points: number;
}

export interface LogActivityRequest {
  userId: string;
  datetime: string;
  sport?: string;
  distance?: number;
  duration?: string;
  steps?: number;
}
```

- [ ] **Step 2: Create ApiService**

`frontend/src/app/shared/services/api.service.ts`:
```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { LeaderboardEntry } from '../models/leaderboard.model';
import { DashboardData, LogActivityRequest } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  registerUser(firstName: string, lastName: string): Observable<{ userId: string }> {
    return this.http.post<{ userId: string }>(`${this.base}/users`, { firstName, lastName });
  }

  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${this.base}/leaderboard`);
  }

  getDashboard(userId: string): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.base}/users/${userId}/dashboard`);
  }

  logActivity(request: LogActivityRequest): Observable<{ activityId: string; points: number }> {
    return this.http.post<{ activityId: string; points: number }>(
      `${this.base}/activities`,
      request
    );
  }
}
```

- [ ] **Step 3: Create the registration dialog**

`frontend/src/app/shared/components/register-dialog/register-dialog.component.ts`:
```typescript
import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-register-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Welcome to Sport4You 🏃</h2>
    <mat-dialog-content>
      <p style="color: #666; margin-bottom: 16px;">
        Enter your name to join the fitness challenge and start competing on the leaderboard.
      </p>
      <form [formGroup]="form" style="display: flex; flex-direction: column; gap: 8px;">
        <mat-form-field appearance="outline">
          <mat-label>First Name</mat-label>
          <input matInput formControlName="firstName" placeholder="e.g. Alice" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Last Name</mat-label>
          <input matInput formControlName="lastName" placeholder="e.g. Smith" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-raised-button
        color="primary"
        [disabled]="form.invalid || loading"
        (click)="register()"
      >
        {{ loading ? 'Joining...' : 'Join the Challenge' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class RegisterDialogComponent {
  form = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
  });
  loading = false;

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<RegisterDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  register() {
    if (this.form.invalid) return;
    this.loading = true;
    const { firstName, lastName } = this.form.value;
    this.api.registerUser(firstName!, lastName!).subscribe({
      next: ({ userId }) => {
        localStorage.setItem('userId', userId);
        this.dialogRef.close(userId);
      },
      error: (err) => {
        this.loading = false;
        const message = err.status === 409
          ? 'That name is already taken — try a different one'
          : 'Registration failed. Please try again.';
        this.snackBar.open(message, 'OK', { duration: 4000 });
      },
    });
  }
}
```

- [ ] **Step 4: Verify the dialog opens on first visit**

```bash
cd frontend
ng serve
```

Open `http://localhost:4200` in an incognito tab (no localStorage). The registration dialog should appear and block the background. After entering a name and clicking "Join the Challenge", the dialog should close and the app should navigate to `/leaderboard`.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/app/shared/
git commit -m "feat: add ApiService, models, and registration dialog"
```

---

## Task 9: Leaderboard Page

**Files:**
- Modify: `frontend/src/app/leaderboard/leaderboard.component.ts`

**Interfaces:**
- Consumes: `ApiService.getLeaderboard()` → `LeaderboardEntry[]` (Task 8)

- [ ] **Step 1: Implement the leaderboard component**

`frontend/src/app/leaderboard/leaderboard.component.ts`:
```typescript
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../shared/services/api.service';
import { LeaderboardEntry } from '../shared/models/leaderboard.model';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  styles: [`
    .container { max-width: 800px; margin: 32px auto; padding: 0 16px; }
    .title { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
    .trend-up { color: #4caf50; font-weight: 600; }
    .trend-down { color: #f44336; font-weight: 600; }
    .trend-neutral { color: #9e9e9e; }
    .rank-badge { 
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 50%;
      background: #e3f2fd; font-weight: 700;
    }
    .rank-1 { background: #ffd700; color: #333; }
    .rank-2 { background: #c0c0c0; color: #333; }
    .rank-3 { background: #cd7f32; color: white; }
    .name-link { cursor: pointer; color: #1976d2; text-decoration: underline; }
    table { width: 100%; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
  `],
  template: `
    <div class="container">
      <div class="title">🏆 Global Leaderboard</div>

      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="48" />
      </div>

      <mat-card *ngIf="!loading">
        <table mat-table [dataSource]="entries">

          <ng-container matColumnDef="rank">
            <th mat-header-cell *matHeaderCellDef>Rank</th>
            <td mat-cell *matCellDef="let e">
              <span class="rank-badge" [class]="'rank-' + e.rank">{{ e.rank }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Athlete</th>
            <td mat-cell *matCellDef="let e">
              <span class="name-link" (click)="viewDashboard(e)">
                {{ e.firstName }} {{ e.lastName }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="points">
            <th mat-header-cell *matHeaderCellDef>Total Points</th>
            <td mat-cell *matCellDef="let e">
              <strong>{{ e.totalPoints | number }}</strong>
            </td>
          </ng-container>

          <ng-container matColumnDef="trend">
            <th mat-header-cell *matHeaderCellDef>7-Day Trend</th>
            <td mat-cell *matCellDef="let e">
              <span [class]="getTrendClass(e.rankTrend)">
                {{ getTrendLabel(e.rankTrend) }}
              </span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>
        </table>
      </mat-card>
    </div>
  `,
})
export class LeaderboardComponent implements OnInit {
  entries: LeaderboardEntry[] = [];
  columns = ['rank', 'name', 'points', 'trend'];
  loading = true;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.api.getLeaderboard().subscribe({
      next: data => { this.entries = data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  viewDashboard(entry: LeaderboardEntry) {
    localStorage.setItem('viewingUserId', entry.userId);
    this.router.navigate(['/dashboard']);
  }

  getTrendClass(trend: number): string {
    if (trend > 0) return 'trend-up';
    if (trend < 0) return 'trend-down';
    return 'trend-neutral';
  }

  getTrendLabel(trend: number): string {
    if (trend > 0) return `↑ ${trend}`;
    if (trend < 0) return `↓ ${Math.abs(trend)}`;
    return '—';
  }
}
```

- [ ] **Step 2: Run the app and verify the leaderboard**

Make sure the backend is running (`dotnet run --project backend/Sport4You.Api`), then:
```bash
cd frontend && ng serve
```

Navigate to `http://localhost:4200/leaderboard`. After registering, you should see the leaderboard table. The medal badges (gold/silver/bronze) should appear for top 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/leaderboard/
git commit -m "feat: implement leaderboard page with rank badges and trend indicators"
```

---

## Task 10: Personal Dashboard Page

**Files:**
- Modify: `frontend/src/app/dashboard/dashboard.component.ts`

**Interfaces:**
- Consumes: `ApiService.getDashboard(userId)` → `DashboardData` (Task 8)
- Consumes: `LeaderboardEntry.userId` stored in `localStorage` as `viewingUserId` (Task 9)

- [ ] **Step 1: Implement the dashboard component**

`frontend/src/app/dashboard/dashboard.component.ts`:
```typescript
import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../shared/services/api.service';
import { DashboardData, ActivityItem } from '../shared/models/dashboard.model';

const SPORT_COLORS: Record<string, string> = {
  running: '#ef5350',
  walking: '#42a5f5',
  cycling: '#66bb6a',
  swimming: '#26c6da',
  gym: '#ab47bc',
  daily_steps: '#ffa726',
};

const SPORT_ICONS: Record<string, string> = {
  running: '🏃',
  walking: '🚶',
  cycling: '🚴',
  swimming: '🏊',
  gym: '🏋️',
  daily_steps: '👟',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    BaseChartDirective,
  ],
  styles: [`
    .container { max-width: 900px; margin: 32px auto; padding: 0 16px; }
    .hero { display: flex; align-items: center; gap: 24px; margin-bottom: 32px; flex-wrap: wrap; }
    .hero-points { font-size: 64px; font-weight: 800; color: #1976d2; line-height: 1; }
    .hero-label { font-size: 16px; color: #666; margin-top: 4px; }
    .hero-name { font-size: 28px; font-weight: 700; }
    .streak { 
      display: flex; align-items: center; gap: 8px;
      background: #fff3e0; border-radius: 12px; padding: 12px 20px;
      font-size: 18px; font-weight: 600; color: #e65100;
    }
    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    @media (max-width: 640px) { .charts-row { grid-template-columns: 1fr; } }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #333; }
    .activity-item { 
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid #f0f0f0;
    }
    .activity-item:last-child { border-bottom: none; }
    .activity-sport { font-weight: 600; font-size: 15px; }
    .activity-meta { color: #888; font-size: 13px; margin-top: 2px; }
    .activity-points { font-weight: 700; color: #1976d2; font-size: 16px; }
    .feed { max-height: 400px; overflow-y: auto; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
  `],
  template: `
    <div class="container">
      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="48" />
      </div>

      <ng-container *ngIf="!loading && data">
        <!-- Hero -->
        <div class="hero">
          <div>
            <div class="hero-name">{{ data.user.firstName }} {{ data.user.lastName }}</div>
            <div class="hero-points">{{ data.totalPoints | number }}</div>
            <div class="hero-label">total points</div>
          </div>
          <div class="streak" *ngIf="streak > 0">
            🔥 {{ streak }}-day streak
          </div>
        </div>

        <!-- Charts row -->
        <div class="charts-row">
          <!-- Line chart: points over time -->
          <mat-card>
            <mat-card-content>
              <div class="section-title">Points Over Time</div>
              <canvas baseChart
                [data]="lineChartData"
                [options]="lineChartOptions"
                type="line">
              </canvas>
            </mat-card-content>
          </mat-card>

          <!-- Doughnut chart: sport breakdown -->
          <mat-card>
            <mat-card-content>
              <div class="section-title">Activity Mix</div>
              <canvas baseChart
                [data]="doughnutChartData"
                [options]="doughnutChartOptions"
                type="doughnut">
              </canvas>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Activity feed -->
        <mat-card>
          <mat-card-content>
            <div class="section-title">Activity History</div>
            <div class="feed">
              <div class="activity-item" *ngFor="let a of data.activities">
                <div>
                  <div class="activity-sport">
                    {{ sportIcon(a.sport) }} {{ formatSport(a.sport) }}
                  </div>
                  <div class="activity-meta">
                    {{ formatDate(a.dateTime) }} &nbsp;·&nbsp; {{ formatMetric(a) }}
                  </div>
                </div>
                <div class="activity-points">+{{ a.points }} pts</div>
              </div>
              <div *ngIf="data.activities.length === 0" style="color: #999; padding: 16px 0;">
                No activities yet — start logging!
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </ng-container>

      <ng-container *ngIf="!loading && !data">
        <mat-card><mat-card-content>User not found.</mat-card-content></mat-card>
      </ng-container>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  data: DashboardData | null = null;
  loading = true;
  streak = 0;

  lineChartData: ChartData<'line'> = { labels: [], datasets: [] };
  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Points' } },
      x: { title: { display: true, text: 'Date' } },
    },
  };

  doughnutChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    plugins: { legend: { position: 'bottom' } },
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    const userId =
      localStorage.getItem('viewingUserId') ?? localStorage.getItem('userId');
    localStorage.removeItem('viewingUserId');

    if (!userId) { this.loading = false; return; }

    this.api.getDashboard(userId).subscribe({
      next: data => {
        this.data = data;
        this.streak = this.calculateStreak(data.activities);
        this.buildLineChart(data);
        this.buildDoughnutChart(data);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  private buildLineChart(data: DashboardData) {
    this.lineChartData = {
      labels: data.pointsOverTime.map(p => p.date),
      datasets: [{
        label: 'Daily Points',
        data: data.pointsOverTime.map(p => p.points),
        fill: true,
        tension: 0.4,
        borderColor: '#1976d2',
        backgroundColor: 'rgba(25, 118, 210, 0.1)',
        pointBackgroundColor: '#1976d2',
        pointRadius: 4,
      }],
    };
  }

  private buildDoughnutChart(data: DashboardData) {
    this.doughnutChartData = {
      labels: data.sportBreakdown.map(s => this.formatSport(s.sport)),
      datasets: [{
        data: data.sportBreakdown.map(s => s.points),
        backgroundColor: data.sportBreakdown.map(s => SPORT_COLORS[s.sport] ?? '#90a4ae'),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };
  }

  private calculateStreak(activities: ActivityItem[]): number {
    if (!activities.length) return 0;

    const uniqueDates = [...new Set(
      activities.map(a => new Date(a.dateTime).toDateString())
    )].map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let cursor = today;

    for (const date of uniqueDates) {
      const diffDays = Math.round(
        (cursor.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 0 || diffDays === 1) {
        streak++;
        cursor = date;
      } else {
        break;
      }
    }

    return streak;
  }

  formatSport(sport: string): string {
    return sport.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  sportIcon(sport: string): string {
    return SPORT_ICONS[sport] ?? '🏅';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  formatMetric(a: ActivityItem): string {
    if (a.distance != null) return `${a.distance} km`;
    if (a.duration != null) return `${a.duration} min`;
    if (a.steps != null) return `${a.steps.toLocaleString()} steps`;
    return '';
  }
}
```

- [ ] **Step 2: Test the dashboard end-to-end**

With backend running:
1. Open `http://localhost:4200` in incognito, register as a new user
2. Use curl or a REST client to log several activities for that user:
   ```bash
   curl -X POST http://localhost:5000/api/activities \
     -H "Content-Type: application/json" \
     -d '{"userId":"<your-id>","datetime":"2026-06-28T08:00:00Z","sport":"running","distance":5.0}'
   curl -X POST http://localhost:5000/api/activities \
     -H "Content-Type: application/json" \
     -d '{"userId":"<your-id>","datetime":"2026-06-29T09:00:00Z","sport":"cycling","distance":20.0}'
   curl -X POST http://localhost:5000/api/activities \
     -H "Content-Type: application/json" \
     -d '{"userId":"<your-id>","datetime":"2026-06-30T07:00:00Z","steps":8500}'
   ```
3. Navigate to `/dashboard` — verify: hero points total, line chart shows 3 data points, doughnut shows 3 sports, activity feed shows 3 items, streak shows 🔥 3-day streak.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/dashboard/
git commit -m "feat: implement personal dashboard with charts, activity feed, and streak"
```

---

## Task 11: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write the README**

`README.md`:
```markdown
# Sport4You — Fitness Challenge Application

A full-stack fitness gamification app where users log physical activities, earn normalized points, and compete on a global leaderboard.

## Tech Stack

- **Backend:** C# / ASP.NET Core 8 Web API · Entity Framework Core · SQLite
- **Frontend:** Angular 17 · Angular Material · Chart.js

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) and npm

## Running Locally

### 1. Start the backend

```bash
cd backend
dotnet run --project Sport4You.Api
```

The API will be available at `http://localhost:5000`.

### 2. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
ng serve
```

Open `http://localhost:4200` in your browser.

### Running backend tests

```bash
cd backend
dotnet test
```

## Project Structure

```
sport4you/
├── backend/          # ASP.NET Core Web API
│   ├── Sport4You.Api/
│   └── Sport4You.Tests/
└── frontend/         # Angular SPA
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users` | Register a new user |
| POST | `/api/activities` | Log a fitness activity |
| GET | `/api/leaderboard` | Get ranked leaderboard |
| GET | `/api/users/{id}/dashboard` | Get personal dashboard data |

## Scoring System

| Sport | Metric | Formula |
|-------|--------|---------|
| Running | km | floor(km × 100) |
| Walking | km | floor(km × 50) |
| Cycling | km | floor(km × 25) |
| Swimming | mm:ss | floor(minutes × 15) |
| Gym | mm:ss | floor(minutes × 5) |
| Daily Steps | count | floor(steps ÷ 100) |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup instructions and project overview to README"
```

---

## Self-Review Against Spec

| Requirement | Task |
|-------------|------|
| POST /api/users with firstName/lastName | Task 3 |
| Returns userId on success | Task 3 |
| Rejects duplicate names (409) | Task 3 |
| POST /api/activities with sport/datetime/distance/duration/steps | Task 4 |
| Rejects invalid sport/metric combos (400) | Task 4 |
| Running/Walking/Cycling = distance sports | Task 4 |
| Gym/Swimming = duration sports (mm:ss) | Task 4 |
| Daily Steps = steps field without sport | Task 4 |
| Scoring formulas + floor rules | Task 2 |
| GET /api/leaderboard with rank + trend | Task 5 |
| GET /api/users/{id}/dashboard | Task 6 |
| Angular leaderboard view | Task 9 |
| Angular personal dashboard view | Task 10 |
| Charts: activity over time | Task 10 |
| Charts: sport breakdown | Task 10 |
| Bonus: streak indicator | Task 10 |
| README with setup instructions | Task 11 |
