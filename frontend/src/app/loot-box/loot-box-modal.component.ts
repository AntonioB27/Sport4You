import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { OpenBoxResult } from '../shared/models/border.model';

// idle: loop video + OPEN · opening: API in flight, loop keeps playing ·
// burst: rarity video plays once · revealed: reward card
type ModalState = 'idle' | 'opening' | 'burst' | 'revealed';

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
      padding: 28px 28px 24px; text-align: center;
      font-family: 'Nunito', system-ui, sans-serif; min-width: 340px;
    }

    /* ── Box stage (videos) ── */
    .box-stage {
      position: relative; width: 300px; height: 300px; margin: 0 auto 20px;
      border-radius: 18px; overflow: hidden; background: #0f1e3b;
      box-shadow: 0 24px 44px -24px rgba(15,30,59,.8);
    }
    .box-vid { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .box-vid.hidden-vid { opacity: 0; pointer-events: none; }

    /* ── Reveal flash ── */
    .reveal-flash {
      position: fixed; inset: 0; background: #fff; pointer-events: none; z-index: 10;
      animation: flashOut .5s ease-out both;
    }
    @keyframes flashOut { from { opacity: 1; } to { opacity: 0; } }

    /* ── Reward card ── */
    .reward-card {
      background: #F4F6FB; border-radius: 18px; padding: 20px;
      animation: slideIn .3s ease-out;
    }
    @keyframes slideIn {
      from { transform: translateY(18px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .reward-img { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; object-position: 50% 22%; margin-bottom: 10px; }
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
      @if (state !== 'revealed') {
        <div class="box-stage">
          <video #idleVid class="box-vid" [class.hidden-vid]="state === 'burst'"
                 src="assets/videos/lootbox-idle.mp4"
                 [muted]="true" autoplay loop playsinline
                 (timeupdate)="onIdleTick(idleVid)"></video>
          @if (burstSrc) {
            <video #burstVid class="box-vid" [class.hidden-vid]="state !== 'burst'"
                   [src]="burstSrc" [muted]="true" playsinline preload="auto"
                   (ended)="onBurstEnded()"></video>
          }
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" (click)="open()" [disabled]="state !== 'idle'">
            {{ state === 'idle' ? 'OPEN' : 'OPENING…' }}
          </button>
          <button class="btn btn-secondary" (click)="close()" [disabled]="state === 'burst'">DONE</button>
        </div>
      }

      @if (state === 'revealed' && result) {
        <div class="reveal-flash"></div>
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
  @ViewChild('burstVid') burstVid?: ElementRef<HTMLVideoElement>;

  state: ModalState = 'idle';
  result: OpenBoxResult | null = null;
  burstSrc = '';
  lastRemaining: number | undefined = undefined;

  private pendingResult: OpenBoxResult | null = null;
  private opensCount = 0;
  private burstFallbackId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { userId: string },
    private dialogRef: MatDialogRef<LootBoxModalComponent>,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  open(): void {
    if (this.state !== 'idle') return;
    this.state = 'opening';
    this.opensCount++;

    this.api.openBox(this.data.userId).subscribe({
      next: result => {
        this.pendingResult = result;
        this.lastRemaining = result.remainingBoxes;
        this.burstSrc = `assets/videos/lootbox-open-${result.rarity}.mp4`;
        // Safety net: if the idle loop never hits its boundary (e.g. video
        // failed to play), start the burst anyway after one loop length.
        this.burstFallbackId = setTimeout(() => this.startBurst(), 3500);
      },
      error: () => {
        this.state = 'idle';
        this.snackBar.open('Failed to open box. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }

  // The idle clip's first and last frames match the burst clips' first frame,
  // so cutting at the loop boundary is seamless.
  onIdleTick(idle: HTMLVideoElement): void {
    if (this.state === 'opening' && this.pendingResult && idle.currentTime < 0.15) {
      this.startBurst();
    }
  }

  private startBurst(): void {
    if (this.state !== 'opening' || !this.pendingResult) return;
    if (this.burstFallbackId) { clearTimeout(this.burstFallbackId); this.burstFallbackId = null; }

    this.state = 'burst';
    const vid = this.burstVid?.nativeElement;
    if (vid) {
      // Repeat opens skip some ceremony
      vid.playbackRate = this.opensCount > 1 ? 1.5 : 1;
      vid.play().catch(() => this.onBurstEnded());
    } else {
      this.onBurstEnded();
    }
  }

  onBurstEnded(): void {
    this.result = this.pendingResult;
    this.pendingResult = null;
    this.state = 'revealed';
  }

  reset(): void {
    this.result = null;
    this.burstSrc = '';
    this.state = 'idle';
  }

  close(): void {
    this.dialogRef.close(this.lastRemaining);
  }

  rarityColor(rarity: string): string {
    return RARITY_COLOR[rarity] ?? '#9E9E9E';
  }
}
