using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sport4You.Api.Data;
using Sport4You.Tests.Helpers;

namespace Sport4You.Tests;

public class AchievementSeedTests : IClassFixture<TestFactory>
{
    private readonly TestFactory _factory;
    public AchievementSeedTests(TestFactory factory) => _factory = factory;

    [Fact]
    public async Task Seed_Creates33Achievements()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var count = await db.Achievements.CountAsync();
        Assert.Equal(33, count);
    }
}
