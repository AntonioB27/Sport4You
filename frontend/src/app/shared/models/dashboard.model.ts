export interface DashboardData {
  user: { firstName: string; lastName: string };
  totalPoints: number;
  activities: ActivityItem[];
  pointsOverTime: { date: string; points: number }[];
  sportBreakdown: { sport: string; points: number }[];
  xp: XpInfo;
  dailyMissions: DailyMissionItem[];
  recentAchievements: AchievementStatus[];
}

export interface XpInfo {
  total: number;
  level: number;
  levelTitle: string;
  xpInLevel: number;
  xpForNextLevel: number;
  xpPercent: number;
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
}

export interface LogActivityResponse {
  activityId: string;
  points: number;
  xpEarned: number;
  missionsCompleted: CompletedMission[];
  achievementsUnlocked: UnlockedAchievement[];
}
