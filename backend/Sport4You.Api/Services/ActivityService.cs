using Sport4You.Api.DTOs;
using Sport4You.Api.Models;
using Sport4You.Api.Repositories;

namespace Sport4You.Api.Services;

public class ActivityService : IActivityService
{
    private static readonly HashSet<string> DistanceSports = ["running", "walking", "cycling"];
    private static readonly HashSet<string> DurationSports = ["gym", "swimming"];

    private readonly IUserRepository _users;
    private readonly IActivityRepository _activities;
    private readonly IScoringService _scoring;
    private readonly IXpService _xp;

    public ActivityService(
        IUserRepository users, IActivityRepository activities,
        IScoringService scoring, IXpService xp)
    {
        _users = users;
        _activities = activities;
        _scoring = scoring;
        _xp = xp;
    }

    public async Task<ActivityResult> LogActivityAsync(LogActivityRequest request)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
            return ActivityResult.BadRequest("Invalid userId format");

        var user = await _users.GetByIdAsync(userId);
        if (user == null)
            return ActivityResult.NotFound("User not found");

        if (!DateTime.TryParse(request.Datetime, out var dateTime))
            return ActivityResult.BadRequest("Invalid datetime format");

        var (isValid, error, sport) = ValidateSportMetrics(request);
        if (!isValid)
            return ActivityResult.BadRequest(error!);

        var points = _scoring.CalculatePoints(sport, request.Distance, request.Duration, request.Steps);

        var activity = new Activity
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DateTime = dateTime,
            Sport = sport,
            Distance = request.Distance,
            Duration = request.Duration,
            Steps = request.Steps,
            Points = points,
        };

        await _activities.CreateAsync(activity);

        var xpEarned = await _xp.AwardActivityXpAsync(
            userId, activity.Id, sport, request.Distance, request.Duration, request.Steps);

        var missionResult = await _xp.EvaluateDailyMissionsAsync(
            userId, DateOnly.FromDateTime(dateTime.ToUniversalTime()));

        return ActivityResult.Success(activity.Id, points, xpEarned, missionResult.NewlyCompleted);
    }

    private static (bool isValid, string? error, string sport) ValidateSportMetrics(LogActivityRequest r)
    {
        var sport = r.Sport?.ToLower();

        if (sport == null && r.Steps == null)
            return (false, "Either sport or steps must be provided", string.Empty);

        if (r.Steps.HasValue && sport == null)
        {
            if (r.Distance.HasValue || r.Duration != null)
                return (false, "Steps activity cannot include distance or duration", string.Empty);
            return (true, null, "daily_steps");
        }

        if (DistanceSports.Contains(sport!))
        {
            if (!r.Distance.HasValue)
                return (false, $"{sport} requires a distance value", string.Empty);
            if (r.Duration != null || r.Steps.HasValue)
                return (false, $"{sport} cannot include duration or steps", string.Empty);
            return (true, null, sport!);
        }

        if (DurationSports.Contains(sport!))
        {
            if (r.Duration == null)
                return (false, $"{sport} requires a duration value", string.Empty);
            if (r.Distance.HasValue || r.Steps.HasValue)
                return (false, $"{sport} cannot include distance or steps", string.Empty);
            if (!IsValidDuration(r.Duration))
                return (false, "Duration must be in mm:ss format", string.Empty);
            return (true, null, sport!);
        }

        return (false, $"Unknown sport: {sport}", string.Empty);
    }

    private static bool IsValidDuration(string duration)
    {
        var parts = duration.Split(':');
        return parts.Length == 2
            && int.TryParse(parts[0], out var minutes) && minutes >= 0
            && int.TryParse(parts[1], out var seconds) && seconds is >= 0 and < 60;
    }
}
