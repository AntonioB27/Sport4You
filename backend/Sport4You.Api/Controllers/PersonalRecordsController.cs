using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class PersonalRecordsController : ControllerBase
{
    private readonly IPersonalRecordsService _records;

    public PersonalRecordsController(IPersonalRecordsService records)
    {
        _records = records;
    }

    [HttpGet("personal-records")]
    public async Task<IActionResult> GetPersonalRecords(Guid userId)
    {
        var result = await _records.GetRecordsAsync(userId);
        return Ok(result);
    }
}
