using Sport4You.Api.Models;
using Sport4You.Api.Services;

namespace Sport4You.Api.Data;

public static class DataSeeder
{
    public static void Seed(AppDbContext db, IScoringService scoring)
    {
        SeedUsers(db, scoring);
        SeedMissions(db);
        SeedAchievements(db);
        SeedAvatars(db);
    }

    private static void SeedUsers(AppDbContext db, IScoringService scoring)
    {
        var seedNames = new[] { "Maria Gonzalez", "James Chen", "Sophie Müller", "Luca Rossi", "Amara Osei" };
        if (db.Users.Any(u => seedNames.Contains(u.FirstName + " " + u.LastName))) return;

        var now = DateTime.UtcNow;

        var users = new[]
        {
            new User { Id = Guid.NewGuid(), FirstName = "Maria",   LastName = "Gonzalez" },
            new User { Id = Guid.NewGuid(), FirstName = "James",   LastName = "Chen"     },
            new User { Id = Guid.NewGuid(), FirstName = "Sophie",  LastName = "Müller"   },
            new User { Id = Guid.NewGuid(), FirstName = "Luca",    LastName = "Rossi"    },
            new User { Id = Guid.NewGuid(), FirstName = "Amara",   LastName = "Osei"     },
        };

        db.Users.AddRange(users);

        var activities = new List<(Guid UserId, int DaysAgo, string Sport, decimal? Distance, string? Duration, int? Steps)>
        {
            (users[0].Id,  0, "running",     10.5m,  null,    null),
            (users[0].Id,  1, "running",      8.0m,  null,    null),
            (users[0].Id,  2, "daily_steps",  null,   null,  12000),
            (users[0].Id,  3, "cycling",     25.0m,  null,    null),
            (users[0].Id,  4, "running",      5.0m,  null,    null),
            (users[0].Id,  5, "running",      6.5m,  null,    null),
            (users[0].Id,  8, "cycling",     30.0m,  null,    null),
            (users[0].Id, 10, "running",     12.0m,  null,    null),
            (users[0].Id, 12, "daily_steps",  null,   null,  15000),
            (users[0].Id, 14, "running",      9.0m,  null,    null),
            (users[1].Id,  0, "gym",         null,  "60:00",  null),
            (users[1].Id,  1, "swimming",    null,  "45:00",  null),
            (users[1].Id,  2, "gym",         null,  "75:00",  null),
            (users[1].Id,  3, "gym",         null,  "60:00",  null),
            (users[1].Id,  5, "swimming",    null,  "30:00",  null),
            (users[1].Id,  6, "gym",         null,  "90:00",  null),
            (users[1].Id,  9, "gym",         null,  "60:00",  null),
            (users[1].Id, 11, "swimming",    null,  "45:00",  null),
            (users[1].Id, 13, "gym",         null,  "75:00",  null),
            (users[2].Id,  0, "walking",      5.0m,  null,    null),
            (users[2].Id,  1, "gym",          null, "45:00",  null),
            (users[2].Id,  2, "running",      4.0m,  null,    null),
            (users[2].Id,  3, "daily_steps",  null,   null,  10000),
            (users[2].Id,  5, "cycling",     15.0m,  null,    null),
            (users[2].Id,  7, "swimming",     null, "30:00",  null),
            (users[2].Id,  9, "walking",      6.0m,  null,    null),
            (users[2].Id, 11, "running",      5.0m,  null,    null),
            (users[3].Id,  0, "cycling",     40.0m,  null,    null),
            (users[3].Id,  2, "walking",      8.0m,  null,    null),
            (users[3].Id,  3, "cycling",     35.0m,  null,    null),
            (users[3].Id,  5, "cycling",     50.0m,  null,    null),
            (users[3].Id,  7, "walking",     10.0m,  null,    null),
            (users[3].Id, 10, "cycling",     20.0m,  null,    null),
            (users[3].Id, 14, "cycling",     45.0m,  null,    null),
            (users[4].Id,  0, "daily_steps",  null,  null,   9000),
            (users[4].Id,  1, "daily_steps",  null,  null,  11000),
            (users[4].Id,  2, "running",      3.0m,  null,    null),
            (users[4].Id,  3, "daily_steps",  null,  null,   8500),
            (users[4].Id,  4, "walking",      4.0m,  null,    null),
            (users[4].Id,  6, "daily_steps",  null,  null,  13000),
            (users[4].Id,  8, "running",      4.0m,  null,    null),
        };

        foreach (var (userId, daysAgo, sport, distance, duration, steps) in activities)
        {
            var points = scoring.CalculatePoints(sport, distance, duration, steps);
            db.Activities.Add(new Activity
            {
                Id       = Guid.NewGuid(),
                UserId   = userId,
                DateTime = now.AddDays(-daysAgo).AddHours(-Random.Shared.Next(0, 8)),
                Sport    = sport,
                Distance = distance,
                Duration = duration,
                Steps    = steps,
                Points   = points,
            });
        }

        db.SaveChanges();
    }

    private static void SeedMissions(AppDbContext db)
    {
        if (db.DailyMissions.Any()) return;

        db.DailyMissions.AddRange(
            // Easy — 75 XP each
            M("easy", "Log any activity today",                       "activity_count",  1,   null,        75),
            M("easy", "Walk at least 2 km",                          "distance_km",     2,   "walking",   75),
            M("easy", "Do 15+ minutes swimming or at the gym",       "total_min",       15,  null,        75),
            M("easy", "Hit 3,000 steps",                             "steps",           3000, null,       75),
            M("easy", "Log a gym session",                           "activity_count",  1,   "gym",       75),
            M("easy", "Go for any cycle ride",                       "activity_count",  1,   "cycling",   75),
            M("easy", "Do any swimming today",                       "activity_count",  1,   "swimming",  75),
            M("easy", "Log 2 activities today",                      "activity_count",  2,   null,        75),
            M("easy", "Run at least 1 km",                          "distance_km",     1,   "running",   75),
            M("easy", "Spend 20+ minutes swimming or at the gym",   "total_min",       20,  null,        75),

            // Medium — 150 XP each
            M("medium", "Run at least 3 km",                        "distance_km",     3,   "running",   150),
            M("medium", "Hit 5,000 steps",                          "steps",           5000, null,       150),
            M("medium", "Cycle at least 10 km",                     "distance_km",     10,  "cycling",   150),
            M("medium", "Swim for 20+ minutes",                     "duration_min",    20,  "swimming",  150),
            M("medium", "Spend 30+ minutes at the gym",             "duration_min",    30,  "gym",       150),
            M("medium", "Walk 5 km",                                "distance_km",     5,   "walking",   150),
            M("medium", "Log activities in 2 different sports",     "sport_count",     2,   null,        150),
            M("medium", "Run at least 5 km",                        "distance_km",     5,   "running",   150),
            M("medium", "Cycle 15 km",                              "distance_km",     15,  "cycling",   150),
            M("medium", "Spend 45+ minutes swimming or at the gym", "total_min",       45,  null,        150),

            // Hard — 300 XP each
            M("hard", "Run 10 km or more",                          "distance_km",     10,  "running",   300),
            M("hard", "Cycle 25 km or more",                        "distance_km",     25,  "cycling",   300),
            M("hard", "Hit 10,000 steps",                           "steps",           10000, null,      300),
            M("hard", "Swim for 45+ minutes",                       "duration_min",    45,  "swimming",  300),
            M("hard", "Spend 60+ minutes at the gym",               "duration_min",    60,  "gym",       300),
            M("hard", "Walk 10 km",                                 "distance_km",     10,  "walking",   300),
            M("hard", "Log 3 activities in 3 different sports",     "sport_count",     3,   null,        300),
            M("hard", "Run 7 km or more",                           "distance_km",     7,   "running",   300),
            M("hard", "Spend 90+ minutes swimming or at the gym",   "total_min",       90,  null,        300),
            M("hard", "Spend 120+ minutes swimming or at the gym",  "total_min",       120, null,        300)
        );

        db.SaveChanges();
    }

    private static DailyMission M(string tier, string desc, string reqType, double reqVal, string? sport, int xp)
        => new() { Id = Guid.NewGuid(), Tier = tier, Description = desc,
                   RequirementType = reqType, RequirementValue = reqVal, Sport = sport, XpReward = xp };

    private static void SeedAchievements(AppDbContext db)
    {
        if (db.Achievements.Any()) return;

        db.Achievements.AddRange(
            // Sport Distance — Running
            A("bronze", "First Strides",   "Run 10 km total",    "total_km", 10,  "running", 50),
            A("silver", "Road Warrior",    "Run 50 km total",    "total_km", 50,  "running", 150),
            A("gold",   "Marathon Legend", "Run 200 km total",   "total_km", 200, "running", 300),
            // Sport Distance — Walking
            A("bronze", "Weekend Walker",  "Walk 20 km total",   "total_km", 20,  "walking", 50),
            A("silver", "Trail Blazer",    "Walk 100 km total",  "total_km", 100, "walking", 150),
            A("gold",   "Pathfinder",      "Walk 500 km total",  "total_km", 500, "walking", 300),
            // Sport Distance — Cycling
            A("bronze", "Casual Rider",    "Cycle 30 km total",  "total_km", 30,  "cycling", 50),
            A("silver", "Chain Breaker",   "Cycle 150 km total", "total_km", 150, "cycling", 150),
            A("gold",   "Tour Crusher",    "Cycle 500 km total", "total_km", 500, "cycling", 300),
            // Sport Duration — Swimming
            A("bronze", "Pool Diver",      "Swim 60 min total",    "total_minutes", 60,   "swimming", 50),
            A("silver", "Lap Master",      "Swim 300 min total",   "total_minutes", 300,  "swimming", 150),
            A("gold",   "Open Water",      "Swim 1,000 min total", "total_minutes", 1000, "swimming", 300),
            // Sport Duration — Gym
            A("bronze", "Iron Starter",    "Log 120 min at the gym",   "total_minutes", 120,  "gym", 50),
            A("silver", "Pump Master",     "Log 600 min at the gym",   "total_minutes", 600,  "gym", 150),
            A("gold",   "Iron Legend",     "Log 2,000 min at the gym", "total_minutes", 2000, "gym", 300),
            // Steps
            A("bronze", "First March",     "Log 50,000 steps total",    "total_steps", 50000,   null, 50),
            A("silver", "Step Hunter",     "Log 250,000 steps total",   "total_steps", 250000,  null, 150),
            A("gold",   "Steps Legend",    "Log 1,000,000 steps total", "total_steps", 1000000, null, 300),
            // Streaks
            A("bronze", "On a Roll",       "Log activity 3 days in a row",  "streak_days", 3,  null, 50),
            A("silver", "Week Warrior",    "Log activity 7 days in a row",  "streak_days", 7,  null, 150),
            A("gold",   "Iron Habit",      "Log activity 30 days in a row", "streak_days", 30, null, 300),
            // XP Journey
            A("bronze", "Leveling Up",     "Reach Level 3",  "level_reached", 3,  null, 50),
            A("silver", "Getting Serious", "Reach Level 6",  "level_reached", 6,  null, 150),
            A("gold",   "Immortal",        "Reach Level 10", "level_reached", 10, null, 300),
            // Leaderboard Feats
            A("bronze", "Top 10",          "Reach top 10 on the leaderboard", "leaderboard_rank", 10, null, 50),
            A("silver", "Podium",          "Reach top 3 on the leaderboard",  "leaderboard_rank", 3,  null, 150),
            A("gold",   "Champion",        "Reach #1 on the leaderboard",     "leaderboard_rank", 1,  null, 300),
            // One-Time Feats
            A("bronze", "First Blood",      "Log your first activity",                           "first_activity", 1,    null, 50),
            A("bronze", "Mission Possible", "Complete your first daily mission",                 "first_mission",  1,    null, 50),
            A("silver", "Triple Crown",     "Complete a daily sweep (all 3 missions in one day)","first_sweep",    1,    null, 150),
            A("silver", "All-Rounder",      "Log all 6 sport types at least once",               "all_sports",     6,    null, 150),
            A("bronze", "Century",          "Earn 1,000 points in a single day",                 "points_in_day",  1000, null, 50),
            A("gold",   "Centurion",        "Earn 10,000 points in a single day",                "points_in_day",  10000, null, 300)
        );

        db.SaveChanges();
    }

    private static Achievement A(string tier, string name, string desc,
        string reqType, double reqVal, string? sport, int xp)
        => new() { Id = Guid.NewGuid(), Tier = tier, Name = name, Description = desc,
                   RequirementType = reqType, RequirementValue = reqVal, Sport = sport, XpReward = xp };

    private static void SeedAvatars(AppDbContext db)
    {
        if (db.Avatars.Any()) return;

        // Look up achievement IDs by name — SeedAchievements runs first so these exist
        var achByName = db.Achievements.ToDictionary(a => a.Name, a => a.Id);

        db.Avatars.AddRange(
            // Default
            V("Starter Sporty",      "Your default avatar — always available",             "default",            0,   null),
            // XP level
            V("Energized Sporty",    "Reach Level 2",                                      "level_reached",      2,   null),
            V("Athletic Sporty",     "Reach Level 4",                                      "level_reached",      4,   null),
            V("Elite Sporty",        "Reach Level 7",                                      "level_reached",      7,   null),
            V("Legend Sporty",       "Reach Level 10",                                     "level_reached",      10,  null),
            // Achievement earned
            V("First Blood Sporty",  "Earn the First Blood achievement",                   "achievement_earned", 0,   achByName.GetValueOrDefault("First Blood")),
            V("Marathon Sporty",     "Earn the Marathon Legend achievement",               "achievement_earned", 0,   achByName.GetValueOrDefault("Marathon Legend")),
            V("Tour Sporty",         "Earn the Tour Crusher achievement",                  "achievement_earned", 0,   achByName.GetValueOrDefault("Tour Crusher")),
            V("Aqua Sporty",         "Earn the Open Water achievement",                    "achievement_earned", 0,   achByName.GetValueOrDefault("Open Water")),
            V("Iron Sporty",         "Earn the Iron Legend achievement",                   "achievement_earned", 0,   achByName.GetValueOrDefault("Iron Legend")),
            V("Steps Legend Sporty", "Earn the Steps Legend achievement",                  "achievement_earned", 0,   achByName.GetValueOrDefault("Steps Legend")),
            V("Champion Sporty",     "Earn the Champion achievement",                      "achievement_earned", 0,   achByName.GetValueOrDefault("Champion")),
            V("All-Rounder Sporty",  "Earn the All-Rounder achievement",                   "achievement_earned", 0,   achByName.GetValueOrDefault("All-Rounder")),
            V("Centurion Sporty",    "Earn the Centurion achievement",                     "achievement_earned", 0,   achByName.GetValueOrDefault("Centurion")),
            V("Triple Crown Sporty", "Earn the Triple Crown achievement",                  "achievement_earned", 0,   achByName.GetValueOrDefault("Triple Crown")),
            // Streak
            V("Habit Sporty",        "Maintain a 14-day activity streak",                  "streak_days",        14,  null),
            V("Iron Habit Sporty",   "Maintain a 30-day activity streak",                  "streak_days",        30,  null),
            // Activities logged
            V("Active Sporty",       "Log 10 activities",                                  "activities_logged",  10,  null),
            V("Committed Sporty",    "Log 50 activities",                                  "activities_logged",  50,  null),
            V("Veteran Sporty",      "Log 100 activities",                                 "activities_logged",  100, null)
        );

        db.SaveChanges();
    }

    private static Avatar V(string name, string desc, string unlockType, double unlockValue, Guid? unlockAchievementId)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = desc,
            UnlockType = unlockType,
            UnlockValue = unlockValue,
            UnlockAchievementId = unlockAchievementId == Guid.Empty ? null : unlockAchievementId,
            ImagePath = $"assets/avatars/{name.ToLower().Replace(" ", "-")}.png",
        };
}
