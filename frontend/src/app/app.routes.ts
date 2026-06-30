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
];
