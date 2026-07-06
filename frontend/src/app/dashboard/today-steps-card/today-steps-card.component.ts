import { Component, DestroyRef, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../shared/services/api.service';
import { UnlockSplashDialogComponent } from '../../shared/components/unlock-splash/unlock-splash-dialog.component';

const STEP_GOAL = 10000;

@Component({
  selector: 'app-today-steps-card',
  standalone: true,
  imports: [CommonModule, FormsModule, MatSnackBarModule],
  styles: [`
    :host { display:block; height:100%; }
    .fx { filter: drop-shadow(0 14px 24px rgba(16,32,62,.15)); height:100%; }
    .card {
      position:relative; height:100%; background:#fff; box-shadow: inset 0 0 0 1px #E6ECF6;
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
      padding:20px 22px;
    }
    .sec-title { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
    .sec-bar { width:3px; height:16px; background:#9ECF10; box-shadow:0 0 8px rgba(158,207,16,.7); flex-shrink:0; }
    .title { font-family:'Chakra Petch',sans-serif; font-size:13px; font-weight:700; letter-spacing:.16em; color:#10203E; }
    .ring-wrap { display:flex; justify-content:center; margin-bottom:14px; }
    .ring { --p:0; width:120px; height:120px; border-radius:50%; flex-shrink:0;
      background:conic-gradient(from -90deg, #8CE00E, #C6E63B calc(var(--p)*1%), #EAEEF6 0);
      display:flex; align-items:center; justify-content:center; }
    .ring-inner { width:98px; height:98px; border-radius:50%; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .ring-val { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:22px; color:#10203E; line-height:1; }
    .ring-goal { font-size:10px; color:#8592ad; margin-top:3px; }
    .foot { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .pts { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; color:#5f7a00; white-space:nowrap; }
    .add-row { display:flex; gap:6px; margin-top:12px; }
    .add-input { flex:1; min-width:0; background:#F7FAFF; border:1px solid #E6ECF6; border-radius:8px; padding:8px 10px; color:#10203E; font-family:'Nunito',sans-serif; font-size:14px; }
    .add-input::placeholder { color:#9aa6bd; }
    .add-btn { background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E; border:none; padding:8px 16px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.05em; cursor:pointer; box-shadow:0 3px 0 #7c9c00; flex-shrink:0;
      clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px); }
    .add-btn:disabled { opacity:.5; cursor:default; box-shadow:none; }
    .err { color:#e5484d; font-size:12px; margin-top:8px; }
  `],
  template: `
    <div class="fx"><div class="card">
      <div class="sec-title"><span class="sec-bar"></span><span class="title">STEP CORE</span></div>
      <div class="ring-wrap">
        <div class="ring" [style.--p]="progressPercent">
          <div class="ring-inner">
            <div class="ring-val">{{ displaySteps.toLocaleString('en-US') }}</div>
            <div class="ring-goal">/ {{ goal.toLocaleString('en-US') }}</div>
          </div>
        </div>
      </div>
      <div class="foot">
        <span class="pts">+{{ pointsFromSteps }} PTS TODAY</span>
      </div>
      <div class="add-row">
        <input class="add-input" type="number" inputmode="numeric" min="1" max="100000"
               placeholder="Add steps…" [(ngModel)]="entry" [disabled]="loading"
               (keyup.enter)="add()">
        <button class="add-btn" [disabled]="loading" (click)="add()">+ ADD</button>
      </div>
      <div class="err" *ngIf="errorMsg">{{ errorMsg }}</div>
    </div></div>
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

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
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

        if (res.achievementsUnlocked.length > 0 || res.avatarsUnlocked.length > 0) {
          this.dialog.open(UnlockSplashDialogComponent, {
            data: { achievements: res.achievementsUnlocked, avatars: res.avatarsUnlocked },
            panelClass: 's4y-watch-dialog',
            width: '400px',
          });
        }

        this.stepsAdded.emit();
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Failed to add steps. Please try again.';
      },
    });
  }
}
