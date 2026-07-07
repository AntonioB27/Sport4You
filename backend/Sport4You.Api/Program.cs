using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;
using Sport4You.Api.Data;
using Sport4You.Api.Repositories;
using Sport4You.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) => configuration
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console());

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
    c.SwaggerDoc("v1", new() { Title = "Sport4You API", Version = "v1" }));
// Connection string is configurable (e.g. ConnectionStrings__Default in Docker,
// pointing at a mounted volume); falls back to a local file for `dotnet run`.
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Data Source=sport4you.db";
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IActivityRepository, ActivityRepository>();
builder.Services.AddScoped<IScoringService, ScoringService>();
builder.Services.AddScoped<IActivityService, ActivityService>();

builder.Services.AddScoped<RegexActivityParser>();

var anthropicKey = builder.Configuration["Anthropic:ApiKey"];
if (string.IsNullOrWhiteSpace(anthropicKey))
{
    builder.Services.AddScoped<IActivityParser>(sp => sp.GetRequiredService<RegexActivityParser>());
}
else
{
    builder.Services.AddHttpClient<ClaudeActivityParser>();
    builder.Services.AddScoped<IActivityParser>(sp => sp.GetRequiredService<ClaudeActivityParser>());
}
builder.Services.AddScoped<ILeaderboardService, LeaderboardService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IXpService, XpService>();
builder.Services.AddScoped<IAchievementService, AchievementService>();
builder.Services.AddScoped<IAvatarService, AvatarService>();
builder.Services.AddScoped<IBorderService, BorderService>();
builder.Services.AddScoped<ILootBoxService, LootBoxService>();
builder.Services.AddScoped<IRivalService, RivalService>();
builder.Services.AddScoped<IPersonalRecordsService, PersonalRecordsService>();
builder.Services.AddScoped<IShopService, ShopService>();
builder.Services.AddScoped<IWeightService, WeightService>();

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();
// Enabled in every environment so the API is browsable at /swagger even in the
// Docker container (published on :5262).
app.UseSwagger();
app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Sport4You API v1"));
app.UseCors();
app.UseMiddleware<Sport4You.Api.Middleware.ExceptionMiddleware>();
app.UseSerilogRequestLogging();
app.MapControllers();

// Lightweight liveness/readiness probe (also handy for container orchestration).
app.MapGet("/api/health", async (AppDbContext db) =>
    await db.Database.CanConnectAsync()
        ? Results.Ok(new { status = "healthy" })
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable));

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var scoring = scope.ServiceProvider.GetRequiredService<IScoringService>();
    db.Database.EnsureCreated();
    DataSeeder.Seed(db, scoring);
}

app.Run();

public partial class Program { }
