using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;
using System.Security.Claims;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ActivitiesController : ControllerBase
{
    private readonly IActivityService _activities;
    private readonly IActivityParser _parser;
    private readonly IScoringService _scoring;

    public ActivitiesController(IActivityService activities, IActivityParser parser, IScoringService scoring)
    {
        _activities = activities;
        _parser = parser;
        _scoring = scoring;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> LogActivity([FromBody] LogActivityRequest request)
    {
        var sub = User.FindFirstValue("sub");
        if (sub == null || sub != request.UserId.ToString())
            return Forbid();

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
            boostApplied = result.BoostApplied,
            missionsCompleted = result.MissionsCompleted,
            achievementsUnlocked = result.AchievementsUnlocked,
            avatarsUnlocked = result.AvatarsUnlocked,
        });
    }

    /// <summary>Interprets free text into a draft activity. Does NOT log anything.</summary>
    [HttpPost("parse")]
    public async Task<IActionResult> Parse([FromBody] ParseActivityRequest request)
    {
        // Cap input length to guard against abuse / runaway tokens.
        var text = request.Text.Length > 300 ? request.Text[..300] : request.Text;
        var parsed = await _parser.ParseAsync(text);
        return Ok(ParseResultMapper.ToDto(parsed, _scoring));
    }
}
