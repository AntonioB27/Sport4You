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
        if (result.IsNotFound)
            return NotFound(new { error = result.Error });
        if (result.IsError)
            return BadRequest(new { error = result.Error });
        return Ok(new
        {
            activityId = result.ActivityId,
            points = result.Points,
            xpEarned = result.XpEarned,
            missionsCompleted = result.MissionsCompleted,
            achievementsUnlocked = result.AchievementsUnlocked,
            avatarsUnlocked = result.AvatarsUnlocked,
        });
    }
}
