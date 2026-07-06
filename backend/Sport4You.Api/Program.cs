using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;
using Sport4You.Api.Repositories;
using Sport4You.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=sport4you.db"));

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IActivityRepository, ActivityRepository>();
builder.Services.AddScoped<IScoringService, ScoringService>();
builder.Services.AddScoped<IActivityService, ActivityService>();
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

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();
app.UseCors();
app.UseMiddleware<Sport4You.Api.Middleware.ExceptionMiddleware>();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var scoring = scope.ServiceProvider.GetRequiredService<IScoringService>();
    db.Database.EnsureCreated();
    DataSeeder.Seed(db, scoring);
}

app.Run();

public partial class Program { }
