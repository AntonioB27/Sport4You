using Microsoft.AspNetCore.Mvc;
using Sport4You.Api.DTOs;
using Sport4You.Api.Services;

namespace Sport4You.Api.Controllers;

[ApiController]
[Route("api/users/{userId}")]
public class ShopController : ControllerBase
{
    private readonly IShopService _shop;
    public ShopController(IShopService shop) => _shop = shop;

    [HttpPost("shop/booster")]
    public async Task<IActionResult> PurchaseBooster(Guid userId)
    {
        var result = await _shop.PurchaseBoosterAsync(userId);
        return result.Success ? Ok(result) : BadRequest(new { error = result.Error });
    }

    [HttpPost("shop/lootbox")]
    public async Task<IActionResult> PurchaseLootBox(Guid userId, [FromBody] PurchaseLootBoxRequest request)
    {
        var result = await _shop.PurchaseLootBoxAsync(userId, request.Tier);
        return result.Success ? Ok(result) : BadRequest(new { error = result.Error });
    }
}
