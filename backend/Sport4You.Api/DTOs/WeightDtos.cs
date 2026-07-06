namespace Sport4You.Api.DTOs;

public record WeightEntryDto(string Date, decimal WeightKg);
public record WeightHistoryDto(List<WeightEntryDto> Entries, decimal? GoalKg);

public class LogWeightRequest
{
    public decimal WeightKg { get; set; }
}

public class SetWeightGoalRequest
{
    public decimal GoalKg { get; set; }
}
