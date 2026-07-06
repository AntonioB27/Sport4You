// frontend/src/app/app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'leaderboard', pathMatch: 'full' },
  {
    path: 'leaderboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./leaderboard/leaderboard.component').then(m => m.LeaderboardComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'achievements',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./achievements/achievements.component').then(m => m.AchievementsComponent),
  },
  {
    path: 'shop',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shop/shop.component').then(m => m.ShopComponent),
  },
  {
    path: 'avatars',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./avatars/avatars-page.component').then(m => m.AvatarsPageComponent),
  },
  {
    path: 'profile/:userId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./profile/profile.component').then(m => m.ProfileComponent),
  },
];
