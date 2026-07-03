// frontend/src/app/avatars/avatars.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../shared/services/api.service';
import { AvatarStatus } from '../shared/models/dashboard.model';

@Component({
  selector: 'app-avatars',
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

    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }

    .av-card {
      background:#fff; border-radius:16px; border:2px solid #E3EAF5;
      padding:0 16px 14px; position:relative; overflow:hidden;
      transition:box-shadow .15s;
    }
    .av-card:hover { box-shadow:0 8px 20px -10px rgba(46,107,230,.2); }
    .av-card.locked { opacity:.45; filter:grayscale(.7); }
    .av-card.active { border-color:#2E6BE6; box-shadow:0 0 0 2px rgba(46,107,230,.25); }

    .av-card-img {
      display:block; width:calc(100% + 32px); margin:0 -16px 12px;
      aspect-ratio:1; object-fit:cover; border-radius:14px 14px 0 0;
    }
    .av-card-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#10203E; line-height:1.2; margin-bottom:4px; }
    .av-card-desc { font-size:11px; color:#8592ad; line-height:1.4; margin-bottom:10px; }
    .av-card-date { font-size:10px; color:#b0bcd4; margin-bottom:10px; }
    .av-card-badge {
      display:inline-block; background:#EEF3FB; border-radius:999px;
      font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700;
      letter-spacing:.1em; color:#2E6BE6; padding:3px 10px; margin-bottom:10px;
    }
    .equip-btn {
      width:100%; padding:8px; border-radius:10px; border:none; cursor:pointer;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px;
      background:linear-gradient(150deg,#2E6BE6,#1B47AE); color:#fff;
      transition:opacity .15s;
    }
    .equip-btn:hover { opacity:.88; }
    .equip-btn:disabled { background:#E3EAF5; color:#8592ad; cursor:default; opacity:1; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-title">🎭 AVATARS</div>
        <div class="stats-pill">
          <span class="stats-count">{{ unlockedCount }}</span>
          <span>/ {{ avatars.length }} unlocked</span>
        </div>
      </div>

      @if (loading) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      }

      <div class="grid">
        @for (a of sorted; track a.id) {
          <div class="av-card" [class.locked]="!a.unlocked" [class.active]="a.isActive">
            <img class="av-card-img" [src]="a.imagePath" [alt]="a.name">
            @if (a.isActive) {
              <div class="av-card-badge">ACTIVE</div>
            }
            <div class="av-card-name">{{ a.name }}</div>
            <div class="av-card-desc">{{ a.description }}</div>
            @if (a.unlocked && a.unlockedAt) {
              <div class="av-card-date">Unlocked {{ a.unlockedAt | date:'MMM d, y' }}</div>
            }
            @if (a.unlocked) {
              <button class="equip-btn" [disabled]="a.isActive || equipping" (click)="equip(a)">
                {{ a.isActive ? 'EQUIPPED' : 'EQUIP' }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AvatarsComponent implements OnInit {
  avatars: AvatarStatus[] = [];
  loading = true;
  equipping = false;
  private _sorted: AvatarStatus[] = [];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }
    this.api.getAvatars(userId).subscribe({
      next: (list) => { this.avatars = list; this.computeSorted(); this.loading = false; },
      error: ()    => { this.loading = false; },
    });
  }

  get unlockedCount(): number {
    return this.avatars.filter(a => a.unlocked).length;
  }

  // Unlocked first (by unlockedAt desc), then locked
  get sorted(): AvatarStatus[] {
    return this._sorted;
  }

  private computeSorted(): void {
    this._sorted = [...this.avatars].sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;
      if (a.unlocked && b.unlocked) {
        return new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime();
      }
      return 0;
    });
  }

  equip(avatar: AvatarStatus): void {
    const userId = localStorage.getItem('userId');
    if (!userId || avatar.isActive) return;
    this.equipping = true;
    this.api.setActiveAvatar(userId, avatar.id).subscribe({
      next: () => {
        this.avatars = this.avatars.map(a => ({ ...a, isActive: a.id === avatar.id }));
        this.computeSorted();
        this.equipping = false;
      },
      error: () => { this.equipping = false; },
    });
  }
}
