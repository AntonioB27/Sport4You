import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';
import { LogActivityRequest } from '../../models/dashboard.model';
import { SPORT_COLORS, SPORT_ICONS, SPORTS } from '../../constants/sport.constants';

interface SportMeta {
  label: string;
  kind: 'distance' | 'duration' | 'steps';
  inputType: string;
  placeholder: string;
  step: string;
  min: string;
}

const SPORT_META: Record<string, SportMeta> = {
  running:     { label: 'Distance (km)', kind: 'distance', inputType: 'number', placeholder: '5.0',  step: '0.1', min: '0.1' },
  walking:     { label: 'Distance (km)', kind: 'distance', inputType: 'number', placeholder: '3.0',  step: '0.1', min: '0.1' },
  cycling:     { label: 'Distance (km)', kind: 'distance', inputType: 'number', placeholder: '20.0', step: '0.1', min: '0.1' },
  swimming:    { label: 'Duration (mm:ss)', kind: 'duration', inputType: 'text', placeholder: '30:00', step: '', min: '' },
  gym:         { label: 'Duration (mm:ss)', kind: 'duration', inputType: 'text', placeholder: '45:00', step: '', min: '' },
  daily_steps: { label: 'Steps',          kind: 'steps',    inputType: 'number', placeholder: '8000', step: '1',   min: '1'   },
};

@Component({
  selector: 'app-log-activity-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  styles: [`
    .sports-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .sport-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px 8px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      background: #fafafa;
      user-select: none;
    }
    .sport-card:hover { background: #f0f0f0; }
    .sport-card.selected { background: #fff; }
    .sport-emoji { font-size: 28px; line-height: 1; }
    .sport-name { font-size: 11px; font-weight: 600; margin-top: 4px; text-align: center; color: #444; }
    .metric-field { width: 100%; }
    .error-msg { color: #d32f2f; font-size: 13px; margin-top: 4px; }
    .btn-inner { display: flex; align-items: center; gap: 8px; }
  `],
  template: `
    <h2 mat-dialog-title>Log Activity</h2>
    <mat-dialog-content>
      <div class="sports-grid">
        <div
          *ngFor="let sport of sports"
          class="sport-card"
          [class.selected]="selectedSport === sport"
          [style.border-color]="selectedSport === sport ? sportColors[sport] : '#e0e0e0'"
          (click)="selectSport(sport)"
        >
          <span class="sport-emoji">{{ sportIcons[sport] }}</span>
          <span class="sport-name">{{ formatSport(sport) }}</span>
        </div>
      </div>

      <mat-form-field *ngIf="selectedSport" appearance="outline" class="metric-field">
        <mat-label>{{ meta.label }}</mat-label>
        <input
          matInput
          [(ngModel)]="metricValue"
          [type]="meta.inputType"
          [placeholder]="meta.placeholder"
          [attr.step]="meta.step || null"
          [attr.min]="meta.min || null"
          (ngModelChange)="errorMsg = ''"
        />
      </mat-form-field>

      <p class="error-msg" *ngIf="errorMsg">{{ errorMsg }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="loading">Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [disabled]="!canSubmit()"
        (click)="submit()"
      >
        <span class="btn-inner">
          <mat-spinner *ngIf="loading" diameter="20"></mat-spinner>
          {{ loading ? 'Logging...' : 'Log Activity' }}
        </span>
      </button>
    </mat-dialog-actions>
  `,
})
export class LogActivityDialogComponent {
  sports = [...SPORTS];
  sportColors = SPORT_COLORS;
  sportIcons = SPORT_ICONS;

  selectedSport: string | null = null;
  metricValue = '';
  loading = false;
  errorMsg = '';

  get meta(): SportMeta {
    return SPORT_META[this.selectedSport!];
  }

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<LogActivityDialogComponent>,
    private snackBar: MatSnackBar,
  ) {}

  selectSport(sport: string) {
    this.selectedSport = sport;
    this.metricValue = '';
    this.errorMsg = '';
  }

  formatSport(sport: string): string {
    return sport.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  canSubmit(): boolean {
    if (!this.selectedSport || !this.metricValue || this.loading) return false;
    if (this.meta.kind === 'duration') return /^\d+:\d{2}$/.test(this.metricValue);
    return Number(this.metricValue) > 0;
  }

  submit() {
    const userId = localStorage.getItem('userId');
    if (!userId || !this.selectedSport) return;

    const base = { userId, datetime: new Date().toISOString() };
    let request: LogActivityRequest;

    if (this.meta.kind === 'distance') {
      request = { ...base, sport: this.selectedSport, distance: parseFloat(this.metricValue) };
    } else if (this.meta.kind === 'duration') {
      request = { ...base, sport: this.selectedSport, duration: this.metricValue };
    } else {
      request = { ...base, steps: parseInt(this.metricValue, 10) };
    }

    this.loading = true;
    this.api.logActivity(request).subscribe({
      next: ({ points }) => {
        this.dialogRef.close({ points });
        this.snackBar.open(`✓ +${points} pts earned!`, '', { duration: 3000 });
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.error ?? 'Something went wrong. Please try again.';
      },
    });
  }
}
