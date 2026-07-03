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
    public DbSet<Avatar> Avatars => Set<Avatar>();
    public DbSet<UserAvatar> UserAvatars => Set<UserAvatar>();
    public DbSet<LootBox> LootBoxes => Set<LootBox>();
    public DbSet<LootBoxReward> LootBoxRewards => Set<LootBoxReward>();
    public DbSet<Border> Borders => Set<Border>();
    public DbSet<UserBorder> UserBorders => Set<UserBorder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.FirstName, u.LastName })
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasOne<Avatar>()
            .WithMany()
            .HasForeignKey(u => u.ActiveAvatarId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

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

        modelBuilder.Entity<UserAvatar>()
            .HasKey(ua => new { ua.UserId, ua.AvatarId });

        modelBuilder.Entity<UserBorder>()
            .HasIndex(ub => new { ub.UserId, ub.BorderId })
            .IsUnique();

        modelBuilder.Entity<LootBox>()
            .HasOne<LootBoxReward>()
            .WithMany()
            .HasForeignKey(lb => lb.RewardId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
