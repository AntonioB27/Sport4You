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
    private readonly IActivityService _activities;
    private readonly IXpService _xp;

    public UsersController(IUserService users, IDashboardService dashboard, IActivityService activities, IXpService xp)
    {
        _users = users;
        _dashboard = dashboard;
        _activities = activities;
        _xp = xp;
    }

    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterUserRequest request)
    {
        var result = await _users.RegisterAsync(request);
        if (result.IsConflict)
            return Conflict(new { error = result.Error });
        return Ok(new { userId = result.UserId });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] RegisterUserRequest request)
    {
        var user = await _users.FindByNameAsync(request.FirstName, request.LastName);
        if (user == null)
            return NotFound(new { error = "No user found with that name." });
        return Ok(new { userId = user.Id, firstName = user.FirstName, lastName = user.LastName });
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
}
