// frontend/src/app/shared/models/dashboard.model.ts
export interface RivalStatus {
  userId: string;
  firstName: string;
  lastName: string;
  imagePath: string | null;
  borderCss: string | null;
  myPoints: number;
  rivalPoints: number;
  pointsGap: number;
  imAhead: boolean;
  justFlipped: boolean;
}

export interface DashboardData {
  user: { firstName: string; lastName: string };
  totalPoints: number;
  rank: number;
  currentStreak: number;
  todaySteps: number;
  coins: number;
  boostedActivitiesRemaining: number;
  activities: ActivityItem[];
  pointsOverTime: { date: string; points: number }[];
  sportBreakdown: { sport: string; points: number }[];
  xp: XpInfo;
  dailyMissions: DailyMissionItem[];
  recentAchievements: AchievementStatus[];
  activeAvatar: AvatarStatus | null;
  activeBorderCss: string | null;
  rivalStatus: RivalStatus | null;
}

export interface XpInfo {
  total: number;
  level: number;
  levelTitle: string;
  xpInLevel: number;
  xpForNextLevel: number;
  xpPercent: number;
  prestigeLevel: number;
}

export interface DailyMissionItem {
  id: string;
  tier: 'easy' | 'medium' | 'hard';
  description: string;
  xpReward: number;
  completed: boolean;
  progress: number;
  progressMax: number;
}

export interface ActivityItem {
  id: string;
  dateTime: string;
  sport: string;
  distance?: number;
  duration?: string;
  steps?: number;
  points: number;
}

export interface LogActivityRequest {
  userId: string;
  datetime: string;
  sport?: string;
  distance?: number;
  duration?: string;
  steps?: number;
}

export interface CompletedMission {
  description: string;
  xpEarned: number;
}

export interface UnlockedAchievement {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  name: string;
  description: string;
  xpReward: number;
}

export interface AchievementStatus extends UnlockedAchievement {
  requirementType: string;
  unlocked: boolean;
  unlockedAt: string | null;
  sport: string | null;
  requirementValue: number;
  progress: number;
  ownedByPercent: number;
}

export interface AchievementsPage {
  xp: XpInfo;
  achievements: AchievementStatus[];
}

export interface UnlockedAvatar {
  id: string;
  name: string;
  description: string;
  imagePath: string;
}

export interface AvatarStatus extends UnlockedAvatar {
  unlockType: string;
  unlockValue: number;
  unlocked: boolean;
  unlockedAt: string | null;
  isActive: boolean;
}

export interface LogActivityResponse {
  activityId: string;
  points: number;
  xpEarned: number;
  boostApplied: boolean;
  missionsCompleted: CompletedMission[];
  achievementsUnlocked: UnlockedAchievement[];
  avatarsUnlocked: UnlockedAvatar[];
}

export interface AddStepsResponse {
  todayTotalSteps: number;
  pointsEarned: number;
  xpEarned: number;
  missionsCompleted: CompletedMission[];
  achievementsUnlocked: UnlockedAchievement[];
  avatarsUnlocked: UnlockedAvatar[];
}

export interface SportRecord {
  sport: string;
  bestDistance: number | null;
  bestDuration: string | null;
  bestSteps: number | null;
  achievedAt: string;
}

export interface PersonalRecords {
  sportRecords: SportRecord[];
  bestDayPoints: number;
  bestDayDate: string | null;
  longestStreakEver: number;
}
