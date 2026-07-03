// frontend/src/app/shared/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LeaderboardEntry } from '../models/leaderboard.model';
import {
  AchievementsPage, AvatarStatus, DashboardData,
  LogActivityRequest, LogActivityResponse,
} from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = 'http://localhost:5262/api';

  constructor(private http: HttpClient) {}

  registerUser(firstName: string, lastName: string): Observable<{ userId: string }> {
    return this.http.post<{ userId: string }>(`${this.base}/users`, { firstName, lastName });
  }

  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<LeaderboardEntry[]>(`${this.base}/leaderboard`);
  }

  getDashboard(userId: string): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.base}/users/${userId}/dashboard`);
  }

  logActivity(request: LogActivityRequest): Observable<LogActivityResponse> {
    return this.http.post<LogActivityResponse>(`${this.base}/activities`, request);
  }

  getAchievements(userId: string): Observable<AchievementsPage> {
    return this.http.get<AchievementsPage>(`${this.base}/users/${userId}/achievements`);
  }

  getAvatars(userId: string): Observable<AvatarStatus[]> {
    return this.http.get<AvatarStatus[]>(`${this.base}/users/${userId}/avatars`);
  }

  setActiveAvatar(userId: string, avatarId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/users/${userId}/avatar`, { avatarId });
  }
}
