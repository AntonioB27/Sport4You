import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { OpenBoxResult } from '../shared/models/border.model';

type ModalState = 'idle' | 'opening' | 'revealed';

const RARITY_COLOR: Record<string, string> = {
  common: '#9E9E9E',
  rare: '#2196F3',
  legendary: '#FFD700',
};

@Component({
  selector: 'app-loot-box-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatSnackBarModule],
  styles: [`
    .modal-wrap {
      padding: 32px 28px 24px; text-align: center;
      font-family: 'Nunito', system-ui, sans-serif; min-width: 300px;
    }

    /* ── Box graphic ── */
    .box-graphic {
      font-size: 80px; line-height: 1; display: block;
      margin: 0 auto 24px; transition: transform .1s;
    }
    .box-graphic.pop {
      animation: popOpen .6s cubic-bezier(.36,.07,.19,.97);
    }
    @keyframes popOpen {
      0%   { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
      30%  { transform: scale(1.35); filter: drop-shadow(0 0 18px rgba(46,107,230,.7)); }
      60%  { transform: scale(0.88); }
      100% { transform: scale(1); filter: drop-shadow(0 0 0 transparent); }
    }

    /* ── Reward card ── */
    .reward-card {
      background: #F4F6FB; border-radius: 18px; padding: 20px;
      animation: slideIn .3s ease-out;
    }
    @keyframes slideIn {
      from { transform: translateY(18px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .reward-img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; }
    .reward-img.duplicate { opacity: .4; filter: grayscale(.8); }
    .rarity-badge {
      display: inline-block; border-radius: 999px; padding: 3px 12px;
      font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700;
      letter-spacing: .1em; color: #fff; margin-bottom: 8px;
    }
    .reward-name {
      font-family: 'Chakra Petch', sans-serif; font-size: 16px; font-weight: 700;
      color: #10203E; margin-bottom: 6px;
    }
    .duplicate-label { font-size: 13px; color: #2E6BE6; font-weight: 700; }

    /* ── Buttons ── */
    .btn-row { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
    .btn {
      border: none; border-radius: 12px; padding: 11px 22px; cursor: pointer;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px;
      letter-spacing: .06em; transition: opacity .15s;
    }
    .btn:hover { opacity: .85; }
    .btn-primary { background: #2E6BE6; color: #fff; }
    .btn-secondary { background: #F4F6FB; color: #10203E; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
  `],
  template: `
    <div class="modal-wrap">
      @if (state === 'idle' || state === 'opening') {
        <span class="box-graphic" [class.pop]="state === 'opening'">📦</span>
        <div class="btn-row">
          <button class="btn btn-primary" (click)="open()" [disabled]="state === 'opening'">
            OPEN
          </button>
          <button class="btn btn-secondary" (click)="close()">DONE</button>
        </div>
      }

      @if (state === 'revealed' && result) {
        <div class="reward-card">
          <img class="reward-img" [class.duplicate]="result.wasDuplicate"
               [src]="result.imagePath" [alt]="result.name">
          <div>
            <span class="rarity-badge" [style.background]="rarityColor(result.rarity)">
              {{ result.rarity.toUpperCase() }}
            </span>
          </div>
          <div class="reward-name">{{ result.name }}</div>
          @if (result.wasDuplicate) {
            <div class="duplicate-label">Already owned — +{{ result.duplicateXpAwarded }} XP</div>
          }
        </div>
        <div class="btn-row">
          @if (result.remainingBoxes > 0) {
            <button class="btn btn-primary" (click)="reset()">OPEN ANOTHER</button>
          }
          <button class="btn btn-secondary" (click)="close()">DONE</button>
        </div>
      }
    </div>
  `,
})
export class LootBoxModalComponent {
  state: ModalState = 'idle';
  result: OpenBoxResult | null = null;
  lastRemaining: number | undefined = undefined;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { userId: string },
    private dialogRef: MatDialogRef<LootBoxModalComponent>,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  open(): void {
    this.state = 'opening';
    setTimeout(() => {
      this.api.openBox(this.data.userId).subscribe({
        next: result => {
          this.result = result;
          this.lastRemaining = result.remainingBoxes;
          this.state = 'revealed';
        },
        error: () => {
          this.state = 'idle';
          this.snackBar.open('Failed to open box. Please try again.', 'OK', { duration: 4000 });
        },
      });
    }, 600);
  }

  reset(): void {
    this.result = null;
    this.state = 'idle';
  }

  close(): void {
    this.dialogRef.close(this.lastRemaining);
  }

  rarityColor(rarity: string): string {
    return RARITY_COLOR[rarity] ?? '#9E9E9E';
  }
}
