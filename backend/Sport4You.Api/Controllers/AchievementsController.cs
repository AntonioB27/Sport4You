using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class AchievementsController : ControllerBase
{
    private readonly IAchievementService _achievements;
    private readonly IXpService _xp;

    public AchievementsController(IAchievementService achievements, IXpService xp)
    {
        _achievements = achievements;
        _xp = xp;
    }

    [HttpGet("achievements")]
    public async Task<IActionResult> GetAchievements(Guid userId)
    {
        var achievements = await _achievements.GetUserAchievementsAsync(userId);
        var xpSummary = await _xp.GetXpSummaryAsync(userId);
        var xpDto = new XpDto(
            xpSummary.TotalXp,
            xpSummary.LevelInfo.Level,
            xpSummary.LevelInfo.Title,
            xpSummary.LevelInfo.XpInLevel,
            xpSummary.LevelInfo.XpForNextLevel,
            xpSummary.LevelInfo.XpPercent);

        return Ok(new AchievementsPageDto(xpDto, achievements));
    }
}
