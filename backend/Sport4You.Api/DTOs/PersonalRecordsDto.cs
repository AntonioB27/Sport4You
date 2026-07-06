namespace Sport4You.Api.DTOs;

public record SportRecordDto(string Sport, decimal? BestDistance, string? BestDuration, int? BestSteps, DateTime AchievedAt);

public record PersonalRecordsDto(
    List<SportRecordDto> SportRecords,
    int BestDayPoints,
    DateTime? BestDayDate,
    int LongestStreakEver);
