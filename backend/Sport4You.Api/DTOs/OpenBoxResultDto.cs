namespace Sport4You.Api.DTOs;

public record OpenBoxResultDto(
    string Type,
    string Rarity,
    string Name,
    string ImagePath,
    bool WasDuplicate,
    int DuplicateXpAwarded,
    int RemainingBoxes);
