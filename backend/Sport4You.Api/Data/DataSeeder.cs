using Sport4You.Api.Models;
using Sport4You.Api.Services;

namespace Sport4You.Api.Data;

public static class DataSeeder
{
    public static void Seed(AppDbContext db, IScoringService scoring)
    {
        SeedUsers(db, scoring);
        SeedMissions(db);
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
}
