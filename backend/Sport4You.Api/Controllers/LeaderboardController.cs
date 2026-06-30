using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaderboardController : ControllerBase
{
    private readonly ILeaderboardService _leaderboard;
    public LeaderboardController(ILeaderboardService leaderboard) => _leaderboard = leaderboard;

    [HttpGet]
    public async Task<IActionResult> Get() => Ok(await _leaderboard.GetLeaderboardAsync());
}
