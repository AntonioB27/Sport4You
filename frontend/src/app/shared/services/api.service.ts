// frontend/src/app/shared/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LeaderboardEntry } from '../models/leaderboard.model';
import {
  AddStepsResponse, AchievementsPage, AvatarStatus, DashboardData,
  LogActivityRequest, LogActivityResponse, PersonalRecords,
} from '../models/dashboard.model';
import { BorderStatus, BoxInfo, OpenBoxResult } from '../models/border.model';
import { ShopCatalog, BoosterPurchaseResult, LootBoxPurchaseResult, AvatarPurchaseResult } from '../models/shop.model';
import { WeightHistory } from '../models/weight.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = 'http://localhost:5262/api';

  constructor(private http: HttpClient) {}

  registerUser(firstName: string, lastName: string): Observable<{ userId: string }> {
    return this.http.post<{ userId: string }>(`${this.base}/users`, { firstName, lastName });
  }

  loginUser(firstName: string, lastName: string): Observable<{ userId: string }> {
    return this.http.post<{ userId: string }>(`${this.base}/users/login`, { firstName, lastName });
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

  addSteps(userId: string, steps: number): Observable<AddStepsResponse> {
    return this.http.post<AddStepsResponse>(`${this.base}/users/${userId}/steps`, { steps });
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

  getBoxes(userId: string): Observable<BoxInfo> {
    return this.http.get<BoxInfo>(`${this.base}/users/${userId}/boxes`);
  }

  openBox(userId: string): Observable<OpenBoxResult> {
    return this.http.post<OpenBoxResult>(`${this.base}/users/${userId}/boxes/open`, {});
  }

  getBorders(userId: string): Observable<BorderStatus[]> {
    return this.http.get<BorderStatus[]>(`${this.base}/users/${userId}/borders`);
  }

  equipBorder(userId: string, borderId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/users/${userId}/border`, { borderId });
  }

  getRival(userId: string): Observable<{ rivalUserId: string | null }> {
    return this.http.get<{ rivalUserId: string | null }>(`${this.base}/users/${userId}/rival`);
  }

  setRival(userId: string, rivalUserId: string): Observable<void> {
    return this.http.put<void>(`${this.base}/users/${userId}/rival`, { rivalUserId });
  }

  clearRival(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${userId}/rival`);
  }

  prestige(userId: string): Observable<{ prestigeLevel: number }> {
    return this.http.post<{ prestigeLevel: number }>(`${this.base}/users/${userId}/prestige`, {});
  }

  getPersonalRecords(userId: string): Observable<PersonalRecords> {
    return this.http.get<PersonalRecords>(`${this.base}/users/${userId}/personal-records`);
  }

  getShop(userId: string): Observable<ShopCatalog> {
    return this.http.get<ShopCatalog>(`${this.base}/users/${userId}/shop`);
  }

  purchaseBooster(userId: string): Observable<BoosterPurchaseResult> {
    return this.http.post<BoosterPurchaseResult>(`${this.base}/users/${userId}/shop/booster`, {});
  }

  purchaseLootBox(userId: string, tier: 'normal' | 'special'): Observable<LootBoxPurchaseResult> {
    return this.http.post<LootBoxPurchaseResult>(`${this.base}/users/${userId}/shop/lootbox`, { tier });
  }

  purchaseShopAvatar(userId: string, avatarId: string): Observable<AvatarPurchaseResult> {
    return this.http.post<AvatarPurchaseResult>(`${this.base}/users/${userId}/shop/avatar`, { avatarId });
  }

  getWeight(userId: string): Observable<WeightHistory> {
    return this.http.get<WeightHistory>(`${this.base}/users/${userId}/weight`);
  }

  logWeight(userId: string, weightKg: number): Observable<{ date: string; weightKg: number }> {
    return this.http.post<{ date: string; weightKg: number }>(`${this.base}/users/${userId}/weight`, { weightKg });
  }

  setWeightGoal(userId: string, goalKg: number): Observable<{ goalKg: number }> {
    return this.http.put<{ goalKg: number }>(`${this.base}/users/${userId}/weight/goal`, { goalKg });
  }
}
