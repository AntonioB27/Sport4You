// backend/Sport4You.Api/Services/ActivityService.cs
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
    private readonly IAchievementService _achievements;
    private readonly IAvatarService _avatars;
    private readonly ILootBoxService _lootBox;
    private readonly IShopService _shop;

    public ActivityService(
        IUserRepository users, IActivityRepository activities,
        IScoringService scoring, IXpService xp,
        IAchievementService achievements, IAvatarService avatars,
        ILootBoxService lootBox, IShopService shop)
    {
        _users = users;
        _activities = activities;
        _scoring = scoring;
        _xp = xp;
        _achievements = achievements;
        _avatars = avatars;
        _lootBox = lootBox;
        _shop = shop;
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

        // Daily Steps is one of the required sports and the assignment's schema lists `steps`
        // as a field of this endpoint — accept it here too, delegating to the same accumulator
        // used by the dedicated POST /users/{userId}/steps endpoint so a day's total steps
        // stay consistent regardless of which endpoint a caller used.
        if (request.Sport == null && request.Steps.HasValue)
        {
            var stepsResult = await LogDailyStepsAsync(userId, request.Steps.Value);
            return stepsResult.IsError
                ? (stepsResult.IsNotFound
                    ? ActivityResult.NotFound(stepsResult.Error!)
                    : ActivityResult.BadRequest(stepsResult.Error!))
                : ActivityResult.Success(
                    Guid.Empty, stepsResult.PointsEarned, stepsResult.XpEarned,
                    stepsResult.MissionsCompleted, stepsResult.AchievementsUnlocked, stepsResult.AvatarsUnlocked);
        }

        var (isValid, error, sport) = ValidateSportMetrics(request);
        if (!isValid)
            return ActivityResult.BadRequest(error!);

        var points = _scoring.CalculatePoints(sport, request.Distance, request.Duration, request.Steps);

        // Capture existing activities before creating the new one (for streak comparison)
        var previousActivities = await _activities.GetByUserIdAsync(userId);
        var prevStreak = ActivityStreakHelper.ComputeCurrentStreak(previousActivities.Select(a => a.DateTime));

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

        var xpAward = await _xp.AwardActivityXpAsync(
            userId, activity.Id, sport, request.Distance, request.Duration, request.Steps);
        var xpEarned = xpAward.XpEarned;

        var coinsEarned = points / 10;
        if (coinsEarned > 0)
            await _shop.AddCoinsAsync(userId, coinsEarned);

        var missionResult = await _xp.EvaluateDailyMissionsAsync(
            userId, DateOnly.FromDateTime(dateTime.ToUniversalTime()));

        var newAchievements = await _achievements.EvaluateAchievementsAsync(userId);
        var newAvatars = await _avatars.EvaluateAvatarsAsync(userId);

        // Award a streak box if today extended the streak (idempotent inside EarnBoxAsync)
        var newStreak = ActivityStreakHelper.ComputeCurrentStreak(
            previousActivities.Concat(new[] { activity }).Select(a => a.DateTime));
        if (newStreak > prevStreak)
            await _lootBox.EarnBoxAsync(userId, "streak");

        return ActivityResult.Success(
            activity.Id, points, xpEarned,
            missionResult.NewlyCompleted, newAchievements, newAvatars);
    }

    public async Task<StepsResult> LogDailyStepsAsync(Guid userId, int steps)
    {
        if (steps <= 0 || steps > 100_000)
            return StepsResult.BadRequest("Steps must be between 1 and 100000");

        var user = await _users.GetByIdAsync(userId);
        if (user == null)
            return StepsResult.NotFound("User not found");

        var now = DateTime.UtcNow;
        var todayStart = now.Date;
        var todayEnd = todayStart.AddDays(1);

        // Capture existing activities before mutating (for streak comparison)
        var previousActivities = await _activities.GetByUserIdAsync(userId);
        var prevStreak = ActivityStreakHelper.ComputeCurrentStreak(previousActivities.Select(a => a.DateTime));

        var todayRow = previousActivities.FirstOrDefault(a =>
            a.Sport == "daily_steps" && a.DateTime >= todayStart && a.DateTime < todayEnd);

        var oldTotal = todayRow?.Steps ?? 0;
        var newTotal = oldTotal + steps;

        var pointsEarned = _scoring.CalculatePoints("daily_steps", null, null, newTotal)
                         - _scoring.CalculatePoints("daily_steps", null, null, oldTotal);
        var xpEarned = _xp.CalculateActivityXp("daily_steps", null, null, newTotal)
                     - _xp.CalculateActivityXp("daily_steps", null, null, oldTotal);

        Activity row;
        if (todayRow != null)
        {
            todayRow.Steps = newTotal;
            todayRow.Points = _scoring.CalculatePoints("daily_steps", null, null, newTotal);
            todayRow.DateTime = now;
            await _activities.UpdateAsync(todayRow);
            row = todayRow;
        }
        else
        {
            row = new Activity
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DateTime = now,
                Sport = "daily_steps",
                Distance = null,
                Duration = null,
                Steps = newTotal,
                Points = _scoring.CalculatePoints("daily_steps", null, null, newTotal),
            };
            await _activities.CreateAsync(row);
        }

        if (xpEarned > 0)
            await _xp.AwardGenericXpAsync(userId, xpEarned, "activity", row.Id);

        var stepsCoinsEarned = pointsEarned / 10;
        if (stepsCoinsEarned > 0)
            await _shop.AddCoinsAsync(userId, stepsCoinsEarned);

        var missionResult = await _xp.EvaluateDailyMissionsAsync(
            userId, DateOnly.FromDateTime(now));

        var newAchievements = await _achievements.EvaluateAchievementsAsync(userId);
        var newAvatars = await _avatars.EvaluateAvatarsAsync(userId);

        // Streak box only if today extended the streak (a same-day second entry does not)
        var updatedActivities = todayRow != null
            ? previousActivities
            : previousActivities.Concat(new[] { row });
        var newStreak = ActivityStreakHelper.ComputeCurrentStreak(updatedActivities.Select(a => a.DateTime));
        if (newStreak > prevStreak)
            await _lootBox.EarnBoxAsync(userId, "streak");

        return StepsResult.Success(
            newTotal, pointsEarned, xpEarned,
            missionResult.NewlyCompleted, newAchievements, newAvatars);
    }

    private static (bool isValid, string? error, string sport) ValidateSportMetrics(LogActivityRequest r)
    {
        var sport = r.Sport?.ToLower();

        if (sport == null && r.Steps == null)
            return (false, "Either sport or steps must be provided", string.Empty);

        // sport == null && steps.HasValue (daily steps) is handled earlier in
        // LogActivityAsync before this validator runs.

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
