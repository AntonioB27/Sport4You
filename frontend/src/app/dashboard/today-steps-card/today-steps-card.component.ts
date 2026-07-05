import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../shared/services/api.service';
import { UnlockSplashComponent } from '../../shared/components/unlock-splash/unlock-splash.component';
import { UnlockedAchievement, UnlockedAvatar } from '../../shared/models/dashboard.model';

const STEP_GOAL = 10000;

@Component({
  selector: 'app-today-steps-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule, UnlockSplashComponent],
  styles: [`
    :host { display:block; }
    .card {
      position:relative; overflow:hidden;
      background:linear-gradient(180deg,#12213f,#0e1a34);
      border:1px solid rgba(122,150,210,.18); border-radius:20px;
      padding:20px 22px;
    }
    .title { font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700; letter-spacing:.2em; color:#7fa8ff; margin-bottom:14px; }
    .ring-row { display:flex; align-items:center; gap:18px; }
    .ring { --p:0; width:104px; height:104px; border-radius:50%; flex-shrink:0;
      background:conic-gradient(#C6E63B calc(var(--p)*1%), rgba(255,255,255,.08) 0);
      display:flex; align-items:center; justify-content:center; }
    .ring-inner { width:80px; height:80px; border-radius:50%; background:#0e1a34; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .ring-val { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:20px; color:#fff; line-height:1; }
    .ring-goal { font-size:10px; color:#7fa8ff; margin-top:2px; }
    .meta { flex:1; }
    .pts { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; color:#C6E63B; }
    .pts-sub { font-size:12px; color:#9fb2d6; margin-top:2px; }
    .add-row { display:flex; gap:8px; margin-top:16px; }
    .add-input { flex:1; background:rgba(255,255,255,.06); border:1px solid rgba(122,150,210,.2); border-radius:10px; padding:9px 12px; color:#fff; font-family:'Nunito',sans-serif; font-size:14px; }
    .add-input::placeholder { color:#6f86b3; }
    .add-btn { background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E; border:none; border-radius:10px; padding:9px 18px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; letter-spacing:.05em; cursor:pointer; }
    .add-btn:disabled { opacity:.5; cursor:default; }
    .err { color:#ff8a80; font-size:12px; margin-top:8px; }
  `],
  template: `
    <div class="card">
      <div class="title">TODAY'S STEPS</div>
      <div class="ring-row">
        <div class="ring" [style.--p]="progressPercent">
          <div class="ring-inner">
            <div class="ring-val">{{ displaySteps.toLocaleString('en-US') }}</div>
            <div class="ring-goal">/ {{ goal.toLocaleString('en-US') }}</div>
          </div>
        </div>
        <div class="meta">
          <div class="pts">+{{ pointsFromSteps }} PTS</div>
          <div class="pts-sub">earned from steps today</div>
        </div>
      </div>
      <div class="add-row">
        <input class="add-input" type="number" inputmode="numeric" min="1" max="100000"
               placeholder="Add steps…" [(ngModel)]="entry" [disabled]="loading"
               (keyup.enter)="add()">
        <button class="add-btn" [disabled]="loading" (click)="add()">ADD</button>
      </div>
      <div class="err" *ngIf="errorMsg">{{ errorMsg }}</div>

      <app-unlock-splash
        [achievements]="unlockedAchievements"
        [avatars]="unlockedAvatars"
        (finished)="onUnlocksFinished()"></app-unlock-splash>
    </div>
  `,
})
export class TodayStepsCardComponent implements OnChanges {
  @Input() todaySteps = 0;
  @Output() stepsAdded = new EventEmitter<void>();

  readonly goal = STEP_GOAL;
  displaySteps = 0;
  entry: number | null = null;
  loading = false;
  errorMsg = '';
  unlockedAchievements: UnlockedAchievement[] = [];
  unlockedAvatars: UnlockedAvatar[] = [];

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private destroyRef: DestroyRef,
  ) {}

  ngOnChanges(): void {
    this.displaySteps = this.todaySteps;
  }

  get progressPercent(): number {
    return Math.min(100, Math.round((this.displaySteps / this.goal) * 100));
  }

  get pointsFromSteps(): number {
    return Math.floor(this.displaySteps / 100);
  }

  add(): void {
    const userId = localStorage.getItem('userId');
    const steps = Math.floor(Number(this.entry));
    if (!userId) return;
    if (!steps || steps <= 0) { this.errorMsg = 'Enter a step count above zero.'; return; }
    if (steps > 100000) { this.errorMsg = 'Max 100,000 steps per entry.'; return; }

    this.loading = true; this.errorMsg = '';
    this.api.addSteps(userId, steps)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: res => {
        this.loading = false;
        this.entry = null;
        this.displaySteps = res.todayTotalSteps;

        res.missionsCompleted.forEach((m, i) => {
          setTimeout(() => {
            this.snackBar.open(
              `Quest complete! ${m.description} · +${m.xpEarned} XP`,
              '', { duration: 3500, panelClass: 's4y-toast' });
          }, i * 600);
        });

        this.unlockedAchievements = res.achievementsUnlocked;
        this.unlockedAvatars = res.avatarsUnlocked;

        this.stepsAdded.emit();
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Failed to add steps. Please try again.';
      },
    });
  }

  onUnlocksFinished(): void {
    this.unlockedAchievements = [];
    this.unlockedAvatars = [];
  }
}
