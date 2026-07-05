namespace Sport4You.Api.DTOs;

public class DashboardDto
{
    public UserInfoDto User { get; set; } = new();
    public int TotalPoints { get; set; }
    public int Rank { get; set; }
    public int CurrentStreak { get; set; }
    public int TodaySteps { get; set; }
    public List<ActivityDto> Activities { get; set; } = [];
    public List<PointsOverTimeDto> PointsOverTime { get; set; } = [];
    public List<SportBreakdownDto> SportBreakdown { get; set; } = [];
    public XpDto Xp { get; set; } = new();
    public List<DailyMissionDto> DailyMissions { get; set; } = [];
    public List<AchievementStatusDto> RecentAchievements { get; set; } = [];
    public AvatarStatusDto? ActiveAvatar { get; set; }
    public string? ActiveBorderCss { get; set; }
    public RivalStatusDto? RivalStatus { get; set; }
}

public class UserInfoDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
}

public class ActivityDto
{
    public Guid Id { get; set; }
    public string DateTime { get; set; } = string.Empty;
    public string Sport { get; set; } = string.Empty;
    public decimal? Distance { get; set; }
    public string? Duration { get; set; }
    public int? Steps { get; set; }
    public int Points { get; set; }
}

public class PointsOverTimeDto
{
    public string Date { get; set; } = string.Empty;
    public int Points { get; set; }
}

public class SportBreakdownDto
{
    public string Sport { get; set; } = string.Empty;
    public int Points { get; set; }
}

public record CompletedMissionDto(string Description, int XpEarned);

public record XpDto(
    int Total, int Level, string LevelTitle,
    int XpInLevel, int XpForNextLevel, int XpPercent)
{
    public XpDto() : this(0, 0, string.Empty, 0, 0, 0) { }
}

public record DailyMissionDto(
    Guid Id, string Tier, string Description, int XpReward,
    bool Completed, double Progress, double ProgressMax);
