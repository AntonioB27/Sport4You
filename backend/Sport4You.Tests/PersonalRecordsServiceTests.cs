using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Data;
using Sport4You.Api.Models;
using Sport4You.Api.Services;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class PersonalRecordsServiceTests : IClassFixture<TestFactory>
{
    private readonly TestFactory _factory;

    public PersonalRecordsServiceTests(TestFactory factory)
    {
        _factory = factory;
    }

    private (IPersonalRecordsService service, AppDbContext db, Guid userId) CreateScope()
    {
        var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var service = scope.ServiceProvider.GetRequiredService<IPersonalRecordsService>();
        var user = new User { Id = Guid.NewGuid(), FirstName = $"Test{Guid.NewGuid():N}", LastName = "User" };
        db.Users.Add(user);
        db.SaveChanges();
        return (service, db, user.Id);
    }

    [Fact]
    public async Task GetRecordsAsync_NoActivities_ReturnsEmptyDefaults()
    {
        var (service, _, userId) = CreateScope();

        var result = await service.GetRecordsAsync(userId);

        Assert.Empty(result.SportRecords);
        Assert.Equal(0, result.BestDayPoints);
        Assert.Null(result.BestDayDate);
        Assert.Equal(0, result.LongestStreakEver);
    }

    [Fact]
    public async Task GetRecordsAsync_MultipleSports_ReturnsBestPerSport()
    {
        var (service, db, userId) = CreateScope();
        db.Activities.AddRange(
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 1), Sport = "running", Distance = 5.0m, Points = 500 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 2), Sport = "running", Distance = 10.2m, Points = 1020 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 3), Sport = "swimming", Duration = "30:00", Points = 450 }
        );
        db.SaveChanges();

        var result = await service.GetRecordsAsync(userId);

        var running = result.SportRecords.Single(r => r.Sport == "running");
        Assert.Equal(10.2m, running.BestDistance);
        Assert.Equal(new DateTime(2026, 1, 2), running.AchievedAt);

        var swimming = result.SportRecords.Single(r => r.Sport == "swimming");
        Assert.Equal("30:00", swimming.BestDuration);
    }

    [Fact]
    public async Task GetRecordsAsync_DurationComparedAsSeconds_PicksLongerDuration()
    {
        var (service, db, userId) = CreateScope();
        // 9:50 is shorter than 10:05 in total seconds, despite "9" > "1"
        // lexicographically — proves duration comparison is numeric, not string.
        db.Activities.AddRange(
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 1), Sport = "gym", Duration = "9:50", Points = 50 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 1, 2), Sport = "gym", Duration = "10:05", Points = 51 }
        );
        db.SaveChanges();

        var result = await service.GetRecordsAsync(userId);

        var gym = result.SportRecords.Single(r => r.Sport == "gym");
        Assert.Equal("10:05", gym.BestDuration);
    }

    [Fact]
    public async Task GetRecordsAsync_MultipleActivitiesSameDay_SumsIntoBestDay()
    {
        var (service, db, userId) = CreateScope();
        var day = new DateTime(2026, 2, 10);
        db.Activities.AddRange(
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = day.AddHours(7), Sport = "running", Distance = 5.0m, Points = 500 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = day.AddHours(18), Sport = "cycling", Distance = 20.0m, Points = 500 },
            new Activity { Id = Guid.NewGuid(), UserId = userId, DateTime = new DateTime(2026, 2, 11), Sport = "running", Distance = 1.0m, Points = 100 }
        );
        db.SaveChanges();

        var result = await service.GetRecordsAsync(userId);

        Assert.Equal(1000, result.BestDayPoints);
        Assert.Equal(day.Date, result.BestDayDate);
    }

    [Fact]
    public async Task GetRecordsAsync_ReturnsLongestStreakEver()
    {
        var (service, db, userId) = CreateScope();
        var activities = new List<Activity>();
        for (var i = 0; i < 4; i++)
        {
            activities.Add(new Activity
            {
                Id = Guid.NewGuid(), UserId = userId,
                DateTime = new DateTime(2026, 1, 1).AddDays(i),
                Sport = "walking", Distance = 1.0m, Points = 50,
            });
        }
        db.Activities.AddRange(activities);
        db.SaveChanges();

        var result = await service.GetRecordsAsync(userId);

        Assert.Equal(4, result.LongestStreakEver);
    }
}
