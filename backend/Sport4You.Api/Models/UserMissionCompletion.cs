namespace Sport4You.Api.Models;

public class UserMissionCompletion
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid MissionId { get; set; }
    public DailyMission Mission { get; set; } = null!;
    public string Date { get; set; } = string.Empty;  // "yyyy-MM-dd"
    public DateTime CompletedAt { get; set; }
}
