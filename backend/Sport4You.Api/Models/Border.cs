namespace Sport4You.Api.Models;

public class Border
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Rarity { get; set; } = string.Empty;  // "common" | "rare" | "legendary"
    public string BorderCss { get; set; } = string.Empty;
    public string ImagePath { get; set; } = string.Empty;
}
