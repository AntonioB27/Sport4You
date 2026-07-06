import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { LeaderboardEntry } from '../shared/models/leaderboard.model';
import { IconComponent } from '../shared/components/icon/icon.component';
import { SPORT_ICON_NAMES, SPORT_COLORS } from '../shared/constants/sport.constants';

const DEFAULT_BORDER = '2px solid rgba(46,107,230,.16)';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, IconComponent],
  styles: [`
    :host { display: block; }
    .page { padding: 32px 40px 60px; font-family: 'Nunito', system-ui, sans-serif; }
    .spinner-wrap { display: flex; justify-content: center; padding: 80px; }

    @keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes glowPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,206,40,.55)} 50%{box-shadow:0 0 0 12px rgba(255,206,40,0)} }
    @keyframes holoSweep { 0%{background-position:-160% 0} 100%{background-position:260% 0} }

    /* Filter-change reveal: opacity-only (not a slide/rise) because filtered views have
       different row counts — animating position too would fight the layout resize. */
    @keyframes lb-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .podium-fx, .lower-grid { animation: lb-fade-in .32s ease-out both; }
    @media (prefers-reduced-motion: reduce) {
      .podium-fx, .lower-grid { animation: none; }
    }

    /* ── Header ── */
    .lb-header { display:flex; align-items:center; gap:10px; font-family: 'Chakra Petch', sans-serif; font-size: 30px; font-weight: 700; color: #10203E; letter-spacing:.02em; margin-bottom: 24px; }
    .filter-row { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .sport-row { margin-bottom:22px; }
    .pill {
      border:1px solid #d6e0ee; background:#fff; color:#5c6881; cursor:pointer;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.05em;
      padding:8px 14px; display:inline-flex; align-items:center; gap:6px;
      clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
      transition: background .12s, color .12s;
    }
    .pill:hover { background:#F4F6FB; }
    .pill.active { background:linear-gradient(150deg,#2E6BE6,#1B47AE); color:#fff; border-color:transparent; }
    .sport-pill.active { background: var(--sport-color); color:#fff; border-color:transparent; }

    /* ── Podium ── */
    .podium-fx { filter: drop-shadow(0 26px 42px rgba(15,30,59,.55)); margin-bottom: 22px; }
    .podium {
      position: relative; overflow: hidden; padding: 30px 30px 0;
      background: radial-gradient(120% 130% at 50% -10%, #23407e, #0f1e3b 72%);
      clip-path: polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px);
    }
    .podium-glow { position:absolute; inset:0; background: radial-gradient(closest-side at 50% 20%, rgba(255,206,40,.16), transparent 60%); pointer-events:none; }
    .podium-row { position:relative; display:grid; grid-template-columns:1fr 1fr 1fr; align-items:end; gap:20px; max-width:820px; margin:0 auto; }
    .podium-slot { display:flex; flex-direction:column; align-items:center; cursor:pointer; }

    .champ-ring { position:relative; border-radius:50%; padding:3px; box-shadow:0 12px 24px -12px rgba(0,0,0,.5); }
    .champ-ring.silver { width:78px; height:78px; background:linear-gradient(160deg,#dfe6f2,#aeb9cc); }
    .champ-ring.bronze { width:78px; height:78px; background:linear-gradient(160deg,#f0c9a4,#cd7f32); }
    .champ-ring.gold { width:104px; height:104px; padding:4px; background:linear-gradient(160deg,#FFE58a,#F5B301); animation:glowPulse 2.2s ease-in-out infinite; box-shadow:none; }
    .champ-ring img, .champ-ring .champ-initial { width:100%; height:100%; border-radius:50%; object-fit:cover; object-position:50% 16%; }
    .champ-ring.gold img { animation:floaty 4s ease-in-out infinite; }
    .champ-initial { background:#2E6BE6; color:#fff; font-family:'Chakra Petch',sans-serif; font-weight:700; display:flex; align-items:center; justify-content:center; }
    .champ-ring.silver .champ-initial, .champ-ring.bronze .champ-initial { font-size:28px; }
    .champ-ring.gold .champ-initial { font-size:38px; }
    .holo { position:absolute; inset:0; border-radius:50%; background:linear-gradient(120deg, transparent 34%, rgba(255,255,255,.7) 50%, transparent 66%); background-size:220% 100%; animation:holoSweep 2.6s linear infinite; mix-blend-mode:screen; z-index:2; pointer-events:none; }

    .medal { position:absolute; bottom:-8px; left:50%; transform:translateX(-50%); border-radius:50%; border:2px solid #0f1e3b; display:flex; align-items:center; justify-content:center; font-family:'Chakra Petch',sans-serif; font-weight:700; color:#fff; }
    .medal.m2 { width:24px; height:24px; font-size:12px; background:#C0C0C0; }
    .medal.m3 { width:24px; height:24px; font-size:12px; background:#CD7F32; }
    .medal.m1 { width:28px; height:28px; bottom:-10px; font-size:14px; color:#3a2a00; background:linear-gradient(150deg,#FFE066,#F5B301); }

    .crown { font-size:30px; line-height:1; margin-bottom:2px; filter:drop-shadow(0 4px 8px rgba(255,206,40,.6)); }
    .champ-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:10px; letter-spacing:.2em; color:#FFDf6a; margin-top:16px; }
    .champ-name { font-family:'Chakra Petch',sans-serif; font-weight:700; color:#fff; }
    .champ-name.side { font-size:14px; margin-top:14px; }
    .champ-name.gold { font-size:17px; margin-top:3px; }
    .champ-pts { font-family:'Chakra Petch',sans-serif; font-weight:700; }
    .champ-pts.side { font-size:16px; color:#C6E63B; }
    .champ-pts.gold { font-size:22px; color:#FFDf6a; text-shadow:0 0 16px rgba(255,206,40,.6); }
    .bar { width:100%; margin-top:12px; }
    .bar.b1 { height:132px; border-radius:14px 14px 0 0; background:linear-gradient(180deg,#FFDf6a,#E39A00); box-shadow:0 0 30px -6px rgba(255,206,40,.7); }
    .bar.b2 { height:96px; border-radius:12px 12px 0 0; background:linear-gradient(180deg,#9aa6bd,#6b7690); }
    .bar.b3 { height:74px; border-radius:12px 12px 0 0; background:linear-gradient(180deg,#d99a5c,#a9642a); }

    /* ── Lower grid ── */
    .lower-grid { display:grid; grid-template-columns:1.75fr 1fr; gap:22px; align-items:start; }

    /* standings list */
    .list-fx { filter: drop-shadow(0 14px 26px rgba(16,32,62,.16)); }
    .list-card {
      position:relative; background:#fff; box-shadow: inset 0 0 0 1px #E6ECF6; overflow:hidden;
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
    }
    .list-header { display:grid; grid-template-columns:60px 1fr 150px 70px; padding:14px 22px 12px; border-bottom:1px solid #EAEEF6; }
    .list-header span { font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; letter-spacing:.14em; color:#8592ad; }
    .list-header .r { text-align:right; }

    .list-row {
      position:relative; display:grid; grid-template-columns:60px 1fr 150px 70px; padding:12px 22px; align-items:center;
      border-bottom:1px solid #F4F6FB; border-left:3px solid transparent; cursor:pointer; transition:background .12s;
    }
    .list-row:last-child { border-bottom:none; }
    .list-row:hover { background:#F9FBFF; }
    .list-row.top3 { background:#FCFAF2; }
    .list-row.me { background:#F6FBEA; border-left-color:#C6E63B; }

    .rank-chip { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:10px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; }
    .rank-chip.gold { background:#FFF3C4; color:#B78A00; }
    .rank-chip.silver { background:#EDEFF3; color:#707070; }
    .rank-chip.bronze { background:#FDE8D8; color:#8B4513; }
    .rank-chip.default { background:#F0F3FA; color:#8592ad; }
    .rank-chip.me { background:#DFF0A3; color:#4a6100; }

    .athlete { display:flex; align-items:center; gap:12px; min-width:0; }
    .av { width:38px; height:38px; border-radius:50%; object-fit:cover; object-position:50% 18%; flex-shrink:0; }
    .av-initial { background:#2E6BE6; color:#fff; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; display:inline-flex; align-items:center; justify-content:center; }
    .athlete-meta { min-width:0; }
    .name-row { display:flex; align-items:center; gap:8px; }
    .aname { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#10203E; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .you-badge { font-family:'Chakra Petch',sans-serif; font-size:9px; font-weight:700; letter-spacing:.1em; background:#C6E63B; color:#4a6100; padding:2px 7px; border-radius:999px; flex-shrink:0; }
    .glyph { font-size:11px; flex-shrink:0; }
    .prestige { font-family:'Chakra Petch',sans-serif; font-weight:800; font-size:11px; color:#F5A200; flex-shrink:0; }

    .gap-track { height:5px; width:160px; max-width:100%; border-radius:999px; background:#EEF2F8; margin-top:5px; overflow:hidden; }
    .gap-fill { height:100%; border-radius:999px; }
    .gap-fill.me { background:linear-gradient(90deg,#9ECf10,#C6E63B); }
    .gap-fill.top3 { background:linear-gradient(90deg,#F5B301,#FFE066); }
    .gap-fill.default { background:linear-gradient(90deg,#2E6BE6,#5a8cf0); }

    .pts-val { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; color:#10203E; }
    .pts-val.me { color:#4a6100; }
    .trend { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; text-align:right; }
    .trend.up { color:#2f9e4f; }
    .trend.down { color:#e5484d; }
    .trend.neutral { color:#9aa6bd; }

    .rival-btn {
      position:absolute; right:96px; top:50%; transform:translateY(-50%);
      opacity:0; pointer-events:none; transition:opacity .12s;
      border:1px solid #d6e0ee; cursor:pointer; background:#fff;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:10px; letter-spacing:.06em;
      color:#5c6881; padding:6px 11px; border-radius:8px; box-shadow:0 4px 10px -4px rgba(16,32,62,.3);
    }
    .list-row:hover .rival-btn { opacity:1; pointer-events:auto; }
    .rival-btn:hover { opacity:.85; }
    .rival-btn.active { opacity:1; pointer-events:auto; color:#fff; background:linear-gradient(150deg,#2E6BE6,#1B47AE); border-color:transparent; }

    /* right rail */
    .rail { display:flex; flex-direction:column; gap:18px; }
    .standing-fx { filter: drop-shadow(0 20px 36px rgba(30,79,184,.55)); }
    .standing {
      position:relative; overflow:hidden; padding:22px;
      background:linear-gradient(150deg,#2E6BE6,#173B92);
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
    }
    .standing-mascot { position:absolute; right:-10px; bottom:-16px; width:120px; height:140px; opacity:.9; }
    .standing-mascot img { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 8px 12px rgba(0,0,0,.3)); animation:floaty 4s ease-in-out infinite; }
    .standing-label { font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; letter-spacing:.18em; color:#bcd2ff; }
    .standing-rank-row { display:flex; align-items:flex-end; gap:10px; margin-top:8px; }
    .standing-rank { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:44px; color:#fff; line-height:.9; }
    .standing-trend { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; margin-bottom:8px; }
    .standing-trend.up { color:#C6E63B; } .standing-trend.down { color:#ff8f8f; } .standing-trend.neutral { color:#8fb0ee; }
    .standing-pts { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:20px; color:#fff; margin-top:6px; }
    .standing-pts small { font-size:12px; color:#bcd2ff; font-weight:700; }
    .standing-gap { margin-top:16px; max-width:62%; position:relative; }
    .standing-gap .lbl { font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; color:#dbe8ff; margin-bottom:6px; }
    .standing-gap .track { height:9px; border-radius:999px; background:rgba(0,0,0,.24); overflow:hidden; }
    .standing-gap .fill { height:100%; border-radius:999px; background:linear-gradient(90deg,#8CE00E,#C6E63B); box-shadow:0 0 12px rgba(198,230,59,.9); }

    .climbers-fx { filter: drop-shadow(0 14px 26px rgba(16,32,62,.16)); }
    .climbers {
      position:relative; background:#fff; box-shadow: inset 0 0 0 1px #E6ECF6; padding:18px 20px;
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
    }
    .climbers-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
    .climbers-head .t { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#10203E; letter-spacing:.02em; }
    .climbers-head .s { font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; color:#8592ad; }
    .climbers-list { display:flex; flex-direction:column; gap:12px; }
    .climber { display:flex; align-items:center; gap:11px; cursor:pointer; }
    .climber .cav { width:36px; height:36px; border-radius:50%; object-fit:cover; object-position:50% 18%; flex-shrink:0; }
    .climber .cav-initial { width:36px; height:36px; border-radius:50%; background:#2E6BE6; color:#fff; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
    .climber .cinfo { flex:1; min-width:0; }
    .climber .cname { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; color:#10203E; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .climber .crank { font-size:11px; color:#8592ad; font-weight:700; }
    .climber .cup { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#2f9e4f; background:#EAF7EE; border-radius:8px; padding:5px 10px; flex-shrink:0; }
    .climbers-empty { font-family:'Nunito'; font-size:13px; color:#8592ad; line-height:1.5; }

    /* responsive: stack, Your Standing first */
    @media (max-width: 960px) {
      .page { padding: 24px 18px 60px; }
      .lower-grid { grid-template-columns:1fr; }
      .rail { order:-1; }
      .rival-btn { right:78px; }
    }
    @media (max-width: 560px) {
      .champ-ring.gold { width:82px; height:82px; }
      .champ-ring.silver, .champ-ring.bronze { width:60px; height:60px; }
      .bar.b1 { height:90px; } .bar.b2 { height:66px; } .bar.b3 { height:50px; }
      .list-header, .list-row { grid-template-columns:44px 1fr 84px 52px; padding-left:14px; padding-right:14px; }
      .lb-header { font-size:24px; }
      .standing-gap { max-width:100%; }
    }
  `],
  template: `
    <div class="page">
      <div class="s4y-cbar-fx" style="margin-bottom:22px;">
        <div class="s4y-cbar">
          <div>
            <div class="s4y-cbar-eyebrow">GLOBAL RANKINGS</div>
            <div class="s4y-cbar-title">LEADER<span class="accent">BOARD</span></div>
          </div>
          <span style="color:#C6E63B; display:flex;"><app-icon name="trophy" [size]="30" /></span>
        </div>
      </div>

      <div class="filter-row">
        @for (opt of periodOptions; track opt.value) {
          <button class="pill" [class.active]="selectedPeriod === opt.value" (click)="selectPeriod(opt.value)">{{ opt.label }}</button>
        }
      </div>
      <div class="filter-row sport-row">
        @for (opt of sportOptions; track opt.value) {
          <button class="pill sport-pill" [class.active]="selectedSport === opt.value"
                  [style.--sport-color]="sportColor(opt.value)"
                  (click)="selectSport(opt.value)">
            @if (opt.value !== 'all') { <app-icon [name]="sportIcon(opt.value)" [size]="14" /> }
            {{ opt.label }}
          </button>
        }
      </div>

      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <ng-container *ngIf="!loading">
        <!-- ===== Champions podium ===== -->
        @if (entries.length >= 3) {
          <div class="podium-fx">
          <div class="podium">
            <div class="podium-glow"></div>
            <div class="podium-row">
              <!-- 2nd -->
              <div class="podium-slot" (click)="viewProfile(entries[1])">
                <div class="champ-ring silver">
                  @if (entries[1].activeAvatarImagePath) {
                    <img [src]="entries[1].activeAvatarImagePath" [alt]="entries[1].firstName" [style.border]="entries[1].activeBorderCss ?? null">
                  } @else { <span class="champ-initial" [style.border]="entries[1].activeBorderCss ?? null">{{ entries[1].firstName[0] }}</span> }
                  <div class="medal m2">2</div>
                </div>
                <div class="champ-name side">{{ entries[1].firstName }}</div>
                <div class="champ-pts side">{{ entries[1].totalPoints | number }}</div>
                <div class="bar b2"></div>
              </div>
              <!-- 1st -->
              <div class="podium-slot" (click)="viewProfile(entries[0])">
                <div class="crown">👑</div>
                <div class="champ-ring gold">
                  <div class="holo"></div>
                  @if (entries[0].activeAvatarImagePath) {
                    <img [src]="entries[0].activeAvatarImagePath" [alt]="entries[0].firstName" [style.border]="entries[0].activeBorderCss ?? null">
                  } @else { <span class="champ-initial" [style.border]="entries[0].activeBorderCss ?? null">{{ entries[0].firstName[0] }}</span> }
                  <div class="medal m1">1</div>
                </div>
                <div class="champ-title">★ CHAMPION</div>
                <div class="champ-name gold">{{ entries[0].firstName }}</div>
                <div class="champ-pts gold">{{ entries[0].totalPoints | number }}</div>
                <div class="bar b1"></div>
              </div>
              <!-- 3rd -->
              <div class="podium-slot" (click)="viewProfile(entries[2])">
                <div class="champ-ring bronze">
                  @if (entries[2].activeAvatarImagePath) {
                    <img [src]="entries[2].activeAvatarImagePath" [alt]="entries[2].firstName" [style.border]="entries[2].activeBorderCss ?? null">
                  } @else { <span class="champ-initial" [style.border]="entries[2].activeBorderCss ?? null">{{ entries[2].firstName[0] }}</span> }
                  <div class="medal m3">3</div>
                </div>
                <div class="champ-name side">{{ entries[2].firstName }}</div>
                <div class="champ-pts side">{{ entries[2].totalPoints | number }}</div>
                <div class="bar b3"></div>
              </div>
            </div>
          </div>
          </div>
        }

        <!-- ===== Lower grid ===== -->
        <div class="lower-grid">
          <!-- standings list -->
          <div class="list-fx">
          <div class="list-card">
            <div class="list-header">
              <span>RANK</span><span>ATHLETE</span><span>POINTS</span><span class="r">7-DAY</span>
            </div>
            @for (e of entries; track e.userId; let i = $index) {
              <div class="list-row"
                   [class.top3]="i < 3 && !isMe(e)"
                   [class.me]="isMe(e)"
                   (click)="viewProfile(e)">
                <div><span class="rank-chip" [class]="rankChipClass(i, e)">{{ e.rank }}</span></div>
                <div class="athlete">
                  @if (e.activeAvatarImagePath) {
                    <img class="av" [src]="e.activeAvatarImagePath" [alt]="e.firstName"
                         [style.border]="e.activeBorderCss ?? defaultBorder">
                  } @else {
                    <span class="av av-initial" [style.border]="e.activeBorderCss ?? defaultBorder">{{ e.firstName[0] }}</span>
                  }
                  <div class="athlete-meta">
                    <div class="name-row">
                      <span class="aname">{{ e.firstName }} {{ e.lastName }}</span>
                      @if (isMe(e)) { <span class="you-badge">YOU</span> }
                      @if (e.rank === 1) { <span class="glyph">👑</span> }
                      @if (e.prestigeLevel > 0) { <span class="prestige">★{{ e.prestigeLevel }}</span> }
                      @if (e.userId === myRivalUserId) { <span class="glyph" title="Your rival">⚔️</span> }
                    </div>
                    <div class="gap-track">
                      <div class="gap-fill" [class]="barClass(i, e)" [style.width.%]="gapPct(e)"></div>
                    </div>
                  </div>
                </div>
                <div class="pts-val" [class.me]="isMe(e)">{{ e.totalPoints | number }}</div>
                <div class="trend" [class]="trendClass(e.rankTrend)">{{ trendLabel(e.rankTrend) }}</div>
                @if (!isMe(e)) {
                  <button class="rival-btn" [class.active]="e.userId === myRivalUserId"
                          (click)="toggleRival(e, $event)">
                    {{ e.userId === myRivalUserId ? 'YOUR RIVAL' : 'RIVAL' }}
                  </button>
                }
              </div>
            }
          </div>
          </div>

          <!-- right rail -->
          <div class="rail">
            <!-- Your standing -->
            @if (me) {
              <div class="standing-fx">
              <div class="standing">
                <div class="standing-mascot"><img src="assets/sporty_wave.png" alt=""></div>
                <div class="standing-label">YOUR STANDING</div>
                <div class="standing-rank-row">
                  <div class="standing-rank">#{{ me.rank }}</div>
                  <div class="standing-trend" [class]="trendClass(me.rankTrend)">{{ trendLabel(me.rankTrend) }}</div>
                </div>
                <div class="standing-pts">{{ me.totalPoints | number }} <small>PTS</small></div>
                <div class="standing-gap">
                  <div class="lbl">{{ gapText }}</div>
                  <div class="track"><div class="fill" [style.width.%]="toFirstPct"></div></div>
                </div>
              </div>
              </div>
            }

            <!-- Top climbers -->
            <div class="climbers-fx">
            <div class="climbers">
              <div class="climbers-head">
                <span class="t">📈 TOP CLIMBERS</span><span class="s">7 DAYS</span>
              </div>
              @if (climbers.length) {
                <div class="climbers-list">
                  @for (c of climbers; track c.userId) {
                    <div class="climber" (click)="viewProfile(c)">
                      @if (c.activeAvatarImagePath) {
                        <img class="cav" [src]="c.activeAvatarImagePath" [alt]="c.firstName"
                             [style.border]="c.activeBorderCss ?? defaultBorder">
                      } @else {
                        <span class="cav cav-initial" [style.border]="c.activeBorderCss ?? defaultBorder">{{ c.firstName[0] }}</span>
                      }
                      <div class="cinfo">
                        <div class="cname">{{ c.firstName }} {{ c.lastName }}</div>
                        <div class="crank">now #{{ c.rank }}</div>
                      </div>
                      <div class="cup">▲ {{ c.rankTrend }}</div>
                    </div>
                  }
                </div>
              } @else {
                <div class="climbers-empty">No climbers in the last 7 days yet — log activities to move up.</div>
              }
            </div>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class LeaderboardComponent implements OnInit {
  entries: LeaderboardEntry[] = [];
  loading = true;
  readonly defaultBorder = DEFAULT_BORDER;
  private myId = localStorage.getItem('userId') ?? '';
  myRivalUserId: string | null = null;

  selectedPeriod: 'all' | '7d' | '30d' = 'all';
  selectedSport = 'all';

  readonly periodOptions: { value: 'all' | '7d' | '30d'; label: string }[] = [
    { value: '7d', label: 'THIS WEEK' },
    { value: '30d', label: 'THIS MONTH' },
    { value: 'all', label: 'ALL-TIME' },
  ];

  readonly sportOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'ALL SPORTS' },
    { value: 'running', label: 'RUNNING' },
    { value: 'walking', label: 'WALKING' },
    { value: 'cycling', label: 'CYCLING' },
    { value: 'swimming', label: 'SWIMMING' },
    { value: 'gym', label: 'GYM' },
    { value: 'daily_steps', label: 'STEPS' },
  ];

  constructor(private api: ApiService, private router: Router, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.loadLeaderboard();
    if (this.myId) {
      this.api.getRival(this.myId).subscribe({
        next: r => { this.myRivalUserId = r.rivalUserId; },
        error: () => {},
      });
    }
  }

  loadLeaderboard(): void {
    this.loading = true;
    this.api.getLeaderboard(this.selectedPeriod, this.selectedSport).subscribe({
      next: data => { this.entries = data; this.loading = false; },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load leaderboard. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }

  selectPeriod(period: 'all' | '7d' | '30d'): void {
    if (this.selectedPeriod === period) return;
    this.selectedPeriod = period;
    this.loadLeaderboard();
  }

  selectSport(sport: string): void {
    if (this.selectedSport === sport) return;
    this.selectedSport = sport;
    this.loadLeaderboard();
  }

  sportIcon(sport: string): string {
    return SPORT_ICON_NAMES[sport] ?? 'trophy';
  }

  sportColor(sport: string): string {
    return SPORT_COLORS[sport] ?? '#2E6BE6';
  }

  isMe(e: LeaderboardEntry) { return e.userId === this.myId; }

  get me(): LeaderboardEntry | undefined {
    return this.entries.find(e => e.userId === this.myId);
  }

  private get leaderPoints(): number {
    return this.entries[0]?.totalPoints || 1;
  }

  /** Top 3 athletes gaining rank over the last 7 days (positive trend only). */
  get climbers(): LeaderboardEntry[] {
    return this.entries
      .filter(e => e.rankTrend > 0)
      .sort((a, b) => b.rankTrend - a.rankTrend)
      .slice(0, 3);
  }

  get toFirstPct(): number {
    const m = this.me;
    if (!m) return 0;
    return Math.round((m.totalPoints / this.leaderPoints) * 100);
  }

  get gapText(): string {
    const m = this.me;
    if (!m) return '';
    if (m.rank === 1) return 'You hold #1 🏆';
    const gap = this.leaderPoints - m.totalPoints;
    return `${gap.toLocaleString('en-US')} pts to #1`;
  }

  /** Row bar width as a % of the leader's points (floored at 6% for visibility). */
  gapPct(e: LeaderboardEntry): number {
    return Math.max(6, Math.round((e.totalPoints / this.leaderPoints) * 100));
  }

  barClass(i: number, e: LeaderboardEntry): string {
    if (this.isMe(e)) return 'me';
    if (i < 3) return 'top3';
    return 'default';
  }

  rankChipClass(i: number, e: LeaderboardEntry): string {
    if (this.isMe(e)) return 'me';
    if (i === 0) return 'gold';
    if (i === 1) return 'silver';
    if (i === 2) return 'bronze';
    return 'default';
  }

  trendClass(trend: number): string {
    if (trend > 0) return 'up';
    if (trend < 0) return 'down';
    return 'neutral';
  }

  trendLabel(trend: number): string {
    if (trend > 0) return `↑ ${trend}`;
    if (trend < 0) return `↓ ${Math.abs(trend)}`;
    return '—';
  }

  viewProfile(entry: LeaderboardEntry) {
    this.router.navigate(['/profile', entry.userId]);
  }

  toggleRival(e: LeaderboardEntry, event: Event): void {
    event.stopPropagation();
    if (!this.myId) return;

    if (e.userId === this.myRivalUserId) {
      this.api.clearRival(this.myId).subscribe({
        next: () => {
          this.myRivalUserId = null;
          this.snackBar.open('Rival cleared.', '', { duration: 2500 });
        },
      });
    } else {
      this.api.setRival(this.myId, e.userId).subscribe({
        next: () => {
          this.myRivalUserId = e.userId;
          this.snackBar.open(`${e.firstName} is now your rival!`, '', { duration: 2500 });
        },
        error: () => {
          this.snackBar.open('Failed to set rival. Please try again.', 'OK', { duration: 4000 });
        },
      });
    }
  }
}
