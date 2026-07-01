using Sport4You.Api.Models;
using Sport4You.Api.Services;

namespace Sport4You.Api.Data;

public static class DataSeeder
{
    public static void Seed(AppDbContext db, IScoringService scoring)
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
            // Maria — dedicated runner + daily steps
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

            // James — gym enthusiast + swimming
            (users[1].Id,  0, "gym",         null,  "60:00",  null),
            (users[1].Id,  1, "swimming",    null,  "45:00",  null),
            (users[1].Id,  2, "gym",         null,  "75:00",  null),
            (users[1].Id,  3, "gym",         null,  "60:00",  null),
            (users[1].Id,  5, "swimming",    null,  "30:00",  null),
            (users[1].Id,  6, "gym",         null,  "90:00",  null),
            (users[1].Id,  9, "gym",         null,  "60:00",  null),
            (users[1].Id, 11, "swimming",    null,  "45:00",  null),
            (users[1].Id, 13, "gym",         null,  "75:00",  null),

            // Sophie — mix of everything
            (users[2].Id,  0, "walking",      5.0m,  null,    null),
            (users[2].Id,  1, "gym",          null, "45:00",  null),
            (users[2].Id,  2, "running",      4.0m,  null,    null),
            (users[2].Id,  3, "daily_steps",  null,   null,  10000),
            (users[2].Id,  5, "cycling",     15.0m,  null,    null),
            (users[2].Id,  7, "swimming",     null, "30:00",  null),
            (users[2].Id,  9, "walking",      6.0m,  null,    null),
            (users[2].Id, 11, "running",      5.0m,  null,    null),

            // Luca — cyclist + walker
            (users[3].Id,  0, "cycling",     40.0m,  null,    null),
            (users[3].Id,  2, "walking",      8.0m,  null,    null),
            (users[3].Id,  3, "cycling",     35.0m,  null,    null),
            (users[3].Id,  5, "cycling",     50.0m,  null,    null),
            (users[3].Id,  7, "walking",     10.0m,  null,    null),
            (users[3].Id, 10, "cycling",     20.0m,  null,    null),
            (users[3].Id, 14, "cycling",     45.0m,  null,    null),

            // Amara — steps + running newcomer
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
}
