namespace Sport4You.Api.DTOs;

public class LeaderboardEntryDto
{
    public int Rank { get; set; }
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int TotalPoints { get; set; }
    public int RankTrend { get; set; }
}
