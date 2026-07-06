import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../shared/services/api.service';
import { ParseResult } from '../../shared/models/ai-coach.model';

@Component({
  selector: 'app-ai-coach-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  styles: [`
    .wrap { padding: 22px; font-family: 'Nunito', system-ui, sans-serif; width: 380px; max-width: 100%; }
    .title { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; color: #10203E; display: flex; align-items: center; gap: 8px; }
    .mode { font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .08em; color: #8592ad; margin-left: auto; }
    .mode.basic { color: #B78A00; }
    .sub { color: #5c6881; font-size: 13px; margin: 6px 0 14px; }
    textarea { width: 100%; border: 1px solid #d6e0ee; border-radius: 12px; padding: 12px; font: inherit; resize: vertical; min-height: 64px; }
    .btn { border: none; cursor: pointer; font-family: 'Chakra Petch', sans-serif; font-weight: 700; letter-spacing: .05em; border-radius: 12px; padding: 12px 18px; }
    .btn.primary { background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E; box-shadow: 0 4px 0 #7c9c00; }
    .btn.ghost { background: #fff; border: 1px solid #d6e0ee; color: #5c6881; }
    .row { display: flex; gap: 10px; margin-top: 14px; }
    .draft { margin-top: 16px; border-radius: 14px; padding: 16px; background: #F6FBEA; border: 1px solid rgba(158,207,16,.5); }
    .draft-line { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 16px; color: #10203E; }
    .draft-pts { color: #4a6100; }
    .clarify { margin-top: 16px; border-radius: 14px; padding: 14px; background: #FFF7E6; border: 1px solid #FFE0A3; color: #8B5E00; font-size: 13px; }
    .err { color: #e5484d; font-size: 13px; margin-top: 10px; }
  `],
  template: `
    <div class="wrap">
      <div class="title">✨ AI Coach <span class="mode" [class.basic]="mode==='basic'">{{ mode==='basic' ? '⚡ BASIC' : 'AI' }}</span></div>
      <div class="sub">Tell me what you did and I'll log it.</div>

      <textarea [(ngModel)]="text" placeholder="e.g. ran 5k in 25 min" (keydown.enter)="parse(); $event.preventDefault()"></textarea>

      @if (draft && !draft.needsClarification && draft.sport) {
        <div class="draft">
          <div class="draft-line">{{ label(draft) }}</div>
          <div class="draft-line draft-pts">+{{ draft.pointsPreview | number }} pts</div>
        </div>
        <div class="row">
          <button class="btn primary" (click)="confirm()">Confirm &amp; Log</button>
          <button class="btn ghost" (click)="draft = null">Edit</button>
        </div>
      } @else {
        @if (draft?.needsClarification) { <div class="clarify">{{ draft!.message }}</div> }
        <div class="row">
          <button class="btn primary" (click)="parse()" [disabled]="loading || !text.trim()">{{ loading ? 'Parsing…' : '✨ Parse' }}</button>
          <button class="btn ghost" (click)="close()">Cancel</button>
        </div>
      }
      @if (error) { <div class="err">{{ error }}</div> }
    </div>
  `,
})
export class AiCoachDialogComponent {
  text = '';
  draft: ParseResult | null = null;
  loading = false;
  error = '';
  mode: 'ai' | 'basic' = 'basic';

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private ref: MatDialogRef<AiCoachDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { userId: string; mode: 'ai' | 'basic' },
  ) { this.mode = data.mode; }

  label(d: ParseResult): string {
    const name = d.sport!.replace('_', ' ');
    if (d.steps != null) return `${cap(name)} · ${d.steps.toLocaleString()} steps`;
    if (d.distanceKm != null) return `${cap(name)} · ${d.distanceKm} km`;
    if (d.durationSeconds != null) return `${cap(name)} · ${mmss(d.durationSeconds)}`;
    return cap(name);
  }

  parse(): void {
    if (!this.text.trim()) return;
    this.loading = true; this.error = '';
    this.api.parseActivity(this.data.userId, this.text).subscribe({
      next: d => { this.draft = d; this.loading = false; },
      error: () => { this.error = 'Could not parse that. Try again.'; this.loading = false; },
    });
  }

  confirm(): void {
    const d = this.draft!;
    const done = (pts: number) => {
      this.snackBar.open(`Logged! +${pts} pts`, '', { duration: 2500 });
      this.ref.close(true);
    };
    if (d.sport === 'daily_steps' && d.steps != null) {
      this.api.addSteps(this.data.userId, d.steps).subscribe({
        next: () => done(d.pointsPreview),
        error: () => { this.error = 'Failed to log. Try again.'; },
      });
    } else {
      this.api.logActivity({
        userId: this.data.userId,
        datetime: new Date().toISOString(),
        sport: d.sport!,
        distance: d.distanceKm ?? undefined,
        duration: d.durationSeconds != null ? mmss(d.durationSeconds) : undefined,
        steps: undefined,
      }).subscribe({
        next: () => done(d.pointsPreview),
        error: () => { this.error = 'Failed to log. Try again.'; },
      });
    }
  }

  close(): void { this.ref.close(false); }
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60), s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
