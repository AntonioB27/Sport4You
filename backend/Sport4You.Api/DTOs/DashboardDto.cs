namespace Sport4You.Api.DTOs;

public class DashboardDto
{
    public UserInfoDto User { get; set; } = new();
    public int TotalPoints { get; set; }
    public List<ActivityDto> Activities { get; set; } = [];
    public List<PointsOverTimeDto> PointsOverTime { get; set; } = [];
    public List<SportBreakdownDto> SportBreakdown { get; set; } = [];
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
