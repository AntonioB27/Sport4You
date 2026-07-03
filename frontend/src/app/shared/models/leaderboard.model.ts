export interface LeaderboardEntry {
  rank: number;
  userId: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  rankTrend: number;
  activeAvatarImagePath?: string;
}
