using Microsoft.EntityFrameworkCore;
using Sport4You.Api.Models;

namespace Sport4You.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<UserXp> UserXp => Set<UserXp>();
    public DbSet<DailyMission> DailyMissions => Set<DailyMission>();
    public DbSet<UserMissionCompletion> UserMissionCompletions => Set<UserMissionCompletion>();
    public DbSet<XpTransaction> XpTransactions => Set<XpTransaction>();
    public DbSet<Achievement> Achievements => Set<Achievement>();
    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.FirstName, u.LastName })
            .IsUnique();

        modelBuilder.Entity<UserXp>()
            .HasKey(u => u.UserId);

        modelBuilder.Entity<UserXp>()
            .HasOne(u => u.User)
            .WithOne()
            .HasForeignKey<UserXp>(u => u.UserId);

        modelBuilder.Entity<UserMissionCompletion>()
            .HasIndex(c => new { c.UserId, c.MissionId, c.Date })
            .IsUnique();

        modelBuilder.Entity<UserAchievement>()
            .HasKey(ua => new { ua.UserId, ua.AchievementId });
    }
}
