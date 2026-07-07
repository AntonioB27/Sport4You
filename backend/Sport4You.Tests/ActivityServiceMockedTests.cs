using Moq;
using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Sport4You.Api.Repositories;
using Sport4You.Api.Services;

namespace Sport4You.Tests;

/// <summary>
/// True isolated unit tests for ActivityService.LogDailyStepsAsync — every collaborator is
/// mocked, no database involved. Complements (does not replace) the real-DB integration
/// tests for the same method elsewhere in this project.
/// </summary>
public class ActivityServiceMockedTests
{
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IActivityRepository> _activities = new();
    private readonly Mock<IScoringService> _scoring = new();
    private readonly Mock<IXpService> _xp = new();
    private readonly Mock<IAchievementService> _achievements = new();
    private readonly Mock<IAvatarService> _avatars = new();
    private readonly Mock<ILootBoxService> _lootBox = new();
    private readonly Mock<IShopService> _shop = new();

    private ActivityService BuildSut() => new(
        _users.Object, _activities.Object, _scoring.Object, _xp.Object,
        _achievements.Object, _avatars.Object, _lootBox.Object, _shop.Object);

    [Fact]
    public async Task LogDailyStepsAsync_UserNotFound_ReturnsNotFoundWithoutTouchingRepository()
    {
        _users.Setup(u => u.GetByIdAsync(It.IsAny<Guid>())).ReturnsAsync((User?)null);

        var result = await BuildSut().LogDailyStepsAsync(Guid.NewGuid(), 500);

        Assert.True(result.IsNotFound);
        _activities.Verify(a => a.GetByUserIdAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100001)]
    public async Task LogDailyStepsAsync_InvalidStepCount_ReturnsBadRequestWithoutHittingRepository(int steps)
    {
        var result = await BuildSut().LogDailyStepsAsync(Guid.NewGuid(), steps);

        Assert.True(result.IsError);
        _users.Verify(u => u.GetByIdAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task LogDailyStepsAsync_NewStreakDay_AwardsXpCoinsAndLootBox()
    {
        var userId = Guid.NewGuid();
        _users.Setup(u => u.GetByIdAsync(userId))
            .ReturnsAsync(new User { Id = userId, FirstName = "Test", LastName = "User" });
        _activities.Setup(a => a.GetByUserIdAsync(userId)).ReturnsAsync(new List<Activity>());
        _activities.Setup(a => a.CreateAsync(It.IsAny<Activity>())).ReturnsAsync(new Activity());

        _scoring.Setup(s => s.CalculatePoints("daily_steps", null, null, 2000)).Returns(20);
        _scoring.Setup(s => s.CalculatePoints("daily_steps", null, null, 0)).Returns(0);
        _xp.Setup(x => x.CalculateActivityXp("daily_steps", null, null, 2000)).Returns(10);
        _xp.Setup(x => x.CalculateActivityXp("daily_steps", null, null, 0)).Returns(0);
        _xp.Setup(x => x.EvaluateDailyMissionsAsync(userId, It.IsAny<DateOnly>()))
            .ReturnsAsync(new MissionEvaluationResult(new List<CompletedMissionDto>(), 0));
        _achievements.Setup(a => a.EvaluateAchievementsAsync(userId))
            .ReturnsAsync(new List<UnlockedAchievementDto>());
        _avatars.Setup(a => a.EvaluateAvatarsAsync(userId))
            .ReturnsAsync(new List<UnlockedAvatarDto>());

        var result = await BuildSut().LogDailyStepsAsync(userId, 2000);

        Assert.False(result.IsError);
        Assert.Equal(2000, result.TodayTotalSteps);
        Assert.Equal(20, result.PointsEarned);
        _xp.Verify(x => x.AwardGenericXpAsync(userId, 10, "activity", It.IsAny<Guid>()), Times.Once);
        _shop.Verify(s => s.AddCoinsAsync(userId, 2), Times.Once);
        _lootBox.Verify(l => l.EarnBoxAsync(userId, "streak"), Times.Once);
        _activities.Verify(a => a.CreateAsync(It.IsAny<Activity>()), Times.Once);
        _activities.Verify(a => a.UpdateAsync(It.IsAny<Activity>()), Times.Never);
    }

    [Fact]
    public async Task LogDailyStepsAsync_SameDaySecondEntry_DoesNotAwardAnotherStreakBox()
    {
        var userId = Guid.NewGuid();
        var todayRow = new Activity
        {
            Id = Guid.NewGuid(), UserId = userId, Sport = "daily_steps",
            DateTime = DateTime.UtcNow, Steps = 1000, Points = 10,
        };
        _users.Setup(u => u.GetByIdAsync(userId))
            .ReturnsAsync(new User { Id = userId, FirstName = "Test", LastName = "User" });
        _activities.Setup(a => a.GetByUserIdAsync(userId)).ReturnsAsync(new List<Activity> { todayRow });

        _scoring.Setup(s => s.CalculatePoints("daily_steps", null, null, 1500)).Returns(15);
        _scoring.Setup(s => s.CalculatePoints("daily_steps", null, null, 1000)).Returns(10);
        _xp.Setup(x => x.CalculateActivityXp("daily_steps", null, null, 1500)).Returns(0);
        _xp.Setup(x => x.CalculateActivityXp("daily_steps", null, null, 1000)).Returns(0);
        _xp.Setup(x => x.EvaluateDailyMissionsAsync(userId, It.IsAny<DateOnly>()))
            .ReturnsAsync(new MissionEvaluationResult(new List<CompletedMissionDto>(), 0));
        _achievements.Setup(a => a.EvaluateAchievementsAsync(userId))
            .ReturnsAsync(new List<UnlockedAchievementDto>());
        _avatars.Setup(a => a.EvaluateAvatarsAsync(userId))
            .ReturnsAsync(new List<UnlockedAvatarDto>());

        var result = await BuildSut().LogDailyStepsAsync(userId, 500);

        Assert.False(result.IsError);
        Assert.Equal(1500, result.TodayTotalSteps);
        _activities.Verify(a => a.UpdateAsync(It.IsAny<Activity>()), Times.Once);
        _activities.Verify(a => a.CreateAsync(It.IsAny<Activity>()), Times.Never);
        _lootBox.Verify(l => l.EarnBoxAsync(userId, "streak"), Times.Never);
    }
}
