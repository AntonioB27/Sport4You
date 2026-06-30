using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _users;
    private readonly IDashboardService _dashboard;

    public UsersController(IUserService users, IDashboardService dashboard)
    {
        _users = users;
        _dashboard = dashboard;
    }

    [HttpPost]
    public async Task<IActionResult> Register([FromBody] RegisterUserRequest request)
    {
        var result = await _users.RegisterAsync(request);
        if (result.IsConflict)
            return Conflict(new { error = result.Error });
        return Ok(new { userId = result.UserId });
    }

    [HttpGet("{userId}/dashboard")]
    public async Task<IActionResult> GetDashboard(Guid userId)
    {
        var dashboard = await _dashboard.GetDashboardAsync(userId);
        if (dashboard == null)
            return NotFound(new { error = "User not found" });
        return Ok(dashboard);
    }
}
