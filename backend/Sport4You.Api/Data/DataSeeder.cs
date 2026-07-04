using Sport4You.Api.Models;
using Sport4You.Api.Services;

namespace Sport4You.Api.Data;

public static class DataSeeder
{
    private static readonly Microsoft.AspNetCore.Identity.PasswordHasher<User> Hasher = new();

    public static async Task SeedAsync(
        AppDbContext db, IScoringService scoring, IXpService xp,
        IAchievementService achievements, IAvatarService avatars, SeedOptions options)
    {
        // Definition tables first — user reward evaluation reads them.
        SeedMissions(db);
        SeedBorders(db);
        SeedAchievements(db);
        SeedAvatars(db);
        SeedLootBoxAvatars(db);
        SeedShopAvatars(db);
        SeedLootBoxRewards(db);

        await SeedUsersAndActivitiesAsync(db, scoring, xp, achievements, avatars, options);
    }

    // 30 unique first+last names (assignment requires uniqueness). UserCount from
    // options selects the first N; the light test seed uses 5.
    private static readonly string[] SeedFullNames =
    {
        "Elena Petrov", "Marcus Bennett", "Yuki Tanaka", "Aisha Khan", "Diego Morales",
        "Freya Andersen", "Omar Haddad", "Priya Nair", "Lucas Silva", "Nina Kowalski",
        "Kwame Mensah", "Sofia Ricci", "Liam Murphy", "Mei Lin", "Tariq Rahman",
        "Clara Fischer", "Andre Dubois", "Ingrid Larsen", "Rajesh Gupta", "Bianca Costa",
        "Sean OBrien", "Hana Kim", "Mateo Fernandez", "Zara Ahmed", "Viktor Novak",
        "Amelie Laurent", "Noah Weber", "Leila Hassan", "Carlos Vega", "Emma Thompson",
    };

    private static async Task SeedUsersAndActivitiesAsync(
        AppDbContext db, IScoringService scoring, IXpService xp,
        IAchievementService achievements, IAvatarService avatars, SeedOptions options)
    {
        // Guard: only seed on an empty user set (first seed name absent).
        var firstParts = SeedFullNames[0].Split(' ', 2);
        if (db.Users.Any(u => u.FirstName == firstParts[0] && u.LastName == firstParts[1])) return;

        var rng = new Random();
        var now = DateTime.UtcNow;
        var count = Math.Min(options.UserCount, SeedFullNames.Length);

        var users = new List<User>();
        var activities = new List<Activity>();
        var xpTransactions = new List<XpTransaction>();
        var userXpRows = new List<UserXp>();
        var usedUsernames = new HashSet<string>();

        for (var i = 0; i < count; i++)
        {
            var parts = SeedFullNames[i].Split(' ', 2);
            var user = new User { Id = Guid.NewGuid(), FirstName = parts[0], LastName = parts[1] };
            users.Add(user);

            // Auth: give each seeded user a unique login username (first name, numeric
            // suffix on collision) + the shared demo password hash.
            var baseUsername = user.FirstName.ToLowerInvariant();
            var username = baseUsername;
            var suffix = 1;
            while (!usedUsernames.Add(username))
                username = $"{baseUsername}{++suffix}";
            user.Username = username;
            user.PasswordHash = Hasher.HashPassword(user, "demo1234");

            var n = rng.Next(options.ActivitiesPerUserMin, options.ActivitiesPerUserMax + 1);
            var totalXp = 0;

            for (var j = 0; j < n; j++)
            {
                var g = SeedActivityGenerator.Next(rng, options.HistoryDays);
                var points = scoring.CalculatePoints(g.Sport, g.Distance, g.Duration, g.Steps);
                var activity = new Activity
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    DateTime = now.AddDays(-g.DaysAgo).AddHours(-g.HourOffset),
                    Sport = g.Sport,
                    Distance = g.Distance,
                    Duration = g.Duration,
                    Steps = g.Steps,
                    Points = points,
                };
                activities.Add(activity);

                var activityXp = xp.CalculateActivityXp(g.Sport, g.Distance, g.Duration, g.Steps);
                totalXp += activityXp;
                xpTransactions.Add(new XpTransaction
                {
                    Id = Guid.NewGuid(), UserId = user.Id, Source = "activity",
                    SourceId = activity.Id, XpEarned = activityXp, CreatedAt = activity.DateTime,
                });
            }

            userXpRows.Add(new UserXp { UserId = user.Id, TotalXp = totalXp, UpdatedAt = now });
        }

        db.Users.AddRange(users);
        db.Activities.AddRange(activities);
        db.XpTransactions.AddRange(xpTransactions);
        db.UserXp.AddRange(userXpRows);
        await db.SaveChangesAsync();

        // Mirror registration: give every user the default avatar (unlocked + equipped).
        foreach (var user in users)
            await avatars.UnlockAndEquipDefaultAsync(user.Id);

        // Phase 2: converge achievements + avatars across ALL users. Rank-based
        // achievements need every user present, and unlocking an achievement can
        // grant XP that lifts a user's level, which unlocks further level-based
        // achievements/avatars on the next pass — loop until a full pass is quiet.
        bool anyNew;
        do
        {
            anyNew = false;
            foreach (var user in users)
            {
                var newAch = await achievements.EvaluateAchievementsAsync(user.Id);
                var newAv = await avatars.EvaluateAvatarsAsync(user.Id);
                if (newAch.Count > 0 || newAv.Count > 0) anyNew = true;
            }
        } while (anyNew);

        // Phase 3: equip each user's best unlocked level avatar + grant/activate borders.
        await EquipCosmeticsAsync(db, users, rng);
    }

    private static async Task EquipCosmeticsAsync(AppDbContext db, List<User> users, Random rng)
    {
        // Level-path avatars, best-first by the level they require (Legend 10 > Elite 7 > ...).
        var levelAvatars = db.Avatars
            .Where(a => a.UnlockType == "level_reached")
            .OrderByDescending(a => a.UnlockValue)
            .ToList();
        // Cosmetic borders (exclude the platinum meta-border).
        var borders = db.Borders.Where(b => b.Rarity != "platinum").ToList();

        foreach (var user in users)
        {
            var unlockedAvatarIds = db.UserAvatars
                .Where(ua => ua.UserId == user.Id)
                .Select(ua => ua.AvatarId)
                .ToHashSet();

            var bestAvatar = levelAvatars.FirstOrDefault(a => unlockedAvatarIds.Contains(a.Id));
            if (bestAvatar != null)
                user.ActiveAvatarId = bestAvatar.Id; // `user` is the tracked entity from Phase 1

            // Grant 1–3 random borders; activate the first.
            var chosen = borders.OrderBy(_ => rng.Next()).Take(rng.Next(1, 4)).ToList();
            for (var k = 0; k < chosen.Count; k++)
            {
                db.UserBorders.Add(new UserBorder
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    BorderId = chosen[k].Id,
                    UnlockedAt = DateTime.UtcNow,
                    IsActive = k == 0,
                });
            }
        }

        await db.SaveChangesAsync();
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

        var borderByName = db.Borders.ToDictionary(b => b.Name, b => b.Id);

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
            A("gold",   "Centurion",        "Earn 10,000 points in a single day",                "points_in_day",  10000, null, 300),
            // Meta
            A("platinum", "Platinum Completionist", "Unlock all 33 achievements.", "achievements_unlocked", 33, null, 1000, borderByName.GetValueOrDefault("Platinum"))
        );

        db.SaveChanges();
    }

    private static Achievement A(string tier, string name, string desc,
        string reqType, double reqVal, string? sport, int xp, Guid? grantsBorderId = null)
        => new() { Id = Guid.NewGuid(), Tier = tier, Name = name, Description = desc,
                   RequirementType = reqType, RequirementValue = reqVal, Sport = sport, XpReward = xp,
                   GrantsBorderId = grantsBorderId };

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
            V("Veteran Sporty",      "Log 100 activities",                                 "activities_logged",  100, null),
            // Meta
            V("Platinum Sporty",     "Earn the Platinum Completionist achievement",        "achievement_earned", 0,   achByName.GetValueOrDefault("Platinum Completionist"))
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

    private static void SeedBorders(AppDbContext db)
    {
        if (db.Borders.Any()) return;

        db.Borders.AddRange(
            B("Iron Ring",    "common",    "3px solid #9E9E9E",                                                                     "iron-ring"),
            B("Leaf Ring",    "common",    "3px solid #66BB6A",                                                                     "leaf-ring"),
            B("Sapphire Band","rare",      "3px double #2196F3",                                                                    "sapphire-band"),
            B("Aurora Band",  "rare",      "3px solid #9C27B0",                                                                     "aurora-band"),
            B("Gold Crown Ring","legendary","3px solid #FFD700",                                                                    "gold-crown-ring"),
            B("Inferno Halo", "legendary", "3px solid #FF6F00",                                                                     "inferno-halo"),
            B("Platinum",     "platinum",  "3px solid transparent; background: linear-gradient(#fff,#fff) padding-box, conic-gradient(from 0deg, #e8e8e8, #ffffff, #cfd9ff, #ffe8f7, #e8e8e8) border-box", "platinum-ring")
        );

        db.SaveChanges();
    }

    private static Border B(string name, string rarity, string borderCss, string slug)
        => new() { Id = Guid.NewGuid(), Name = name, Rarity = rarity, BorderCss = borderCss,
                   ImagePath = $"assets/borders/{slug}.png" };

    private static void SeedLootBoxAvatars(AppDbContext db)
    {
        if (db.Avatars.Any(a => a.UnlockType == "loot_box")) return;

        db.Avatars.AddRange(
            // Common
            LV("Cap Sporty",          "cap-sporty",          "Casual day out in the park"),
            LV("Summer Sporty",       "summer-sporty",       "Ice cream on the boardwalk"),
            LV("Autumn Sporty",       "autumn-sporty",       "Cozy season, still moving"),
            // Rare
            LV("Referee Sporty",      "referee-sporty",      "Keeps every match fair"),
            LV("Karate Sporty",       "karate-sporty",       "Discipline meets hydration"),
            LV("Climber Sporty",      "climber-sporty",      "Summit at sunrise"),
            LV("DJ Sporty",           "dj-sporty",           "Drops beats and PRs"),
            // Legendary
            LV("Astronaut Sporty",    "astronaut-sporty",    "One small step for Sporty"),
            LV("Hero Sporty",         "hero-sporty",         "Caped defender of leg day"),
            LV("Wizard Sporty",       "wizard-sporty",       "Casts hydration spells"),
            LV("King Sporty",         "king-sporty",         "Rules the leaderboard realm"),
            LV("Dragon Rider Sporty", "dragon-rider-sporty", "Tamed a dragon on a rest day"),
            LV("Windrunner Sporty",   "windrunner-sporty",   "Life before death. Strength before finish lines.")
        );

        db.SaveChanges();
    }

    private static Avatar LV(string name, string slug, string desc)
        => new() { Id = Guid.NewGuid(), Name = name, Description = desc,
                   UnlockType = "loot_box", UnlockValue = 0, UnlockAchievementId = null,
                   ImagePath = $"assets/avatars/loot-box/{slug}.png" };

    private static void SeedShopAvatars(AppDbContext db)
    {
        if (db.Avatars.Any(a => a.UnlockType == "shop")) return;

        db.Avatars.AddRange(
            Shop("Sleuth Sporty",         "Elementary, my dear hydration.",              "common",    300,  "sleuth-sporty"),
            Shop("Scavenger Sporty",      "Fortune and glory... and electrolytes.",      "common",    300,  "scavenger-sporty"),
            Shop("Bladewalker Sporty",    "May the pace be with you.",                   "rare",      800,  "bladewalker-sporty"),
            Shop("Ringbearer Sporty",     "One does not simply skip leg day.",           "rare",      800,  "ringbearer-sporty"),
            Shop("Master Assassin Sporty","Nothing is true, everything is cardio.",      "legendary", 1500, "master-assassin-sporty"),
            Shop("Dark Lord Sporty",      "I find your lack of hydration disturbing.",   "legendary", 1500, "dark-lord-sporty")
        );

        db.SaveChanges();
    }

    private static Avatar Shop(string name, string desc, string rarity, int price, string slug)
        => new()
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = desc,
            UnlockType = "shop",
            UnlockValue = 0,
            ImagePath = $"assets/avatars/shop/{slug}.png",
            ShopRarity = rarity,
            ShopPrice = price,
        };

    private static void SeedLootBoxRewards(AppDbContext db)
    {
        if (db.LootBoxRewards.Any()) return;

        var avatarByName = db.Avatars
            .Where(a => a.UnlockType == "loot_box")
            .ToDictionary(a => a.Name, a => a.Id);

        var borderByName = db.Borders.ToDictionary(b => b.Name, b => b.Id);

        db.LootBoxRewards.AddRange(
            // Common avatars
            R("avatar", "common", "Cap Sporty",       $"assets/avatars/loot-box/cap-sporty.png",       avatarId: avatarByName["Cap Sporty"]),
            R("avatar", "common", "Summer Sporty",    $"assets/avatars/loot-box/summer-sporty.png",    avatarId: avatarByName["Summer Sporty"]),
            R("avatar", "common", "Autumn Sporty",    $"assets/avatars/loot-box/autumn-sporty.png",    avatarId: avatarByName["Autumn Sporty"]),
            // Rare avatars
            R("avatar", "rare",   "Referee Sporty",   $"assets/avatars/loot-box/referee-sporty.png",   avatarId: avatarByName["Referee Sporty"]),
            R("avatar", "rare",   "Karate Sporty",    $"assets/avatars/loot-box/karate-sporty.png",    avatarId: avatarByName["Karate Sporty"]),
            R("avatar", "rare",   "Climber Sporty",   $"assets/avatars/loot-box/climber-sporty.png",   avatarId: avatarByName["Climber Sporty"]),
            R("avatar", "rare",   "DJ Sporty",        $"assets/avatars/loot-box/dj-sporty.png",        avatarId: avatarByName["DJ Sporty"]),
            // Legendary avatars
            R("avatar", "legendary","Astronaut Sporty",    $"assets/avatars/loot-box/astronaut-sporty.png",    avatarId: avatarByName["Astronaut Sporty"]),
            R("avatar", "legendary","Hero Sporty",         $"assets/avatars/loot-box/hero-sporty.png",         avatarId: avatarByName["Hero Sporty"]),
            R("avatar", "legendary","Wizard Sporty",       $"assets/avatars/loot-box/wizard-sporty.png",       avatarId: avatarByName["Wizard Sporty"]),
            R("avatar", "legendary","King Sporty",         $"assets/avatars/loot-box/king-sporty.png",         avatarId: avatarByName["King Sporty"]),
            R("avatar", "legendary","Dragon Rider Sporty", $"assets/avatars/loot-box/dragon-rider-sporty.png", avatarId: avatarByName["Dragon Rider Sporty"]),
            R("avatar", "legendary","Windrunner Sporty",   $"assets/avatars/loot-box/windrunner-sporty.png",   avatarId: avatarByName["Windrunner Sporty"]),
            // Common borders
            R("border", "common", "Iron Ring",        "assets/borders/iron-ring.png",    borderId: borderByName["Iron Ring"]),
            R("border", "common", "Leaf Ring",        "assets/borders/leaf-ring.png",    borderId: borderByName["Leaf Ring"]),
            // Rare borders
            R("border", "rare",   "Sapphire Band",    "assets/borders/sapphire-band.png",borderId: borderByName["Sapphire Band"]),
            R("border", "rare",   "Aurora Band",      "assets/borders/aurora-band.png",  borderId: borderByName["Aurora Band"]),
            // Legendary borders
            R("border", "legendary","Gold Crown Ring","assets/borders/gold-crown-ring.png",borderId: borderByName["Gold Crown Ring"]),
            R("border", "legendary","Inferno Halo",   "assets/borders/inferno-halo.png",  borderId: borderByName["Inferno Halo"])
        );

        db.SaveChanges();
    }

    private static LootBoxReward R(string type, string rarity, string name, string imagePath,
        Guid? avatarId = null, Guid? borderId = null)
        => new() { Id = Guid.NewGuid(), Type = type, Rarity = rarity, Name = name,
                   ImagePath = imagePath, AvatarId = avatarId, BorderId = borderId };
}
