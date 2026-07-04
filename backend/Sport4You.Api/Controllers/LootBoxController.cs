using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;
using System.Security.Claims;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class LootBoxController : ControllerBase
{
    private readonly ILootBoxService _lootBox;
    private readonly IBorderService _borders;
    private readonly IXpService _xp;

    public LootBoxController(ILootBoxService lootBox, IBorderService borders, IXpService xp)
    {
        _lootBox = lootBox;
        _borders = borders;
        _xp = xp;
    }

    [HttpGet("boxes")]
    public async Task<IActionResult> GetBoxes(Guid userId)
    {
        var pendingCount = await _lootBox.GetPendingCountAsync(userId);
        return Ok(new { pendingCount });
    }

    [HttpPost("boxes/open")]
    [Authorize]
    public async Task<IActionResult> OpenBox(Guid userId)
    {
        var sub = User.FindFirstValue("sub");
        if (sub == null || sub != userId.ToString())
            return Forbid();

        try
        {
            var result = await _lootBox.OpenBoxAsync(userId);
            if (result.WasDuplicate && result.DuplicateXpAwarded > 0)
                await _xp.AwardGenericXpAsync(userId, result.DuplicateXpAwarded,
                    "loot_box_duplicate", Guid.NewGuid());
            return Ok(result);
        }
        catch (InvalidOperationException)
        {
            return BadRequest(new { error = "No pending boxes" });
        }
    }

    [HttpGet("borders")]
    public async Task<IActionResult> GetBorders(Guid userId)
        => Ok(await _borders.GetUserBordersAsync(userId));

    [HttpPut("border")]
    [Authorize]
    public async Task<IActionResult> SetActiveBorder(Guid userId, [FromBody] SetActiveBorderRequest request)
    {
        var sub = User.FindFirstValue("sub");
        if (sub == null || sub != userId.ToString())
            return Forbid();

        var success = await _borders.SetActiveBorderAsync(userId, request.BorderId);
        return success ? NoContent() : NotFound(new { error = "Border not found or not yet unlocked" });
    }
}
