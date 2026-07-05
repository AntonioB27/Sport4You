using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class RivalController : ControllerBase
{
    private readonly IRivalService _rivals;
    public RivalController(IRivalService rivals) => _rivals = rivals;

    [HttpGet("rival")]
    public async Task<IActionResult> GetRival(Guid userId)
        => Ok(new RivalDto(await _rivals.GetRivalUserIdAsync(userId)));

    [HttpPut("rival")]
    public async Task<IActionResult> SetRival(Guid userId, [FromBody] SetRivalRequest request)
    {
        var result = await _rivals.SetRivalAsync(userId, request.RivalUserId);
        if (!result.Success) return BadRequest(new { error = result.Error });
        return Ok();
    }

    [HttpDelete("rival")]
    public async Task<IActionResult> ClearRival(Guid userId)
    {
        await _rivals.ClearRivalAsync(userId);
        return Ok();
    }
}
