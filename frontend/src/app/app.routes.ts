// frontend/src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'leaderboard', pathMatch: 'full' },
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('./leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'achievements',
    loadComponent: () =>
      import('./achievements/achievements.component').then(m => m.AchievementsComponent),
  },
  {
    path: 'avatars',
    loadComponent: () =>
      import('./avatars/avatars.component').then(m => m.AvatarsComponent),
  },
];
