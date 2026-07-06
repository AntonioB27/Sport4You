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
    path: 'shop',
    loadComponent: () =>
      import('./shop/shop.component').then(m => m.ShopComponent),
  },
  {
    path: 'profile/:userId',
    loadComponent: () =>
      import('./profile/profile.component').then(m => m.ProfileComponent),
  },
];
