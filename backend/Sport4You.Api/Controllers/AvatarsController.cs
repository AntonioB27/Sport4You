// backend/Sport4You.Api/Controllers/AvatarsController.cs
using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class AvatarsController : ControllerBase
{
    private readonly IAvatarService _avatars;
    public AvatarsController(IAvatarService avatars) => _avatars = avatars;

    [HttpGet("avatars")]
    public async Task<IActionResult> GetAvatars(Guid userId)
        => Ok(await _avatars.GetUserAvatarsAsync(userId));

    [HttpPut("avatar")]
    public async Task<IActionResult> SetActiveAvatar(Guid userId, [FromBody] SetActiveAvatarRequest request)
    {
        var success = await _avatars.SetActiveAvatarAsync(userId, request.AvatarId);
        return success ? Ok() : NotFound(new { error = "Avatar not found or not yet unlocked" });
    }
}
