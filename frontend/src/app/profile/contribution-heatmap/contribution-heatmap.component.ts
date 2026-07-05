import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

interface HeatmapDay {
  date: Date;
  dateKey: string;
  points: number;
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
}

interface HeatmapWeek {
  days: HeatmapDay[];
  monthLabel: string | null; // set on the week whose first new month starts here
}

const LEVEL_COLORS = ['#EAEEF6', '#EAF7C9', '#C6E63B', '#9ECF10', '#7c9c00'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_MS = 86_400_000;

function levelFor(points: number): 0 | 1 | 2 | 3 | 4 {
  if (points <= 0) return 0;
  if (points < 150) return 1;
  if (points < 350) return 2;
  if (points < 700) return 3;
  return 4;
}

// The backend groups activities by the server's LOCAL calendar date (its
// DateTime.TryParse converts incoming UTC 'Z' timestamps to server-local
// time before truncating to .Date), so pointsOverTime's "yyyy-MM-dd" keys
// are server-local calendar days. Build the matching key from this Date's
// own local Y/M/D fields — never round-trip through toISOString()/UTC,
// which silently shifts the date by a day for any timezone ahead of UTC.
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-contribution-heatmap',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }
    .wrap { overflow-x: auto; padding-bottom: 4px; }
    .grid { display: flex; gap: 3px; width: max-content; }
    .week-col { display: flex; flex-direction: column; gap: 3px; position: relative; }
    .month-label {
      position: absolute; top: 0; left: 0;
      font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700;
      color: #8592ad; letter-spacing: .04em; white-space: nowrap;
    }
    .months-row { position: relative; height: 18px; }
    .cell {
      width: 11px; height: 11px; border-radius: 3px; background: #EAEEF6;
      cursor: default; transition: outline .1s;
    }
    .cell.future { visibility: hidden; }
    .cell:hover { outline: 2px solid #2E6BE6; outline-offset: 1px; }
    .legend { display: flex; align-items: center; gap: 5px; margin-top: 12px; justify-content: flex-end; }
    .legend span { font-size: 11px; color: #8592ad; }
    .legend .cell { cursor: default; }
    .legend .cell:hover { outline: none; }
    .empty { font-size: 13px; color: #b0bcd4; }
  `],
  template: `
    @if (weeks.length === 0) {
      <div class="empty">No activity yet.</div>
    } @else {
      <div class="wrap">
        <div class="grid">
          @for (week of weeks; track $index) {
            <div class="week-col">
              @if (week.monthLabel) {
                <div class="months-row"><span class="month-label">{{ week.monthLabel }}</span></div>
              } @else {
                <div class="months-row"></div>
              }
              @for (day of week.days; track day.dateKey) {
                <div class="cell" [class.future]="day.isFuture"
                     [style.background]="levelColors[day.level]"
                     [title]="day.isFuture ? '' : (day.points > 0 ? (day.date | date:'MMM d') + ' · ' + day.points + ' pts' : (day.date | date:'MMM d') + ' · No activity')">
                </div>
              }
            </div>
          }
        </div>
      </div>
      <div class="legend">
        <span>Less</span>
        @for (color of levelColors; track $index) {
          <div class="cell" [style.background]="color"></div>
        }
        <span>More</span>
      </div>
    }
  `,
})
export class ContributionHeatmapComponent implements OnChanges {
  @Input() pointsOverTime: { date: string; points: number }[] = [];

  readonly levelColors = LEVEL_COLORS;
  weeks: HeatmapWeek[] = [];

  ngOnChanges(): void {
    this.weeks = this.buildGrid();
  }

  private buildGrid(): HeatmapWeek[] {
    const pointsByDate = new Map<string, number>();
    for (const p of this.pointsOverTime) pointsByDate.set(p.date, p.points);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start on the Sunday on/before (today - 364 days), so the grid always
    // has full weeks and ends on today's column.
    const start = new Date(today.getTime() - 364 * DAY_MS);
    start.setDate(start.getDate() - start.getDay());

    const weeks: HeatmapWeek[] = [];
    let cursor = new Date(start);
    let lastMonth = -1;

    while (cursor <= today || cursor.getDay() !== 0) {
      const days: HeatmapDay[] = [];
      let monthLabel: string | null = null;

      for (let d = 0; d < 7; d++) {
        const isFuture = cursor > today;
        const key = dateKey(cursor);
        const points = pointsByDate.get(key) ?? 0;

        if (!isFuture && cursor.getMonth() !== lastMonth && cursor.getDate() <= 7) {
          monthLabel = MONTH_NAMES[cursor.getMonth()];
          lastMonth = cursor.getMonth();
        }

        days.push({
          date: new Date(cursor), dateKey: key, points,
          level: levelFor(points), isFuture,
        });
        cursor = new Date(cursor.getTime() + DAY_MS);
      }

      weeks.push({ days, monthLabel });
      if (cursor > today && cursor.getDay() === 0) break;
    }

    return weeks;
  }
}
