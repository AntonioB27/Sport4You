import { Component, AfterViewInit, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';
import { ActivityLoggedService } from '../../services/activity-logged.service';

interface Sport {
  key: string; name: string; label: string; unit: string;
  step: number; min: number; ppu: number; video: string; bg: string; pose: string;
}

const SPORTS: Sport[] = [
  { key:'running',     name:'Running',     label:'DISTANCE', unit:'km',    step:0.5, min:0.5, ppu:100,  video:'assets/videos/sporty_rn.mp4',  bg:'linear-gradient(160deg,#7f1515,#c62828 45%,#e53935)', pose:'assets/sporty_running.png' },
  { key:'walking',     name:'Walking',     label:'DISTANCE', unit:'km',    step:0.5, min:0.5, ppu:50,   video:'assets/videos/sporty_wlk.mp4', bg:'linear-gradient(160deg,#0d47a1,#1565c0 45%,#1e88e5)', pose:'assets/sporty_walking.png' },
  { key:'cycling',     name:'Cycling',     label:'DISTANCE', unit:'km',    step:1,   min:1,   ppu:25,   video:'assets/videos/sporty_bk.mp4',  bg:'linear-gradient(160deg,#1b5e20,#2e7d32 45%,#43a047)', pose:'assets/sporty_bike.png' },
  { key:'swimming',    name:'Swimming',    label:'DURATION', unit:'min',   step:5,   min:5,   ppu:15,   video:'assets/videos/sporty_sw.mp4',  bg:'linear-gradient(160deg,#004d40,#00695c 45%,#00897b)', pose:'assets/sporty_swimming.png' },
  { key:'gym',         name:'Gym',         label:'DURATION', unit:'min',   step:5,   min:5,   ppu:5,    video:'assets/videos/sporty_wl.mp4',  bg:'linear-gradient(160deg,#4a148c,#6a1b9a 45%,#8e24aa)', pose:'assets/sporty_gym.png' },
  { key:'daily_steps', name:'Daily Steps', label:'STEPS',    unit:'steps', step:500, min:500, ppu:0.01, video:'',                             bg:'linear-gradient(160deg,#bf360c,#d84315 45%,#f4511e)', pose:'assets/sporty_wave.png' },
];

@Component({
  selector: 'app-log-activity-dialog',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule],
  styles: [`
    @keyframes s4y-conf { 0%{transform:translateY(-14px) rotate(0);opacity:0} 15%{opacity:1} 100%{transform:translateY(360px) rotate(420deg);opacity:0} }
    @keyframes s4y-pop  { 0%{transform:scale(.5) rotate(-8deg);opacity:0} 55%{transform:scale(1.1) rotate(3deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
    @keyframes s4y-glow { 0%,100%{opacity:.55;transform:translateX(-50%) scale(1)} 50%{opacity:1;transform:translateX(-50%) scale(1.06)} }

    :host { display:block; font-family:'Nunito',system-ui,sans-serif; }

    .card {
      position:relative; width:540px; max-width:100%;
      background:linear-gradient(180deg,#12213f,#0e1a34);
      border:1px solid rgba(122,150,210,.18); border-radius:34px;
      padding:26px 30px 30px; box-shadow:0 60px 120px -40px rgba(4,10,30,.9);
      overflow:hidden;
    }

    /* header */
    .hdr { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:4px; }
    .hdr-sub { font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; letter-spacing:.26em; color:#7fa8ff; }
    .hdr-title { font-family:'Chakra Petch',sans-serif; font-size:26px; font-weight:700; color:#fff; line-height:1.05; margin-top:2px; }
    .close-btn {
      width:38px; height:38px; border-radius:12px; border:1px solid rgba(122,150,210,.2);
      background:rgba(255,255,255,.06); display:flex; align-items:center; justify-content:center;
      cursor:pointer; color:#9fb2d6; font-size:18px; font-weight:800;
      font-family:'Chakra Petch',sans-serif; flex-shrink:0;
      transition:background .15s;
    }
    .close-btn:hover { background:rgba(255,255,255,.14); }

    /* morph picker */
    .morph-row { display:flex; align-items:center; gap:8px; margin:6px 0 4px; }
    .morph-label { font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700; letter-spacing:.16em; color:#6f86b3; white-space:nowrap; }
    .morph-tabs { display:flex; gap:6px; flex:1; }
    .morph-tab {
      position:relative; flex:1; text-align:center; padding:7px 4px 8px; border-radius:10px;
      cursor:pointer; background:rgba(255,255,255,.05); border:1px solid rgba(122,150,210,.16);
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; color:#c7d5f0;
      transition:background .15s;
    }
    .morph-tab:hover { background:rgba(255,255,255,.1); }
    .morph-tab.active .tab-line { display:block; }
    .tab-line { display:none; position:absolute; left:22%; right:22%; bottom:3px; height:3px; border-radius:3px; background:#C6E63B; box-shadow:0 0 8px rgba(198,230,59,.9); }

    /* watch area */
    .watch-area { position:relative; width:100%; height:378px; display:flex; align-items:center; justify-content:center; margin-top:6px; }
    .arrow {
      position:absolute; top:50%; transform:translateY(-50%); z-index:20;
      width:48px; height:48px; border-radius:50%; border:1px solid rgba(122,150,210,.28);
      background:rgba(255,255,255,.07); backdrop-filter:blur(6px);
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; color:#eaf1ff; font-size:24px; font-weight:900;
      font-family:'Chakra Petch',sans-serif; transition:background .15s, border-color .15s;
    }
    .arrow:hover { background:rgba(198,230,59,.22); border-color:rgba(198,230,59,.6); }
    .arrow.left { left:6px; }
    .arrow.right { right:6px; }

    /* watch body */
    .watch-body { position:relative; width:326px; height:326px; }
    .strap-top { position:absolute; left:50%; top:-14px; transform:translateX(-50%); width:150px; height:40px; border-radius:16px 16px 6px 6px; background:linear-gradient(180deg,#26314c,#1a2237); }
    .strap-bot { position:absolute; left:50%; bottom:-14px; transform:translateX(-50%); width:150px; height:40px; border-radius:6px 6px 16px 16px; background:linear-gradient(0deg,#26314c,#1a2237); }
    .crown { position:absolute; right:-9px; top:38%; width:12px; height:34px; border-radius:4px; background:linear-gradient(90deg,#9fb0cf,#5d6c8c); }
    .crown-btn { position:absolute; right:-7px; top:56%; width:9px; height:22px; border-radius:3px; background:linear-gradient(90deg,#8d9dbb,#57667f); }
    .bezel { position:absolute; inset:0; border-radius:50%; background:conic-gradient(from 210deg,#414d68,#232d45 25%,#4a5675 50%,#1c2438 72%,#3a4560 100%); box-shadow:0 24px 50px -18px rgba(0,0,0,.75),inset 0 3px 6px rgba(255,255,255,.12),inset 0 -6px 14px rgba(0,0,0,.55); }
    .tick-bg  { position:absolute; inset:12px; border-radius:50%; background:#0a1120; box-shadow:inset 0 0 0 1px rgba(150,170,210,.14); }
    .ticks    { position:absolute; inset:12px; border-radius:50%; pointer-events:none; background:repeating-conic-gradient(from 0deg,rgba(160,180,220,.5) 0deg 0.5deg,transparent 0.5deg 6deg); -webkit-mask:radial-gradient(circle,transparent 0 90%,#000 90% 97%,transparent 97%); mask:radial-gradient(circle,transparent 0 90%,#000 90% 97%,transparent 97%); }

    /* watch face (inner) */
    .face { position:absolute; inset:22px; border-radius:50%; overflow:hidden; background:#000; perspective:1000px; box-shadow:inset 0 0 0 3px #05070f,inset 0 0 30px rgba(0,0,0,.6); }
    .layer {
      position:absolute; inset:0; border-radius:50%; overflow:hidden;
      transform-origin:50% 50%; will-change:transform,opacity,filter;
    }
    .layer-bg { position:absolute; inset:0; }
    .layer video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    .sweep-band { position:absolute; top:-20%; bottom:-20%; left:-30%; width:38%; z-index:15; opacity:0; transform:translateX(-140%) rotate(8deg); background:linear-gradient(90deg,transparent,rgba(198,230,59,.15) 30%,rgba(255,255,255,.95) 50%,rgba(198,230,59,.15) 70%,transparent); filter:blur(2px); pointer-events:none; }
    .glass { position:absolute; inset:0; z-index:16; pointer-events:none; border-radius:50%; background:radial-gradient(120% 90% at 30% 12%,rgba(255,255,255,.22),transparent 45%),radial-gradient(100% 100% at 50% 50%,transparent 62%,rgba(0,0,0,.5) 100%); }

    /* HUD */
    .hud-sport {
      position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:17;
      display:inline-flex; align-items:center; gap:6px;
      background:rgba(6,12,26,.5); backdrop-filter:blur(4px);
      border:1px solid rgba(198,230,59,.35); border-radius:999px; padding:5px 14px;
      white-space:nowrap;
    }
    .hud-dot { width:7px; height:7px; border-radius:50%; background:#C6E63B; box-shadow:0 0 6px #C6E63B; flex-shrink:0; }
    .hud-sport-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; letter-spacing:.14em; color:#fff; }
    .hud-bottom { position:absolute; bottom:22px; left:50%; transform:translateX(-50%); z-index:17; text-align:center; white-space:nowrap; }
    .hud-val { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:22px; color:#fff; line-height:1; text-shadow:0 2px 8px rgba(0,0,0,.7); }
    .hud-unit { font-size:12px; color:#dbe8ff; margin-left:3px; }
    .hud-pts { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; letter-spacing:.1em; color:#C6E63B; text-shadow:0 1px 6px rgba(0,0,0,.8); margin-top:3px; }

    /* dots */
    .dots { display:flex; align-items:center; justify-content:center; gap:7px; margin-top:16px; }
    .dot { height:6px; border-radius:999px; transition:all .4s ease; }

    /* amount input */
    .amount-row {
      display:flex; align-items:center; justify-content:space-between;
      margin:16px 0 14px; background:rgba(255,255,255,.04);
      border:1px solid rgba(122,150,210,.16); border-radius:18px; padding:12px 16px;
    }
    .amount-left { min-width:0; }
    .amount-label { font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700; letter-spacing:.16em; color:#6f86b3; }
    .amount-field { display:flex; align-items:baseline; gap:6px; margin-top:2px; }
    .amount-input { width:120px; background:transparent; border:none; outline:none; padding:0; font-family:'Chakra Petch',sans-serif; font-size:26px; font-weight:700; color:#fff; line-height:1; }
    .amount-unit { font-family:'Chakra Petch',sans-serif; font-size:13px; font-weight:700; color:#9fb2d6; }
    .amount-btns { display:flex; gap:9px; }
    .amt-btn {
      width:44px; height:44px; border-radius:14px; border:1px solid rgba(122,150,210,.24);
      display:flex; align-items:center; justify-content:center; cursor:pointer;
      font-size:26px; font-weight:800; line-height:1; transition:background .15s;
    }
    .amt-btn.dec { background:rgba(255,255,255,.06); color:#bcd0f2; }
    .amt-btn.dec:hover { background:rgba(255,255,255,.12); }
    .amt-btn.inc { background:#2E6BE6; color:#fff; box-shadow:0 8px 16px -8px rgba(46,107,230,.8); border-color:transparent; }
    .amt-btn.inc:hover { background:#255ecb; }

    /* error */
    .err { font-family:'Chakra Petch',sans-serif; font-size:12px; color:#ef5350; text-align:center; margin:-8px 0 8px; }

    /* log button */
    .log-btn {
      display:block; width:100%; text-align:center;
      background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:17px; letter-spacing:.05em;
      padding:16px; border-radius:16px; cursor:pointer; border:none;
      box-shadow:0 0 26px rgba(198,230,59,.45),0 6px 0 #7c9c00;
      transition:filter .15s;
    }
    .log-btn:hover { filter:brightness(1.04); }
    .log-btn:active { transform:translateY(4px); box-shadow:0 0 26px rgba(198,230,59,.45),0 2px 0 #7c9c00; }
    .log-btn:disabled { opacity:.5; cursor:not-allowed; }

    /* spinner row */
    .spinner-row { display:flex; justify-content:center; margin-bottom:8px; }

    /* confirmation overlay */
    .conf {
      margin:-26px -30px -30px;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      text-align:center; padding:40px 30px 36px; overflow:hidden;
      background:radial-gradient(100% 60% at 50% 4%,rgba(198,230,59,.3),transparent 55%),
                 linear-gradient(180deg,#2E6BE6,#163a8f);
    }
    .conf-particle { position:absolute; border-radius:2px; }
    .conf-tag { font-family:'Chakra Petch',sans-serif; font-size:13px; letter-spacing:.3em; font-weight:700; color:#C6E63B; text-shadow:0 0 14px rgba(198,230,59,.7); }
    .conf-mascot { position:relative; width:180px; height:190px; margin:6px 0; }
    .conf-mascot-shadow { position:absolute; left:50%; bottom:8px; width:118px; height:26px; border-radius:50%; background:radial-gradient(closest-side,rgba(198,230,59,.6),transparent); filter:blur(4px); animation:s4y-glow 2s ease-in-out infinite; }
    .conf-mascot img { position:relative; width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 12px 16px rgba(0,0,0,.3)); animation:s4y-pop .6s ease-out both; }
    .conf-pts { font-family:'Chakra Petch',sans-serif; font-size:58px; line-height:.9; font-weight:700; color:#fff; text-shadow:0 0 26px rgba(198,230,59,.55); }
    .conf-pts-label { font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700; letter-spacing:.28em; color:#C6E63B; margin-bottom:12px; }
    .conf-xp { font-family:'Chakra Petch',sans-serif; font-size:1.1rem; font-weight:600; color:#C6E63B; letter-spacing:.05em; margin-top:2px; }
    .conf-pill { display:inline-flex; align-items:center; gap:8px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.32); color:#fff; font-family:'Chakra Petch',sans-serif; font-weight:700; padding:8px 16px; border-radius:999px; font-size:13px; }
    .conf-done { margin-top:20px; background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; letter-spacing:.05em; padding:13px 34px; border-radius:14px; cursor:pointer; border:none; box-shadow:0 6px 0 #7c9c00; transition:transform .1s, box-shadow .1s; }
    .conf-done:active { transform:translateY(3px); box-shadow:0 3px 0 #7c9c00; }
  `],
  template: `
    <div class="card">
      @if (!logged) {
      <!-- Header -->
      <div class="hdr">
        <div>
          <div class="hdr-sub">SPORT4YOU</div>
          <div class="hdr-title">Log Activity</div>
        </div>
        <div class="close-btn" (click)="close()">✕</div>
      </div>

      <!-- World Morph picker (hidden — sweep is active; UI kept for future use) -->

      <!-- Watch area -->
      <div class="watch-area">
        <div class="arrow left"  (click)="change(-1)">‹</div>
        <div class="arrow right" (click)="change(1)">›</div>

        <div class="watch-body">
          <div class="strap-top"></div>
          <div class="strap-bot"></div>
          <div class="crown"></div>
          <div class="crown-btn"></div>
          <div class="bezel"></div>
          <div class="tick-bg"></div>
          <div class="ticks"></div>

          <div class="face">
            <!-- Layer A -->
            <div #wrapA class="layer" style="opacity:1;z-index:2;">
              <div #bgA class="layer-bg"></div>
              <video #vidA muted loop playsinline preload="auto"></video>
            </div>
            <!-- Layer B -->
            <div #wrapB class="layer" style="opacity:0;z-index:1;">
              <div #bgB class="layer-bg"></div>
              <video #vidB muted loop playsinline preload="auto"></video>
            </div>
            <!-- Sweep band -->
            <div #sweepBand class="sweep-band"></div>
            <!-- Glass -->
            <div class="glass"></div>

            <!-- HUD: sport name -->
            <div class="hud-sport">
              <span class="hud-dot"></span>
              <span class="hud-sport-name">{{ sport.name.toUpperCase() }}</span>
            </div>
            <!-- HUD: metric + points -->
            <div class="hud-bottom">
              <div class="hud-val">{{ displayValue }}<span class="hud-unit">{{ sport.unit }}</span></div>
              <div class="hud-pts">+{{ previewPoints }} PTS</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dots -->
      <div class="dots">
        <span *ngFor="let d of dotList" class="dot" [style.width]="d.w" [style.background]="d.bg"></span>
      </div>

      <!-- Amount input -->
      <div class="amount-row">
        <div class="amount-left">
          <div class="amount-label">{{ sport.label }} COMPLETED</div>
          <div class="amount-field">
            <input #amtInput class="amount-input" type="text" inputmode="decimal"
                   (input)="onInputChange($event)"
                   (blur)="onInputBlur()" />
            <span class="amount-unit">{{ sport.unit }}</span>
          </div>
        </div>
        <div class="amount-btns">
          <div class="amt-btn dec" (click)="bump(-1)">–</div>
          <div class="amt-btn inc" (click)="bump(1)">+</div>
        </div>
      </div>

      <div class="err" *ngIf="errorMsg">{{ errorMsg }}</div>

      <div class="spinner-row" *ngIf="loading">
        <mat-spinner diameter="28"></mat-spinner>
      </div>

      <button class="log-btn" [disabled]="loading" (click)="logActivity()">
        LOG {{ sport.name.toUpperCase() }} · +{{ previewPoints }} PTS
      </button>
      }

      <!-- Confirmation overlay -->
      @if (logged) {
      <div class="conf">
        <!-- confetti particles -->
        <div class="conf-particle" style="left:14%;top:8%;width:11px;height:11px;background:#C6E63B;animation:s4y-conf 2.4s ease-in infinite;"></div>
        <div class="conf-particle" style="left:38%;top:5%;width:10px;height:10px;background:#FFD54A;border-radius:50%;animation:s4y-conf 2.9s ease-in .3s infinite;"></div>
        <div class="conf-particle" style="left:62%;top:7%;width:12px;height:12px;background:#fff;animation:s4y-conf 2.2s ease-in .5s infinite;"></div>
        <div class="conf-particle" style="left:84%;top:11%;width:10px;height:10px;background:#C6E63B;border-radius:50%;animation:s4y-conf 3.1s ease-in .1s infinite;"></div>
        <div class="conf-particle" style="left:26%;top:4%;width:9px;height:9px;background:#FFD54A;animation:s4y-conf 2.6s ease-in .7s infinite;"></div>

        <div class="conf-tag">ACTIVITY LOGGED</div>
        <div class="conf-mascot">
          <div class="conf-mascot-shadow"></div>
          <img [src]="confirmedPose" alt="Spotry" />
        </div>
        <div class="conf-pts">+{{ earnedPoints }}</div>
        <div class="conf-pts-label">POINTS EARNED</div>
        @if (earnedXp > 0) {
          <div class="conf-xp">+{{ earnedXp }} XP</div>
        }
        <div class="conf-pill">{{ sport.name.toUpperCase() }} · {{ displayValue }} {{ sport.unit }}</div>
        <button class="conf-done" (click)="done()">DONE 🎉</button>
      </div>
      }
    </div>
  `,
})
export class LogActivityDialogComponent implements AfterViewInit {
  @ViewChild('wrapA', { read: ElementRef }) wrapA!: ElementRef<HTMLDivElement>;
  @ViewChild('wrapB', { read: ElementRef }) wrapB!: ElementRef<HTMLDivElement>;
  @ViewChild('bgA',   { read: ElementRef }) bgA!: ElementRef<HTMLDivElement>;
  @ViewChild('bgB',   { read: ElementRef }) bgB!: ElementRef<HTMLDivElement>;
  @ViewChild('vidA',  { read: ElementRef }) vidA!: ElementRef<HTMLVideoElement>;
  @ViewChild('vidB',  { read: ElementRef }) vidB!: ElementRef<HTMLVideoElement>;
  @ViewChild('sweepBand', { read: ElementRef }) sweepBandEl!: ElementRef<HTMLDivElement>;
  @ViewChild('amtInput',  { read: ElementRef }) amtInput!: ElementRef<HTMLInputElement>;

  readonly sports = SPORTS;
  selIdx = 0;
  morphStyle: 'ripple'|'iris'|'portal'|'sweep' = 'sweep';
  metrics: Record<string, number> = { running:5, walking:5, cycling:20, swimming:30, gym:45, daily_steps:5000 };
  logged = false;
  loading = false;
  errorMsg = '';
  earnedPoints = 0;
  earnedXp = 0;
  confirmedPose = '';
  frontIdx = 0;
  busy = false;

  constructor(
    private dialogRef: MatDialogRef<LogActivityDialogComponent>,
    private api: ApiService,
    private activityLogged: ActivityLoggedService,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar,
  ) {}

  ngAfterViewInit() {
    this.applyBg(this.wrapA.nativeElement, this.bgA.nativeElement, this.sports[0]);
    this.loadVideo(this.vidA.nativeElement, this.sports[0]);
    this.syncInput();
  }

  get sport() { return this.sports[this.selIdx]; }
  get value()  { return this.metrics[this.sport.key]; }

  get previewPoints() {
    return Math.max(0, Math.floor(this.value * this.sport.ppu)).toLocaleString('en-US');
  }

  get displayValue() {
    const v = this.value; const sp = this.sport;
    if (sp.unit === 'steps') return v.toLocaleString('en-US');
    if (sp.unit === 'km') return v.toFixed(1);
    return String(v);
  }

  get dotList() {
    return this.sports.map((_, i) => ({
      w: i === this.selIdx ? '22px' : '6px',
      bg: i === this.selIdx ? '#C6E63B' : 'rgba(159,178,214,.35)',
    }));
  }

  private applyBg(wrap: HTMLDivElement, bg: HTMLDivElement, sp: Sport) {
    bg.style.background = sp.bg;
    bg.style.position = 'absolute';
    bg.style.inset = '0';
  }

  private loadVideo(vid: HTMLVideoElement, sp: Sport) {
    if (!sp.video) return;
    vid.src = sp.video;
    vid.play().catch(() => {});
  }

  private frontWrap(): HTMLDivElement { return [this.wrapA, this.wrapB][this.frontIdx].nativeElement; }
  private backWrap():  HTMLDivElement { return [this.wrapA, this.wrapB][1 - this.frontIdx].nativeElement; }
  private frontBg():   HTMLDivElement { return [this.bgA,   this.bgB][this.frontIdx].nativeElement; }
  private backBg():    HTMLDivElement { return [this.bgA,   this.bgB][1 - this.frontIdx].nativeElement; }
  private frontVid():  HTMLVideoElement { return [this.vidA, this.vidB][this.frontIdx].nativeElement; }
  private backVid():   HTMLVideoElement { return [this.vidA, this.vidB][1 - this.frontIdx].nativeElement; }

  syncInput() {
    if (!this.amtInput?.nativeElement) return;
    this.amtInput.nativeElement.value = this.displayValue;
  }

  onInputChange(e: Event) {
    const raw = (e.target as HTMLInputElement).value.replace(/[^0-9.]/g, '');
    const num = parseFloat(raw);
    if (!isNaN(num)) this.metrics[this.sport.key] = num;
  }

  onInputBlur() {
    let v = this.value;
    const sp = this.sport;
    if (isNaN(v) || v < sp.min) v = sp.min;
    v = Math.round(v * 100) / 100;
    this.metrics[sp.key] = v;
    this.syncInput();
  }

  bump(dir: 1 | -1) {
    const sp = this.sport;
    const nx = Math.max(sp.min, Math.round((this.value + dir * sp.step) * 100) / 100);
    this.metrics[sp.key] = nx;
    this.syncInput();
  }

  private wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

  private resetWrap(el: HTMLDivElement, isFront: boolean) {
    el.style.opacity = isFront ? '1' : '0';
    el.style.zIndex  = isFront ? '2' : '1';
    el.style.transform = 'none';
    el.style.filter    = 'none';
    (el.style as any).clipPath = 'none';
    (el.style as any).backfaceVisibility = '';
  }

  private async runTransition(front: HTMLDivElement, back: HTMLDivElement) {
    const D = 820;
    const st = this.morphStyle;
    if (st === 'iris') {
      back.style.opacity = '1'; back.style.zIndex = '3';
      (back.style as any).clipPath = 'circle(0% at 50% 50%)';
      front.animate([{transform:'scale(1)',filter:'blur(0px) brightness(1)'},{transform:'scale(1.35)',filter:'blur(12px) brightness(1.35)'}],{duration:D,easing:'ease-in',fill:'forwards'});
      await back.animate([{clipPath:'circle(0% at 50% 50%)'},{clipPath:'circle(80% at 50% 50%)'}],{duration:D,easing:'cubic-bezier(.66,0,.34,1)'}).finished;
    } else if (st === 'ripple') {
      back.style.opacity = '0'; back.style.zIndex = '3';
      front.animate([{filter:'blur(0px) saturate(1)',transform:'scale(1)',opacity:'1'},{filter:'blur(18px) saturate(1.9)',transform:'scale(.88)',opacity:'0'}],{duration:D*.75,easing:'ease-in',fill:'forwards'});
      await back.animate([{opacity:'0',filter:'blur(20px) saturate(2) hue-rotate(25deg)',transform:'scale(1.22)'},{opacity:'1',filter:'blur(0px) saturate(1) hue-rotate(0deg)',transform:'scale(1)'}],{duration:D,easing:'cubic-bezier(.5,0,.2,1)'}).finished;
    } else if (st === 'portal') {
      back.style.opacity = '1'; back.style.zIndex = '3';
      back.style.backfaceVisibility = 'hidden'; front.style.backfaceVisibility = 'hidden';
      back.style.transform = 'rotateY(90deg)';
      await front.animate([{transform:'rotateY(0deg)',filter:'brightness(1)'},{transform:'rotateY(-92deg)',filter:'brightness(.5)'}],{duration:D*.5,easing:'cubic-bezier(.5,0,.9,.4)',fill:'forwards'}).finished;
      await back.animate([{transform:'rotateY(92deg)',filter:'brightness(.5)'},{transform:'rotateY(0deg)',filter:'brightness(1)'}],{duration:D*.5,easing:'cubic-bezier(.1,.6,.5,1)',fill:'forwards'}).finished;
    } else {
      const band = this.sweepBandEl.nativeElement;
      back.style.opacity = '1'; back.style.zIndex = '3';
      (back.style as any).clipPath = 'inset(0 100% 0 0)';
      band.style.opacity = '1';
      band.animate([{transform:'translateX(-150%) rotate(8deg)'},{transform:'translateX(320%) rotate(8deg)'}],{duration:D,easing:'ease-in-out'});
      await back.animate([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)'}],{duration:D,easing:'ease-in-out'}).finished;
      band.style.opacity = '0';
    }
  }

  async change(dir: 1 | -1) {
    if (this.busy || this.logged) return;
    const next = (this.selIdx + dir + this.sports.length) % this.sports.length;
    this.busy = true;

    const back = this.backWrap(); const front = this.frontWrap();
    this.applyBg(back, this.backBg(), this.sports[next]);
    this.loadVideo(this.backVid(), this.sports[next]);

    try {
      await Promise.race([this.runTransition(front, back).catch(() => {}), this.wait(1050)]);
    } finally {
      const bi = 1 - this.frontIdx;
      this.resetWrap(back, true);
      this.resetWrap(front, false);
      this.frontVid().pause();
      this.frontIdx = bi;
      this.busy = false;
      this.selIdx = next;
      this.syncInput();
      this.cdr.detectChanges();
    }
  }

  logActivity() {
    if (this.loading || this.logged) return;
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    this.loading = true; this.errorMsg = '';

    const sp = this.sport; const val = this.value;
    const req: any = { userId, sport: sp.key, datetime: new Date().toISOString() };
    if (sp.unit === 'km')    req.distance = val;
    else if (sp.unit === 'min') { const m = Math.floor(val); const s = Math.round((val-m)*60); req.duration = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
    else req.steps = val;

    this.api.logActivity(req).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.earnedPoints = res.points;
        this.earnedXp = res.xpEarned ?? 0;
        this.confirmedPose = sp.pose;
        this.activityLogged.notify();
        this.logged = true;

        const missions: { description: string; xpEarned: number }[] = res.missionsCompleted ?? [];
        missions.forEach((m, i) => {
          setTimeout(() => {
            this.snackBar.open(
              `Quest complete! ${m.description} · +${m.xpEarned} XP`,
              '',
              { duration: 3500, panelClass: 's4y-toast' }
            );
          }, i * 600);
        });
      },
      error: () => {
        this.loading = false;
        this.errorMsg = 'Failed to log activity. Please try again.';
      },
    });
  }

  done() {
    this.dialogRef.close({ points: this.earnedPoints });
  }

  close() {
    this.dialogRef.close(this.logged ? { points: this.earnedPoints } : undefined);
  }
}
