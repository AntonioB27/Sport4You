using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private static readonly HashSet<string> ValidPeriods = ["7d", "30d", "all"];
    private static readonly HashSet<string> ValidSports =
        ["all", "running", "walking", "cycling", "swimming", "gym", "daily_steps"];

    private readonly ILeaderboardService _leaderboard;
    public LeaderboardController(ILeaderboardService leaderboard) => _leaderboard = leaderboard;

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string period = "all", [FromQuery] string sport = "all")
    {
        period = period.ToLower();
        sport = sport.ToLower();

        if (!ValidPeriods.Contains(period))
            return BadRequest(new { error = $"Invalid period: '{period}'. Must be one of: 7d, 30d, all." });
        if (!ValidSports.Contains(sport))
            return BadRequest(new { error = $"Invalid sport: '{sport}'. Must be one of: all, running, walking, cycling, swimming, gym, daily_steps." });

        return Ok(await _leaderboard.GetLeaderboardAsync(period, sport));
    }
}
