import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { AvatarStatus } from '../shared/models/dashboard.model';
import { BorderStatus } from '../shared/models/border.model';
import { AvatarLockerComponent } from '../profile/avatar-locker.component';

@Component({
  selector: 'app-avatars-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatProgressSpinnerModule, MatSnackBarModule, AvatarLockerComponent],
  styles: [`
    .page { padding: 26px 30px; font-family: 'Nunito', system-ui, sans-serif; max-width: 1100px; }
    .spinner-wrap { display: flex; justify-content: center; padding: 60px; }
    .header { font-family: 'Chakra Petch', sans-serif; font-size: 27px; font-weight: 700; color: #10203E; margin-bottom: 4px; }
    .subhead { font-size: 14px; color: #5c6881; margin-bottom: 22px; }
    .signed-out { background: #fff; border: 1px solid #E3EAF5; border-radius: 20px; padding: 40px; text-align: center; color: #5c6881; font-family: 'Chakra Petch', sans-serif; }
    .signed-out a { color: #2E6BE6; font-weight: 700; text-decoration: none; }

    /* Borders section (moved from the profile AVATARS tab) */
    .section-title { font-family: 'Chakra Petch', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: .06em; color: #10203E; margin-bottom: 12px; }
    .borders-section { margin-top: 24px; }
    .border-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
    .border-card {
      background: #fff; border-radius: 16px; border: 1px solid #E3EAF5;
      padding: 16px 12px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .border-card.locked { opacity: .45; filter: grayscale(.7); }
    .border-card.active { border-color: #2E6BE6; box-shadow: 0 0 0 2px #2E6BE6; }
    .border-swatch { width: 48px; height: 48px; border-radius: 50%; background: #F4F6FB; }
    .border-name { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; color: #10203E; }
    .rarity-pill { font-family: 'Chakra Petch', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: .1em; border-radius: 999px; padding: 2px 8px; color: #fff; }
    .rarity-pill.common { background: #9E9E9E; }
    .rarity-pill.rare { background: #2196F3; }
    .rarity-pill.legendary { background: #FFD700; color: #333; }
    .rarity-pill.platinum { background: linear-gradient(135deg,#e8e8e8,#ffffff 50%,#cfd9ff); color: #3a4a9e; }
    .equip-btn {
      border: none; border-radius: 8px; padding: 6px 14px; cursor: pointer;
      background: #2E6BE6; color: #fff; font-family: 'Chakra Petch', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: .06em;
    }
    .equip-btn:disabled { opacity: .5; cursor: not-allowed; }
    .active-label { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; color: #2E6BE6; }
  `],
  template: `
    <div class="page">
      <div class="header">🎭 Avatars &amp; Borders</div>
      <div class="subhead">Equip a Spotry skin and a border ring — they show on your hero, the leaderboard, and your profile.</div>

      @if (!userId) {
        <div class="signed-out">Sign in to customize your avatar. <a routerLink="/leaderboard">Go to Leaderboard</a></div>
      } @else if (avatarsLoading) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <app-avatar-locker
          [avatars]="avatars"
          [equipping]="equipping"
          [activeBorderCss]="activeBorderCss"
          (equip)="equip($event)"></app-avatar-locker>

        @if (!bordersLoading && borders.length > 0) {
          <div class="borders-section">
            <div class="section-title">BORDERS</div>
            <div class="border-grid">
              @for (b of sortedBorders; track b.id) {
                <div class="border-card" [class.locked]="!b.unlocked" [class.active]="b.isActive">
                  <div class="border-swatch" [style.border]="b.borderCss"></div>
                  <div class="border-name">{{ b.name }}</div>
                  <span class="rarity-pill" [class]="b.rarity">{{ b.rarity.toUpperCase() }}</span>
                  @if (b.unlocked && !b.isActive) {
                    <button class="equip-btn" (click)="equipBorder(b)" [disabled]="equippingBorder">EQUIP</button>
                  }
                  @if (b.isActive) {
                    <div class="active-label">✓ EQUIPPED</div>
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
export class AvatarsPageComponent implements OnInit {
  userId = localStorage.getItem('userId') ?? '';

  avatars: AvatarStatus[] = [];
  avatarsLoading = false;
  equipping = false;

  borders: BorderStatus[] = [];
  bordersLoading = false;
  equippingBorder = false;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    if (!this.userId) return;
    this.loadAvatars();
    this.loadBorders();
  }

  get activeBorderCss(): string | null {
    return this.borders.find(b => b.isActive)?.borderCss ?? null;
  }

  get sortedBorders(): BorderStatus[] {
    const RARITY_RANK: Record<string, number> = { platinum: -1, legendary: 0, rare: 1, common: 2 };
    return [...this.borders].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return (RARITY_RANK[a.rarity] ?? 3) - (RARITY_RANK[b.rarity] ?? 3);
    });
  }

  private loadAvatars(): void {
    this.avatarsLoading = true;
    this.api.getAvatars(this.userId).subscribe({
      next: list => { this.avatars = list; this.avatarsLoading = false; },
      error: () => { this.avatarsLoading = false; },
    });
  }

  private loadBorders(): void {
    this.bordersLoading = true;
    this.api.getBorders(this.userId).subscribe({
      next: list => { this.borders = list; this.bordersLoading = false; },
      error: () => { this.bordersLoading = false; },
    });
  }

  equip(avatar: AvatarStatus): void {
    if (avatar.isActive) return;
    this.equipping = true;
    this.api.setActiveAvatar(this.userId, avatar.id).subscribe({
      next: () => {
        this.avatars = this.avatars.map(a => ({ ...a, isActive: a.id === avatar.id }));
        this.equipping = false;
        this.snackBar.open(`${avatar.name} equipped!`, '', { duration: 2500 });
      },
      error: () => { this.equipping = false; this.snackBar.open('Failed to equip avatar. Please try again.', 'OK', { duration: 4000 }); },
    });
  }

  equipBorder(border: BorderStatus): void {
    if (border.isActive || !border.unlocked) return;
    this.equippingBorder = true;
    this.api.equipBorder(this.userId, border.id).subscribe({
      next: () => {
        this.borders = this.borders.map(b => ({ ...b, isActive: b.id === border.id }));
        this.equippingBorder = false;
        this.snackBar.open(`${border.name} equipped!`, '', { duration: 2500 });
      },
      error: () => {
        this.equippingBorder = false;
        this.snackBar.open('Failed to equip border. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }
}
