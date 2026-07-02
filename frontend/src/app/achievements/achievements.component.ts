// frontend/src/app/achievements/achievements.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../shared/services/api.service';
import { AchievementStatus } from '../shared/models/dashboard.model';

interface AchievementCategory {
  label: string;
  types: string[];
}

const CATEGORIES: AchievementCategory[] = [
  { label: 'Sport Distance Milestones', types: ['total_km'] },
  { label: 'Sport Duration Milestones', types: ['total_minutes'] },
  { label: 'Steps Milestones',          types: ['total_steps'] },
  { label: 'Streaks',                   types: ['streak_days'] },
  { label: 'XP Journey',               types: ['level_reached'] },
  { label: 'Leaderboard Feats',         types: ['leaderboard_rank'] },
  { label: 'One-Time Feats',            types: ['first_activity', 'first_mission', 'first_sweep', 'all_sports', 'points_in_day'] },
];

const TIER_ORDER = ['bronze', 'silver', 'gold'];
const TIER_COLOR: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700',
};

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  styles: [`
    .page { padding: 26px 30px; font-family: 'Nunito', system-ui, sans-serif; max-width: 1000px; }
    .spinner-wrap { display:flex; justify-content:center; padding:80px; }

    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:26px; }
    .page-title { font-family:'Chakra Petch',sans-serif; font-size:26px; font-weight:700; color:#10203E; }
    .stats-pill {
      display:flex; align-items:center; gap:8px; background:#fff;
      border:1px solid #E3EAF5; border-radius:999px; padding:7px 16px;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#5c6881;
    }
    .stats-count { color:#10203E; }

    .category { margin-bottom:28px; }
    .category-label {
      font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700;
      letter-spacing:.18em; color:#8592ad; margin-bottom:12px;
    }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }

    .ach-card {
      background:#fff; border-radius:16px; border:1px solid #E3EAF5;
      padding:0 16px 14px; position:relative; overflow:hidden;
      transition:box-shadow .15s;
    }
    .ach-card:hover { box-shadow:0 8px 20px -10px rgba(46,107,230,.2); }
    .ach-card.locked { opacity:.45; filter:grayscale(.7); }

    .ach-card-stripe { position:absolute; top:0; left:0; right:0; height:4px; z-index:1; }
    .ach-card-img {
      display:block; width:calc(100% + 32px); margin:0 -16px 12px;
      aspect-ratio:1; object-fit:cover; border-radius:16px 16px 0 0;
    }
    .ach-card-tier {
      font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700;
      letter-spacing:.18em; margin-bottom:6px;
    }
    .ach-card-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#10203E; line-height:1.2; margin-bottom:4px; }
    .ach-card-desc { font-size:11px; color:#8592ad; line-height:1.4; }
    .ach-card-date { font-size:10px; color:#b0bcd4; margin-top:8px; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-title">🏅 ACHIEVEMENTS</div>
        <div class="stats-pill">
          <span class="stats-count">{{ unlockedCount }}</span>
          <span>/ {{ achievements.length }} unlocked</span>
        </div>
      </div>

      @if (loading) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      }

      @for (cat of categories; track cat.label) {
        @if (inCategory(cat).length > 0) {
          <div class="category">
            <div class="category-label">{{ cat.label.toUpperCase() }}</div>
            <div class="grid">
              @for (a of inCategory(cat); track a.id) {
                <div class="ach-card" [class.locked]="!a.unlocked">
                  <div class="ach-card-stripe" [style.background]="tierColor(a.tier)"></div>
                  <img class="ach-card-img" [src]="iconPath(a)" [alt]="a.name">
                  <div class="ach-card-tier" [style.color]="tierColor(a.tier)">
                    {{ a.tier.toUpperCase() }}
                  </div>
                  <div class="ach-card-name">{{ a.name }}</div>
                  <div class="ach-card-desc">{{ a.description }}</div>
                  @if (a.unlocked && a.unlockedAt) {
                    <div class="ach-card-date">Unlocked {{ a.unlockedAt | date:'MMM d, y' }}</div>
                  } @else if (!a.unlocked) {
                    <div class="ach-card-date">+{{ a.xpReward }} XP on unlock</div>
                  }
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class AchievementsComponent implements OnInit {
  achievements: AchievementStatus[] = [];
  loading = true;
  categories = CATEGORIES;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }

    this.api.getAchievements(userId).subscribe({
      next: (list) => { this.achievements = list; this.loading = false; },
      error: ()   => { this.loading = false; },
    });
  }

  get unlockedCount(): number {
    return this.achievements.filter(a => a.unlocked).length;
  }

  inCategory(cat: AchievementCategory): AchievementStatus[] {
    return this.achievements
      .filter(a => cat.types.includes(a.requirementType))
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  }

  tierColor(tier: string): string {
    return TIER_COLOR[tier] ?? '#9fb2d6';
  }

  iconPath(a: AchievementStatus): string {
    const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
    return `assets/achievements/${a.tier}-${slug}.png`;
  }
}
