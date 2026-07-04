using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IDashboardService _dashboard;
    private readonly IActivityService _activities;
    private readonly IXpService _xp;
    private readonly IWeightService _weight;

    public UsersController(IDashboardService dashboard, IActivityService activities, IXpService xp, IWeightService weight)
    {
        _dashboard = dashboard;
        _activities = activities;
        _xp = xp;
        _weight = weight;
    }

    [HttpGet("{userId}/dashboard")]
    public async Task<IActionResult> GetDashboard(Guid userId)
    {
        var dashboard = await _dashboard.GetDashboardAsync(userId);
        if (dashboard == null)
            return NotFound(new { error = "User not found" });
        return Ok(dashboard);
    }

    [HttpPost("{userId}/steps")]
    public async Task<IActionResult> AddSteps(Guid userId, [FromBody] LogStepsRequest request)
    {
        var result = await _activities.LogDailyStepsAsync(userId, request.Steps);
        if (result.IsNotFound)
            return NotFound(new { error = result.Error });
        if (result.IsError)
            return BadRequest(new { error = result.Error });
        return Ok(new
        {
            todayTotalSteps = result.TodayTotalSteps,
            pointsEarned = result.PointsEarned,
            xpEarned = result.XpEarned,
            missionsCompleted = result.MissionsCompleted,
            achievementsUnlocked = result.AchievementsUnlocked,
            avatarsUnlocked = result.AvatarsUnlocked,
        });
    }

    [HttpPost("{userId}/prestige")]
    public async Task<IActionResult> Prestige(Guid userId)
    {
        var result = await _xp.PrestigeAsync(userId);
        if (!result.Success) return BadRequest(new { error = result.Error });
        var s = result.Summary!;
        return Ok(new
        {
            totalXp = s.TotalXp,
            level = s.LevelInfo.Level,
            levelTitle = s.LevelInfo.Title,
            xpInLevel = s.LevelInfo.XpInLevel,
            xpForNextLevel = s.LevelInfo.XpForNextLevel,
            xpPercent = s.LevelInfo.XpPercent,
            prestigeLevel = await _xp.GetPrestigeLevelAsync(userId),
        });
    }

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
}
