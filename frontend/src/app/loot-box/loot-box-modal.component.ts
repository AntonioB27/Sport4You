import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { OpenBoxResult } from '../shared/models/border.model';

// idle: loop video + OPEN · opening: API in flight, loop keeps playing ·
// burst: rarity video plays once · revealed: reward card
type ModalState = 'idle' | 'opening' | 'burst' | 'revealed';

interface RarityTheme {
  ambient: string; dim: string; soft: string; glow: string;
  ribbon: string; ink: string; tease: string;
}

// Signal Vault (design 1a) rarity theming; 'neutral' is used while the
// roll is still unknown (idle/opening — the real API decides the rarity).
const THEMES: Record<string, RarityTheme> = {
  neutral: {
    ambient: '#2E6BE6', dim: '#1B47AE', soft: 'rgba(46,107,230,.30)', glow: 'rgba(46,107,230,.55)',
    ribbon: '', ink: '#fff', tease: '',
  },
  common: {
    ambient: '#9E9E9E', dim: '#6f6f6f', soft: 'rgba(158,158,158,.35)', glow: 'rgba(158,158,158,.6)',
    ribbon: 'COMMON', ink: '#fff', tease: 'A COMMON DROP',
  },
  rare: {
    ambient: '#2196F3', dim: '#1565c0', soft: 'rgba(33,150,243,.35)', glow: 'rgba(33,150,243,.65)',
    ribbon: 'RARE', ink: '#fff', tease: 'SOMETHING RARE',
  },
  legendary: {
    ambient: '#FFC824', dim: '#E39A00', soft: 'rgba(255,200,36,.4)', glow: 'rgba(255,200,36,.75)',
    ribbon: '★ LEGENDARY', ink: '#3a2a00', tease: 'A LEGENDARY BREAKS FREE',
  },
};

@Component({
  selector: 'app-loot-box-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatSnackBarModule],
  styles: [`
    @keyframes cornerGlow { 0%,100% { opacity:.5; } 50% { opacity:1; } }
    @keyframes dotBlink { 0%,100% { opacity:.25; } 50% { opacity:1; } }
    @keyframes holoSweep { 0% { background-position:-160% 0; } 100% { background-position:260% 0; } }
    @keyframes cardRise { 0% { transform:translateY(22px) scale(.96); opacity:0; } 100% { transform:none; opacity:1; } }
    @keyframes confFall1 { 0% { transform:translate(0,-10px) rotate(0); opacity:0; } 12% { opacity:1; } 100% { transform:translate(-26px,240px) rotate(340deg); opacity:0; } }
    @keyframes confFall2 { 0% { transform:translate(0,-10px) rotate(0); opacity:0; } 12% { opacity:1; } 100% { transform:translate(20px,250px) rotate(-300deg); opacity:0; } }
    @keyframes confFall3 { 0% { transform:translate(0,-10px) rotate(0); opacity:0; } 12% { opacity:1; } 100% { transform:translate(-12px,230px) rotate(380deg); opacity:0; } }

    .vault {
      position: relative; width: 100%; border-radius: 24px; padding-bottom: 22px;
      background: linear-gradient(180deg,#FFFFFF,#F4F7FC);
      font-family: 'Nunito', system-ui, sans-serif;
    }
    .vault-halo {
      position: absolute; top: 0; left: 0; right: 0; height: 110px;
      border-radius: 24px 24px 0 0; pointer-events: none; transition: background .3s;
    }

    /* ── header ── */
    .hdr { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 6px; }
    .hdr-left { display: flex; align-items: center; gap: 9px; }
    .hdr-cube {
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(150deg,#2E6BE6,#1B47AE);
      display: flex; align-items: center; justify-content: center;
    }
    .hdr-label { font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .18em; color: #2E6BE6; }
    .hdr-right { display: flex; align-items: center; gap: 10px; }
    .boxes-pill {
      display: flex; align-items: center; gap: 5px; background: #EEF3FD; border: 1px solid #d6e2f5;
      border-radius: 999px; padding: 4px 10px;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 12px; color: #2E6BE6;
    }
    .close-btn {
      width: 26px; height: 26px; border-radius: 8px; background: #EEF2F8; color: #8592ad; border: none;
      display: flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer;
    }

    .content { position: relative; padding: 6px 22px 0; }

    /* ── stage ── */
    .stage-wrap { position: relative; margin: 6px 0 2px; }
    .stage-glow {
      position: absolute; inset: -14px; border-radius: 26px; pointer-events: none; transition: opacity .3s;
    }
    .stage {
      position: relative; width: 100%; height: 300px; border-radius: 20px; overflow: hidden;
      background: radial-gradient(120% 100% at 50% 30%, #22375f, #0d1a33 78%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), inset 0 -30px 50px -20px rgba(0,0,0,.6);
    }
    .stage video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .stage video.hidden-vid { opacity: 0; pointer-events: none; }
    .corner { position: absolute; width: 22px; height: 22px; animation: cornerGlow 1.6s ease-in-out infinite; transition: border-color .3s; }
    .corner.tl { top: 12px; left: 12px; border-top: 3px solid; border-left: 3px solid; border-radius: 5px 0 0 0; }
    .corner.tr { top: 12px; right: 12px; border-top: 3px solid; border-right: 3px solid; border-radius: 0 5px 0 0; }
    .corner.bl { bottom: 12px; left: 12px; border-bottom: 3px solid; border-left: 3px solid; border-radius: 0 0 0 5px; }
    .corner.br { bottom: 12px; right: 12px; border-bottom: 3px solid; border-right: 3px solid; border-radius: 0 0 5px 0; }

    /* ── charge track ── */
    .charge-track { height: 5px; border-radius: 999px; background: #e6ebf3; margin-top: 10px; overflow: hidden; }
    .charge-fill {
      height: 100%; border-radius: 999px; background: linear-gradient(90deg,#9ECF10,#C6E63B);
      box-shadow: 0 0 10px rgba(198,230,59,.9); transition: width .3s ease;
    }

    /* ── status text ── */
    .status { text-align: center; min-height: 44px; margin-top: 14px; }
    .status-title { font-family: 'Chakra Petch', sans-serif; font-size: 15px; font-weight: 700; color: #10203E; }
    .status-title.opening { letter-spacing: .14em; color: #2E6BE6; }
    .status-title.tease { letter-spacing: .1em; }
    .status-sub { font-size: 12.5px; color: #8592ad; margin-top: 2px; }
    .dot { animation: dotBlink 1s infinite; }
    .dot.d2 { animation-delay: .2s; }
    .dot.d3 { animation-delay: .4s; }

    /* ── buttons ── */
    .btn-row { display: flex; gap: 10px; align-items: center; margin-top: 14px; }
    .open-btn {
      flex: 1; border: none; cursor: pointer;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .06em;
      color: #10203E; background: linear-gradient(150deg,#C6E63B,#9ECF10); padding: 15px; border-radius: 14px;
      box-shadow: 0 6px 0 #7c9c00, 0 12px 22px -10px rgba(158,207,16,.7);
    }
    .open-btn:disabled { opacity: .6; cursor: default; }
    .opening-pill {
      flex: 1; text-align: center; font-family: 'Chakra Petch', sans-serif; font-weight: 700;
      font-size: 15px; color: #9aa6bd; background: #EEF2F8; padding: 15px; border-radius: 14px;
    }
    .skip-btn {
      border: 1px solid #d6e0ee; cursor: pointer; font-family: 'Chakra Petch', sans-serif;
      font-weight: 700; font-size: 13px; letter-spacing: .08em; color: #5c6881; background: #fff;
      padding: 15px 18px; border-radius: 14px; display: flex; align-items: center; gap: 7px;
    }

    /* ── reveal ── */
    .reveal { position: relative; animation: cardRise .42s cubic-bezier(.2,1.2,.3,1); }
    .confetti-layer { position: absolute; inset: 0; overflow: visible; pointer-events: none; z-index: 5; }
    .conf { position: absolute; top: 4px; }
    .reward-frame {
      position: relative; border-radius: 18px; overflow: hidden; padding: 4px;
    }
    .reward-art { position: relative; border-radius: 15px; overflow: hidden; aspect-ratio: 1/1; }
    .reward-art img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
    .holo {
      position: absolute; inset: 0; pointer-events: none; mix-blend-mode: screen;
      background: linear-gradient(120deg, transparent 34%, rgba(255,255,255,.5) 50%, transparent 66%);
      background-size: 220% 100%; animation: holoSweep 2.6s linear infinite;
    }
    .ribbon {
      position: absolute; top: 12px; left: 12px;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: .16em;
      padding: 5px 12px; border-radius: 999px;
    }
    .new-chip {
      position: absolute; top: 12px; right: 12px;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 10px; letter-spacing: .14em;
      color: #fff; background: rgba(15,30,59,.6); padding: 5px 10px; border-radius: 999px;
    }
    .dup-overlay {
      position: absolute; inset: 0; background: rgba(15,30,59,.34);
      display: flex; align-items: flex-end; justify-content: center; padding-bottom: 12px;
    }
    .dup-overlay span { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: .14em; color: #dbe6f7; }
    .reward-name-wrap { text-align: center; margin-top: 14px; }
    .reward-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 22px; color: #101f3c; }
    .reward-sub { font-size: 12.5px; color: #8592ad; margin-top: 3px; }
    .xp-panel {
      margin-top: 14px; border-radius: 14px; background: linear-gradient(180deg,#EAF1FF,#DCE8FF);
      border: 1px solid #C7D8F5; padding: 14px; display: flex; align-items: center; justify-content: center; gap: 12px;
    }
    .xp-num { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 30px; color: #2E6BE6; line-height: 1; }
    .xp-copy { text-align: left; }
    .xp-copy-title { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #2E6BE6; letter-spacing: .04em; }
    .xp-copy-sub { font-size: 11.5px; color: #5c7099; }
    .reveal-btns { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .another-btn {
      flex: 1; border: none; cursor: pointer;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; letter-spacing: .05em;
      color: #fff; background: linear-gradient(150deg,#2E6BE6,#1B47AE); padding: 14px; border-radius: 13px;
      box-shadow: 0 10px 20px -10px rgba(46,107,230,.8);
    }
    .done-btn {
      flex: 1; border: 1px solid #dfe6f2; cursor: pointer;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; letter-spacing: .05em;
      color: #5c6881; background: #fff; padding: 14px; border-radius: 13px;
    }
    .done-btn.wide { flex: 2; }
  `],
  template: `
    <div class="vault" [style.box-shadow]="'0 30px 60px -24px rgba(10,20,44,.4), 0 0 46px -6px ' + theme.soft">
      <div class="vault-halo" [style.background]="'radial-gradient(120% 130% at 50% -30%, ' + theme.soft + ', transparent 70%)'"></div>

      <div class="hdr">
        <div class="hdr-left">
          <div class="hdr-cube">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 8l8-4 8 4-8 4-8-4z" fill="#C6E63B"/><path d="M4 8v8l8 4V12" fill="#fff" opacity=".9"/><path d="M20 8v8l-8 4V12" fill="#dbe8ff"/></svg>
          </div>
          <div class="hdr-label">LOOT BOX</div>
        </div>
        <div class="hdr-right">
          <div class="boxes-pill">📦 ×{{ remainingDisplay }}</div>
          <button class="close-btn" (click)="close()">✕</button>
        </div>
      </div>

      <div class="content">
        @if (state !== 'revealed') {
          <div class="stage-wrap">
            <div class="stage-glow"
                 [style.background]="'radial-gradient(closest-side, ' + theme.soft + ', transparent 76%)'"
                 [style.opacity]="state === 'idle' ? .35 : 1"></div>
            <div class="stage">
              <video #idleVid [class.hidden-vid]="state === 'burst'"
                     src="assets/videos/lootbox-idle.mp4"
                     [muted]="true" autoplay loop playsinline
                     (timeupdate)="onIdleTick(idleVid)"></video>
              @if (burstSrc) {
                <video #burstVid [class.hidden-vid]="state !== 'burst'"
                       [src]="burstSrc" [muted]="true" playsinline preload="auto"
                       (ended)="onBurstEnded()"></video>
              }
              <div class="corner tl" [style.border-color]="theme.ambient"></div>
              <div class="corner tr" [style.border-color]="theme.ambient"></div>
              <div class="corner bl" [style.border-color]="theme.ambient"></div>
              <div class="corner br" [style.border-color]="theme.ambient"></div>
            </div>
            <div class="charge-track"><div class="charge-fill" [style.width.%]="chargePct"></div></div>
          </div>

          <div class="status">
            @if (state === 'idle') {
              <div class="status-title">Ready to unseal</div>
              <div class="status-sub">Tap OPEN to reveal your reward</div>
            } @else if (state === 'opening') {
              <div class="status-title opening">UNSEALING<span class="dot">.</span><span class="dot d2">.</span><span class="dot d3">.</span></div>
              <div class="status-sub">reading your reward</div>
            } @else {
              <div class="status-title tease" [style.color]="theme.ambient">{{ theme.tease }}</div>
              <div class="status-sub">hold tight…</div>
            }
          </div>

          <div class="btn-row">
            @if (state === 'idle') {
              <button class="open-btn" (click)="open()">OPEN BOX</button>
            } @else {
              <div class="opening-pill">OPENING…</div>
              <button class="skip-btn" (click)="skip()">SKIP <span style="font-size:14px;">⏭</span></button>
            }
          </div>
        }

        @if (state === 'revealed' && result) {
          <div class="reveal">
            @if (!result.wasDuplicate) {
              <div class="confetti-layer">
                <div class="conf" style="left:20%;width:9px;height:9px;border-radius:2px;animation:confFall1 1.6s ease-in infinite;" [style.background]="theme.ambient"></div>
                <div class="conf" style="left:44%;width:8px;height:8px;border-radius:50%;background:#C6E63B;animation:confFall2 1.8s ease-in infinite;"></div>
                <div class="conf" style="left:64%;width:10px;height:6px;border-radius:2px;background:#2E6BE6;animation:confFall3 1.5s ease-in infinite;"></div>
                <div class="conf" style="left:78%;width:8px;height:8px;border-radius:50%;animation:confFall1 1.7s ease-in .2s infinite;" [style.background]="theme.ambient"></div>
              </div>
            }
            <div class="reward-frame"
                 [style.background]="'linear-gradient(150deg, ' + theme.ambient + ', ' + theme.dim + ')'"
                 [style.box-shadow]="'0 20px 40px -20px ' + theme.glow + ', 0 0 0 4px ' + theme.soft">
              <div class="reward-art">
                <img [src]="result.imagePath" [alt]="result.name"
                     [style.filter]="result.wasDuplicate ? 'grayscale(.85) brightness(1.02)' : 'none'">
                <div class="holo"></div>
                <div class="ribbon" [style.color]="theme.ink" [style.background]="theme.ambient"
                     [style.box-shadow]="'0 6px 14px -6px ' + theme.glow">{{ theme.ribbon }}</div>
                @if (!result.wasDuplicate) {
                  <div class="new-chip">✦ NEW</div>
                } @else {
                  <div class="dup-overlay"><span>ALREADY IN COLLECTION</span></div>
                }
              </div>
            </div>
            <div class="reward-name-wrap">
              <div class="reward-name">{{ result.name }}</div>
              <div class="reward-sub">{{ rewardSub }}</div>
            </div>
            @if (result.wasDuplicate) {
              <div class="xp-panel">
                <div class="xp-num">+{{ displayedXp }}</div>
                <div class="xp-copy">
                  <div class="xp-copy-title">XP AWARDED</div>
                  <div class="xp-copy-sub">duplicate converted to XP</div>
                </div>
              </div>
            }
            <div class="reveal-btns">
              @if (result.itemId && !equipped) {
                <button class="another-btn" (click)="equip()" [disabled]="equipping">{{ equipping ? 'EQUIPPING…' : ('EQUIP ' + (result.type === 'border' ? 'BORDER' : 'AVATAR')) }}</button>
              }
              @if (result.remainingBoxes > 0) {
                <button class="another-btn" (click)="reset()">OPEN ANOTHER · {{ result.remainingBoxes }}</button>
              }
              <button class="done-btn" [class.wide]="result.remainingBoxes === 0 && (equipped || !result.itemId)" (click)="close()">{{ equipped ? '✓ EQUIPPED' : 'DONE' }}</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class LootBoxModalComponent {
  @ViewChild('burstVid') burstVid?: ElementRef<HTMLVideoElement>;

  state: ModalState = 'idle';
  result: OpenBoxResult | null = null;
  burstSrc = '';
  displayedXp = 0;
  lastRemaining: number | undefined = undefined;
  equipping = false;
  equipped = false;

  private pendingResult: OpenBoxResult | null = null;
  private skipRequested = false;
  private opensCount = 0;
  private burstFallbackId: ReturnType<typeof setTimeout> | null = null;
  private xpTickerId = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { userId: string; pending?: number },
    private dialogRef: MatDialogRef<LootBoxModalComponent>,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  // Rarity theme is neutral until the API tells us what dropped; the burst
  // (and reveal) then tint the chrome.
  get theme(): RarityTheme {
    const rarity = this.result?.rarity ?? this.pendingResult?.rarity;
    return (rarity && THEMES[rarity]) || THEMES['neutral'];
  }

  get chargePct(): number {
    return this.state === 'idle' ? 0 : this.state === 'opening' ? 62 : 100;
  }

  get remainingDisplay(): number {
    return this.lastRemaining ?? this.data.pending ?? 0;
  }

  get rewardSub(): string {
    if (!this.result) return '';
    const kind = this.result.type === 'avatar' ? 'Avatar' : 'Profile border';
    return this.result.wasDuplicate ? 'Already owned' : `${kind} · loot-box exclusive`;
  }

  open(): void {
    if (this.state !== 'idle') return;
    this.state = 'opening';
    this.skipRequested = false;
    this.opensCount++;

    this.api.openBox(this.data.userId).subscribe({
      next: result => {
        this.pendingResult = result;
        this.lastRemaining = result.remainingBoxes;
        this.burstSrc = `assets/videos/lootbox-open-${result.rarity}.mp4`;
        if (this.skipRequested) { this.finishReveal(); return; }
        // Safety net: if the idle loop never hits its boundary, burst anyway.
        this.burstFallbackId = setTimeout(() => this.startBurst(), 3500);
      },
      error: () => {
        this.state = 'idle';
        this.snackBar.open('Failed to open box. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }

  // The idle clip's first/last frames match the burst clips' first frame,
  // so cutting at the loop boundary is seamless.
  onIdleTick(idle: HTMLVideoElement): void {
    if (this.state === 'opening' && this.pendingResult && idle.currentTime < 0.15) {
      this.startBurst();
    }
  }

  skip(): void {
    this.skipRequested = true;
    if (this.pendingResult) this.finishReveal();
    // else: API still in flight — reveal fires as soon as it responds
  }

  private startBurst(): void {
    if (this.state !== 'opening' || !this.pendingResult) return;
    this.clearFallback();

    this.state = 'burst';
    const vid = this.burstVid?.nativeElement;
    if (vid) {
      // Repeat opens skip some ceremony
      vid.playbackRate = this.opensCount > 1 ? 1.5 : 1;
      vid.play().catch(() => this.finishReveal());
    } else {
      this.finishReveal();
    }
  }

  onBurstEnded(): void {
    this.finishReveal();
  }

  private finishReveal(): void {
    if (this.state === 'revealed' || !this.pendingResult) return;
    this.clearFallback();
    this.result = this.pendingResult;
    this.pendingResult = null;
    this.state = 'revealed';
    if (this.result.wasDuplicate) this.startXpCountUp(this.result.duplicateXpAwarded);
  }

  reset(): void {
    this.result = null;
    this.burstSrc = '';
    this.displayedXp = 0;
    this.skipRequested = false;
    this.equipping = false;
    this.equipped = false;
    this.state = 'idle';
  }

  /** Equip the just-pulled avatar/border immediately from the reveal. */
  equip(): void {
    const r = this.result;
    if (!r?.itemId || this.equipping || this.equipped) return;
    this.equipping = true;
    const done = () => {
      this.equipping = false;
      this.equipped = true;
      this.snackBar.open(`${r.name} equipped!`, '', { duration: 2500, panelClass: 's4y-toast' });
    };
    const fail = () => {
      this.equipping = false;
      this.snackBar.open('Failed to equip. Please try again.', '', { duration: 2500 });
    };
    const req = r.type === 'avatar'
      ? this.api.setActiveAvatar(this.data.userId, r.itemId)
      : this.api.equipBorder(this.data.userId, r.itemId);
    req.subscribe({ next: done, error: fail });
  }

  close(): void {
    this.dialogRef.close(this.lastRemaining);
  }

  private clearFallback(): void {
    if (this.burstFallbackId) { clearTimeout(this.burstFallbackId); this.burstFallbackId = null; }
  }

  private startXpCountUp(target: number): void {
    cancelAnimationFrame(this.xpTickerId);
    const start = performance.now();
    const duration = 650;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      this.displayedXp = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) this.xpTickerId = requestAnimationFrame(tick);
    };
    this.xpTickerId = requestAnimationFrame(tick);
  }
}
