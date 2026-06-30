export interface DashboardData {
  user: { firstName: string; lastName: string };
  totalPoints: number;
  activities: ActivityItem[];
  pointsOverTime: { date: string; points: number }[];
  sportBreakdown: { sport: string; points: number }[];
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
