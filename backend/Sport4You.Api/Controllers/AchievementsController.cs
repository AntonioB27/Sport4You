using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class AchievementsController : ControllerBase
{
    private readonly IAchievementService _achievements;
    public AchievementsController(IAchievementService achievements)
        => _achievements = achievements;

    [HttpGet("achievements")]
    public async Task<IActionResult> GetAchievements(Guid userId)
    {
        var result = await _achievements.GetUserAchievementsAsync(userId);
        return Ok(result);
    }
}
