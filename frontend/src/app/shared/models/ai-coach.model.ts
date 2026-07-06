export interface ParseResult {
  sport: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  steps: number | null;
  pointsPreview: number;
  confidence: 'high' | 'low';
  needsClarification: boolean;
  message: string;
}

export interface AiStatus {
  mode: 'ai' | 'basic';
}
