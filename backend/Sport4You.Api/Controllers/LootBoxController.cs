using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Data;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}/boxes")]
public class LootBoxController : ControllerBase
{
    private readonly AppDbContext _db;

    public LootBoxController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult> GetBoxes(Guid userId)
    {
        // Check if user exists
        var userExists = await _db.Users.AnyAsync(u => u.Id == userId);
        if (!userExists)
            return NotFound();

        // Count pending loot boxes (unopened)
        var pendingCount = await _db.LootBoxes
            .CountAsync(lb => lb.UserId == userId && lb.OpenedAt == null);

        return Ok(new { pendingCount });
    }
}
