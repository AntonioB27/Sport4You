using Microsoft.AspNetCore.Mvc;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/ai")]
public class AiController : ControllerBase
{
    private readonly IConfiguration _config;
    public AiController(IConfiguration config) => _config = config;

    /// <summary>"ai" when an Anthropic key is configured, otherwise "basic" (regex fallback).</summary>
    [HttpGet("status")]
    public IActionResult Status()
    {
        var hasKey = !string.IsNullOrWhiteSpace(_config["Anthropic:ApiKey"]);
        return Ok(new { mode = hasKey ? "ai" : "basic" });
    }
}
