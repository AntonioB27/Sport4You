export const SPORT_COLORS: Record<string, string> = {
  running: '#ef5350',
  walking: '#42a5f5',
  cycling: '#66bb6a',
  swimming: '#26c6da',
  gym: '#ab47bc',
  daily_steps: '#ffa726',
};

export const SPORT_ICONS: Record<string, string> = {
  running: '🏃',
  walking: '🚶',
  cycling: '🚴',
  swimming: '🏊',
  gym: '🏋️',
  daily_steps: '👟',
};

export const SPORTS = [
  'running', 'walking', 'cycling', 'swimming', 'gym', 'daily_steps',
] as const;
