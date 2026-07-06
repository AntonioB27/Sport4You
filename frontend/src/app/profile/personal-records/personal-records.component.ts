import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../shared/services/api.service';
import { PersonalRecords, SportRecord } from '../../shared/models/dashboard.model';

const SPORT_LABELS: Record<string, string> = {
  running: 'Running',
  walking: 'Walking',
  cycling: 'Cycling',
  swimming: 'Swimming',
  gym: 'Gym',
  daily_steps: 'Daily Steps',
};

@Component({
  selector: 'app-personal-records',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .empty-state { font-size: 13px; color: #b0bcd4; }
    .records-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .record-card {
      background: #F4F6FB; border-radius: 14px; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .record-card.standout { background: linear-gradient(135deg, #2E6BE6, #1a4fc4); }
    .record-label {
      font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700;
      letter-spacing: .1em; color: #8592ad; text-transform: uppercase;
    }
    .record-card.standout .record-label { color: rgba(255,255,255,.75); }
    .record-value { font-family: 'Chakra Petch', sans-serif; font-size: 20px; font-weight: 700; color: #10203E; }
    .record-card.standout .record-value { color: #fff; }
    .record-date { font-size: 11px; color: #9aa6bd; }
    .record-card.standout .record-date { color: rgba(255,255,255,.65); }
  `],
  template: `
    @if (loading) {
      <div class="empty-state">Loading…</div>
    } @else if (isEmpty) {
      <div class="empty-state">Log your first activity to start setting records.</div>
    } @else {
      <div class="records-grid">
        @for (r of records!.sportRecords; track r.sport) {
          <div class="record-card">
            <span class="record-label">{{ sportLabel(r.sport) }}</span>
            <span class="record-value">{{ formatValue(r) }}</span>
            <span class="record-date">{{ r.achievedAt | date:'MMM d, y' }}</span>
          </div>
        }
        @if (records!.bestDayDate) {
          <div class="record-card standout">
            <span class="record-label">Biggest Day</span>
            <span class="record-value">{{ records!.bestDayPoints | number }} pts</span>
            <span class="record-date">{{ records!.bestDayDate | date:'MMM d, y' }}</span>
          </div>
        }
        @if (records!.longestStreakEver > 0) {
          <div class="record-card standout">
            <span class="record-label">Longest Streak</span>
            <span class="record-value">{{ records!.longestStreakEver }}d</span>
          </div>
        }
      </div>
    }
  `,
})
export class PersonalRecordsComponent implements OnInit {
  @Input() userId = '';

  records: PersonalRecords | null = null;
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getPersonalRecords(this.userId).subscribe({
      next: r => { this.records = r; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get isEmpty(): boolean {
    return !this.records
      || (this.records.sportRecords.length === 0
        && !this.records.bestDayDate
        && this.records.longestStreakEver === 0);
  }

  sportLabel(sport: string): string {
    return SPORT_LABELS[sport] ?? sport;
  }

  formatValue(r: SportRecord): string {
    if (r.bestDistance != null) return `${r.bestDistance} km`;
    if (r.bestDuration != null) return r.bestDuration;
    if (r.bestSteps != null) return `${r.bestSteps.toLocaleString()} steps`;
    return '—';
  }
}
