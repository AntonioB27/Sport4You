import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../shared/services/api.service';
import { ActivityLoggedService } from '../shared/services/activity-logged.service';
import { UserStateService } from '../shared/services/user-state.service';
import { DashboardData, ActivityItem, DailyMissionItem } from '../shared/models/dashboard.model';
import { SPORT_COLORS, SPORT_ICON_NAMES } from '../shared/constants/sport.constants';
import { IconComponent } from '../shared/components/icon/icon.component';
import { LogActivityDialogComponent } from '../shared/components/log-activity-dialog/log-activity-dialog.component';
import { RegisterDialogComponent } from '../shared/components/register-dialog/register-dialog.component';
import { LootBoxModalComponent } from '../loot-box/loot-box-modal.component';
import { AiCoachDialogComponent } from './ai-coach/ai-coach-dialog.component';
import { TodayStepsCardComponent } from './today-steps-card/today-steps-card.component';
import { RivalCardComponent } from './rival-card/rival-card.component';
import { WeightCardComponent } from './weight-card/weight-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, RouterLink, LootBoxModalComponent, IconComponent, TodayStepsCardComponent, RivalCardComponent, WeightCardComponent],
  styles: [`
    /* ═══════════ Animations ═══════════ */
    @keyframes floaty { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-10px) rotate(2deg); } }
    @keyframes holoSweep { 0% { background-position: -160% 0; } 100% { background-position: 260% 0; } }
    @keyframes vaultBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @keyframes hudPulse {
      0% { box-shadow: 0 0 0 0 rgba(255,59,87,.55); }
      70% { box-shadow: 0 0 0 8px rgba(255,59,87,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,59,87,0); }
    }

    /* level-up celebration: pulse the outer drop-shadow (box-shadow is clipped away by clip-path) */
    @keyframes heroGlowFx {
      0%, 100% { filter: drop-shadow(0 22px 34px rgba(30,79,184,.4)); }
      50%      { filter: drop-shadow(0 22px 34px rgba(30,79,184,.4)) drop-shadow(0 0 30px rgba(198,230,59,.8)); }
    }
    .hero-fx--glow { animation: heroGlowFx 1s ease-in-out 2; }

    @keyframes lvPop {
      0%   { transform: translateX(-50%) scale(1); }
      30%  { transform: translateX(-50%) scale(1.45); }
      65%  { transform: translateX(-50%) scale(1.08); }
      100% { transform: translateX(-50%) scale(1); }
    }
    .hero-lv--pop { animation: lvPop 600ms ease-out forwards; }

    .level-ring {
      position: absolute; inset: -6px; border-radius: 50%;
      border: 3px solid #C6E63B; opacity: 0; pointer-events: none;
    }
    @keyframes ringExpand {
      0%   { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.9);  opacity: 0; }
    }
    .level-ring--active { animation: ringExpand 700ms ease-out forwards; }

    @keyframes xpFlash { 0% { opacity: 0; } 30% { opacity: .6; } 100% { opacity: 0; } }
    .xp-flash--active { animation: xpFlash 400ms ease-out forwards; }

    /* ═══════════ Shell ═══════════ */
    .page { padding: 24px 30px 60px; font-family: 'Nunito', system-ui, sans-serif; max-width: 1200px; margin: 0 auto; }
    .spinner-wrap { display: flex; justify-content: center; padding: 80px; }
    .not-found { padding: 40px; font-family: 'Chakra Petch', sans-serif; color: #8592ad; }

    /* Beveled card primitives — clip-path arcade corners.
       Outer .fx wrapper carries the drop-shadow (clip-path eats box-shadow),
       inner uses an inset shadow for the hairline border. */
    .fx  { filter: drop-shadow(0 14px 26px rgba(16,32,62,.16)); }
    .bevel {
      position: relative; background: #fff; box-shadow: inset 0 0 0 1px #E6ECF6;
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
      padding: 20px 22px;
    }
    .bevel--sm {
      clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
      padding: 16px 18px;
    }

    /* ═══════════ Command bar (dark HUD) ═══════════ */
    .cbar-fx { filter: drop-shadow(0 16px 26px rgba(15,30,59,.28)); margin-bottom: 20px; }
    .cbar {
      position: relative; display: flex; align-items: center; justify-content: space-between;
      gap: 18px; flex-wrap: wrap; padding: 16px 24px;
      background: radial-gradient(120% 160% at 100% 0%, rgba(46,107,230,.5), transparent), #0f1e3b;
      clip-path: polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px);
    }
    .cbar-id { display: flex; align-items: center; gap: 14px; }
    .cbar-av { position: relative; width: 48px; height: 48px; flex-shrink: 0; }
    .cbar-ring { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(#C6E63B calc(var(--p,0) * 1%), rgba(255,255,255,.12) 0); }
    .cbar-av-in { position: absolute; inset: 3px; border-radius: 50%; overflow: hidden; background: #0c1a34; display: flex; align-items: center; justify-content: center; }
    .cbar-av-in img { width: 150%; height: 150%; object-fit: cover; object-position: 50% 18%; }
    .cbar-av-in .initial { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; color: #C6E63B; }
    .cbar-status { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .2em; color: #7fa8ff; }
    .cbar-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 20px; color: #fff; letter-spacing: .04em; line-height: 1.1; }
    .cbar-name .lv { color: #C6E63B; }
    .cbar-name .prestige { color: #C6E63B; text-shadow: 0 0 8px rgba(198,230,59,.7); }

    .chips { display: flex; align-items: stretch; gap: 10px; flex-wrap: wrap; }
    .chip {
      position: relative; display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,.06); border: 1px solid rgba(122,150,210,.22); padding: 8px 14px;
      clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
    }
    .chip--boxes { background: rgba(198,230,59,.1); border-color: rgba(198,230,59,.4); }
    .chip--boxes.clickable { cursor: pointer; transition: transform .1s; }
    .chip--boxes.clickable:hover { transform: translateY(-1px); }
    .chip-ic { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
    .chip-ic.streak { background: linear-gradient(150deg,#FF9A3D,#FF6A00); }
    .chip-ic.points { background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #26340a; }
    .chip-ic.coins  { background: linear-gradient(150deg,#FFD54A,#F5B300); color: #4a3400; }
    .chip-ic.boxes  { background: linear-gradient(150deg,#4B8DF0,#2E6BE6); }
    .chip-ic.boxes.empty { background: rgba(255,255,255,.1); color: #7fa8ff; }
    .chip-meta { display: flex; flex-direction: column; line-height: 1; }
    .chip-val { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; color: #fff; }
    .chip-lab { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 9px; letter-spacing: .14em; color: #9db3dd; margin-top: 4px; }
    .chip--boxes .chip-lab { color: #C6E63B; }
    .chip-dot { position: absolute; top: -3px; right: -3px; width: 9px; height: 9px; border-radius: 50%; background: #FF3B57; animation: hudPulse 1.6s ease-out infinite; }
    .chip-boost { position: absolute; top: -7px; right: -5px; background: #2E6BE6; color: #fff; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 9px; padding: 1px 6px; border-radius: 999px; }

    /* ═══════════ Grid ═══════════ */
    .grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; }
    .col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }

    /* ═══════════ Hero — Pilot Deck ═══════════ */
    .hero-fx { filter: drop-shadow(0 22px 34px rgba(30,79,184,.4)); }
    .hero {
      position: relative; overflow: hidden; padding: 26px 28px;
      background: linear-gradient(135deg,#2E6BE6,#173B92);
      clip-path: polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px);
    }
    .hero-sweep { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(115deg, transparent 32%, rgba(255,255,255,.2) 46%, transparent 60%); background-size: 220% 100%; animation: holoSweep 5s linear infinite; }
    .hero-row { position: relative; display: flex; align-items: center; gap: 26px; }
    .hero-av { position: relative; width: 148px; height: 148px; flex-shrink: 0; }
    .hero-av-ring { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from -90deg, #8CE00E 0%, #C6E63B calc(var(--p,0) * 1%), rgba(255,255,255,.14) 0); box-shadow: 0 0 26px rgba(198,230,59,.5); }
    .hero-av-in { position: absolute; inset: 9px; border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 50% 40%, rgba(198,230,59,.28), transparent 65%), #14337a; display: flex; align-items: flex-end; justify-content: center; }
    .hero-av-in img { width: 118%; height: 118%; object-fit: contain; animation: floaty 4.5s ease-in-out infinite; }
    .hero-lv { position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .06em; padding: 3px 12px; border-radius: 999px; box-shadow: 0 0 16px rgba(198,230,59,.7); white-space: nowrap; }
    .hero-body { flex: 1; min-width: 0; }
    .hero-class { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,.14); border: 1px solid rgba(198,230,59,.5); color: #C6E63B; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: .18em; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }
    .hero-points { font-family: 'Chakra Petch', sans-serif; font-size: 52px; font-weight: 700; color: #fff; line-height: 1; text-shadow: 0 0 22px rgba(46,107,230,.5); }
    .hero-pts-lab { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .2em; color: #bcd2ff; margin: 6px 0 18px; }
    .hero-xp-meta { display: flex; justify-content: space-between; font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700; color: #dbe8ff; margin-bottom: 6px; }
    .hero-xp-meta .cur { color: #C6E63B; } .hero-xp-meta .nxt { color: #8fb0ee; }
    .hero-xp-bar { position: relative; height: 16px; background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.18); overflow: hidden; }
    .hero-xp-fill { height: 100%; background: linear-gradient(90deg,#8CE00E,#C6E63B); box-shadow: 0 0 16px rgba(198,230,59,.9); }
    .hero-xp-fill--boot { transition: width 1.3s cubic-bezier(0.15, 0.9, 0.3, 1); }
    .hero-xp-fill--gain { transition: width 0.7s ease-in-out; }
    .hero-xp-ticks { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(90deg, transparent 0 24px, rgba(23,59,146,.9) 24px 28px); }
    .hero-xp-flash { position: absolute; inset: 0; background: rgba(255,255,255,.7); opacity: 0; pointer-events: none; }
    .prestige-btn { display: inline-block; margin-top: 12px; border: 1px solid rgba(198,230,59,.5); cursor: pointer; background: rgba(198,230,59,.14); color: #C6E63B; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 11px; letter-spacing: .08em; padding: 6px 16px; border-radius: 999px; }
    .prestige-btn:hover { background: rgba(198,230,59,.24); }

    /* ═══════════ Section header accent ═══════════ */
    .sec-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .sec-title { display: flex; align-items: center; gap: 10px; }
    .sec-bar { width: 3px; height: 16px; flex-shrink: 0; }
    .sec-bar.lime   { background: #9ECF10; box-shadow: 0 0 8px rgba(158,207,16,.7); }
    .sec-bar.gold   { background: #F5B300; box-shadow: 0 0 8px rgba(245,179,0,.6); }
    .sec-bar.orange { background: #FF6A00; box-shadow: 0 0 8px rgba(255,106,0,.6); }
    .sec-bar.blue   { background: #2E6BE6; box-shadow: 0 0 8px rgba(46,107,230,.6); }
    .sec-name { font-family: 'Chakra Petch', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: .16em; color: #10203E; }
    .sec-sub { font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700; color: #8592ad; }
    .sec-link { font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700; color: #2E6BE6; letter-spacing: .05em; text-decoration: none; cursor: pointer; }

    /* ═══════════ AI Coach entry ═══════════ */
    .ai-coach-card {
      position: relative; display: flex; align-items: center; gap: 14px; width: 100%; cursor: pointer; text-align: left;
      border: none; padding: 16px 20px; background: radial-gradient(120% 90% at 90% 0%, rgba(46,107,230,.14), transparent), #fff;
      box-shadow: inset 0 0 0 1px rgba(46,107,230,.28);
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
      transition: transform .1s, box-shadow .1s;
    }
    .ai-coach-card:hover { transform: translateY(-1px); }
    .ai-coach-icon { font-size: 26px; }
    .ai-coach-text { display: flex; flex-direction: column; }
    .ai-coach-title { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .06em; color: #10203E; }
    .ai-coach-sub { font-family: 'Nunito', sans-serif; font-size: 12.5px; font-weight: 600; color: #5c6881; }
    .ai-coach-mode { margin-left: auto; font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .06em; color: #B78A00; }

    /* ═══════════ Core stats ═══════════ */
    .stats3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
    .stat-lab { font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .16em; color: #8592ad; }
    .stat-val { font-family: 'Chakra Petch', sans-serif; font-size: 28px; font-weight: 700; color: #10203E; margin-top: 4px; }
    .stat-val.blue { color: #2E6BE6; }

    /* ═══════════ Missions ═══════════ */
    .missions { display: flex; flex-direction: column; gap: 11px; }
    .mission { display: flex; align-items: center; gap: 13px; padding: 11px 13px; background: #F7FAFF; border: 1px solid #E6ECF6; border-radius: 4px; }
    .mission.easy   { border-left: 3px solid #9ECF10; }
    .mission.medium { border-left: 3px solid #2E6BE6; }
    .mission.hard   { border-left: 3px solid #FF6A00; }
    .mission.done   { background: #F4FBE3; border: 1px solid rgba(158,207,16,.5); border-left: 3px solid #C6E63B; }
    .mission-check { width: 24px; height: 24px; border-radius: 6px; background: linear-gradient(150deg,#C6E63B,#9ECF10); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #1c2a06; font-weight: 800; }
    .mission-body { flex: 1; min-width: 0; }
    .mission-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; color: #10203E; }
    .mission-name.done { color: #4a6100; }
    .mission-cleared { font-family: 'Chakra Petch', sans-serif; font-size: 10px; letter-spacing: .14em; font-weight: 700; color: #7c9c00; margin-top: 2px; }
    .mission-bar { height: 6px; border-radius: 999px; background: #EAEEF6; margin-top: 7px; overflow: hidden; }
    .mission-fill { height: 100%; }
    .mission-fill.easy   { background: linear-gradient(90deg,#8CE00E,#C6E63B); box-shadow: 0 0 8px rgba(198,230,59,.8); }
    .mission-fill.medium { background: linear-gradient(90deg,#4B8DF0,#2E6BE6); box-shadow: 0 0 8px rgba(46,107,230,.6); }
    .mission-fill.hard   { background: linear-gradient(90deg,#FF9A3D,#FF6A00); box-shadow: 0 0 8px rgba(255,106,0,.6); }
    .mission-xp { font-family: 'Chakra Petch', sans-serif; font-size: 13px; font-weight: 700; color: #5f7a00; flex-shrink: 0; }

    /* ═══════════ Step core + Signal vault row ═══════════ */
    .sv-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

    .vault-fx { filter: drop-shadow(0 16px 28px rgba(30,79,184,.32)); }
    .vault {
      position: relative; overflow: hidden; padding: 20px 22px; height: 100%;
      background: linear-gradient(160deg,#2E6BE6,#173B92);
      clip-path: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
    }
    .vault-glow { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 90% at 82% -10%, rgba(198,230,59,.32), transparent 60%); }
    .vault-in { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; }
    .vault-ic { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.16); color: #fff; animation: vaultBob 3.6s ease-in-out infinite; }
    .vault-txt { font-family: 'Nunito', sans-serif; font-size: 12.5px; font-weight: 700; color: #dbe8ff; line-height: 1.4; }
    .vault-btn { width: 100%; background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E; border: none; padding: 11px; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .06em; cursor: pointer; box-shadow: 0 4px 0 #7c9c00; clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px); transition: transform .1s, box-shadow .1s; }
    .vault-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 0 #7c9c00; }
    .vault-btn:active { transform: translateY(1px); box-shadow: 0 2px 0 #7c9c00; }
    /* empty state — muted white bevel */
    .vault-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; }
    .vault-empty-ic { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: #EEF2F8; color: #9aa6bd; }
    .vault-empty-txt { font-family: 'Nunito', sans-serif; font-size: 12.5px; font-weight: 700; color: #8592ad; line-height: 1.4; }

    /* ═══════════ Rankings ═══════════ */
    .rank-list { display: flex; flex-direction: column; gap: 8px; }
    .rank-row { display: flex; align-items: center; gap: 10px; padding: 6px 4px; }
    .rank-row.me { padding: 8px 10px; background: #F4FBE3; border: 1px solid rgba(158,207,16,.6); border-radius: 6px; }
    .rank-num { font-family: 'Chakra Petch', sans-serif; font-weight: 700; width: 18px; color: #8592ad; }
    .rank-num.gold { color: #c9a13a; } .rank-num.me { color: #5f7a00; }
    .rank-av, .rank-initial { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; object-fit: cover; object-position: 50% 22%; }
    .rank-initial { background: #2E6BE6; color: #fff; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; }
    .rank-name { flex: 1; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #10203E; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rank-pts { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #8592ad; flex-shrink: 0; }
    .rank-pts.me { color: #5f7a00; }

    /* ═══════════ Combat log (recent activity) ═══════════ */
    .clog-list { display: flex; flex-direction: column; gap: 11px; max-height: 240px; overflow-y: auto; }
    .clog-item { display: flex; align-items: center; gap: 11px; }
    .clog-ic { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .clog-body { flex: 1; min-width: 0; }
    .clog-sport { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #10203E; }
    .clog-meta { font-family: 'Chakra Petch', sans-serif; font-size: 11px; color: #8592ad; font-weight: 700; margin-top: 2px; }
    .clog-pts { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #2E6BE6; flex-shrink: 0; }

    /* ═══════════ Trophies (achievements) ═══════════ */
    .tro-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #F0F4FB; }
    .tro-row:last-child { border-bottom: none; }
    .tro-strip { width: 4px; height: 34px; border-radius: 2px; flex-shrink: 0; }
    .tro-info { flex: 1; min-width: 0; }
    .tro-name { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; color: #10203E; }
    .tro-name .rarity { font-size: 9px; letter-spacing: .1em; }
    .tro-desc { font-size: 11px; color: #8592ad; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tro-date { font-size: 11px; color: #b0bcd4; flex-shrink: 0; }

    .empty { color: #b0bcd4; padding: 12px 0; font-family: 'Chakra Petch', sans-serif; font-size: 13px; text-align: center; font-style: italic; }

    /* ═══════════ Log activity CTA ═══════════ */
    .log-cta { background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: .06em; padding: 16px; box-shadow: 0 5px 0 #7c9c00; cursor: pointer; border: none; width: 100%; clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px); transition: transform .1s, box-shadow .1s; }
    .log-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 0 #7c9c00; }
    .log-cta:active { transform: translateY(1px); box-shadow: 0 3px 0 #7c9c00; }

    /* ═══════════ Responsive ═══════════ */
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    @media (max-width: 520px) { .sv-row { grid-template-columns: 1fr; } }
    @media (max-width: 640px) {
      .page { padding: 18px 16px 60px; }
      .cbar { padding: 14px 16px; }
      .chips { width: 100%; }
      .chip { flex: 1 1 calc(50% - 5px); }
      .hero-row { flex-direction: column; text-align: center; }
      .hero-av { width: 120px; height: 120px; }
      .hero-points { font-size: 42px; }
      .hero-class { margin-top: 6px; }
    }
  `],
  template: `
    <div class="page">
      <div class="spinner-wrap" *ngIf="loading && !data">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <ng-container *ngIf="data">
        <!-- ══ Command bar ══ -->
        <div class="cbar-fx">
          <div class="cbar">
            <div class="cbar-id">
              <div class="cbar-av">
                <div class="cbar-ring" [style.--p]="xpPercent"></div>
                <div class="cbar-av-in">
                  @if (data.activeAvatar?.imagePath) {
                    <img [src]="data.activeAvatar!.imagePath" [alt]="data.activeAvatar?.name ?? ''">
                  } @else {
                    <span class="initial">{{ data.user.firstName[0] }}</span>
                  }
                </div>
              </div>
              <div>
                <div class="cbar-status">PLAYER ONLINE</div>
                <div class="cbar-name">
                  @if (prestigeLevel > 0) { <span class="prestige">★{{ prestigeLevel }}</span> }
                  {{ data.user.firstName }} <span class="lv">// LVL {{ level }} {{ levelTitle }}</span>
                </div>
              </div>
            </div>
            <div class="chips">
              <div class="chip">
                <div class="chip-ic streak"><app-icon name="flame" [size]="16" /></div>
                <div class="chip-meta"><span class="chip-val">{{ data.currentStreak ?? 0 }}</span><span class="chip-lab">STREAK</span></div>
              </div>
              <div class="chip">
                <div class="chip-ic points"><app-icon name="star" [size]="16" /></div>
                <div class="chip-meta"><span class="chip-val">{{ data.totalPoints | number }}</span><span class="chip-lab">POINTS</span></div>
              </div>
              <div class="chip">
                <div class="chip-ic coins"><app-icon name="coin" [size]="16" /></div>
                <div class="chip-meta"><span class="chip-val">{{ data.coins | number }}</span><span class="chip-lab">COINS</span></div>
                @if (data.boostedActivitiesRemaining > 0) {
                  <span class="chip-boost">⚡{{ data.boostedActivitiesRemaining }}</span>
                }
              </div>
              <div class="chip chip--boxes" [class.clickable]="pendingBoxes > 0"
                   (click)="pendingBoxes > 0 && openBoxModal()">
                @if (pendingBoxes > 0) { <span class="chip-dot"></span> }
                <div class="chip-ic boxes" [class.empty]="pendingBoxes === 0"><app-icon name="package" [size]="16" /></div>
                <div class="chip-meta"><span class="chip-val">{{ pendingBoxes }}</span><span class="chip-lab">BOXES</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══ Main grid ══ -->
        <div class="grid">
          <!-- ═══ LEFT ═══ -->
          <div class="col">

            <!-- Hero — Pilot Deck -->
            <div class="hero-fx" [class.hero-fx--glow]="levelUpActive">
              <div class="hero">
                <div class="hero-sweep"></div>
                <div class="hero-row">
                  <div class="hero-av">
                    <div class="level-ring" [class.level-ring--active]="levelUpActive"></div>
                    <div class="hero-av-ring" [style.--p]="xpPercent"></div>
                    <div class="hero-av-in">
                      <img [src]="data.activeAvatar?.imagePath ?? 'assets/sporty_wave.png'"
                           [alt]="data.activeAvatar?.name ?? 'Sporty'" />
                    </div>
                    <div class="hero-lv" [class.hero-lv--pop]="levelUpActive">LV {{ displayedLevel }}</div>
                  </div>
                  <div class="hero-body">
                    <div class="hero-class">
                      @if (prestigeLevel > 0) { <span>★{{ prestigeLevel }}</span> }
                      <app-icon name="star" [size]="12" /> {{ levelTitle }} CLASS
                    </div>
                    <div class="hero-points">{{ data.totalPoints | number }}</div>
                    <div class="hero-pts-lab">TOTAL POINTS</div>
                    <div class="hero-xp-meta">
                      <span class="cur">{{ xpInLevel }} XP</span>
                      <span class="nxt">{{ xpForNextLevel }} → LV {{ level + 1 }}</span>
                    </div>
                    <div class="hero-xp-bar">
                      <div class="hero-xp-fill"
                           [class.hero-xp-fill--boot]="isBootUp"
                           [class.hero-xp-fill--gain]="!isBootUp"
                           [style.width.%]="displayedXpPercent"></div>
                      <div class="hero-xp-ticks"></div>
                      <div class="hero-xp-flash"
                           [class.xp-flash--active]="xpFlashActive"
                           (animationend)="xpFlashActive = false"></div>
                    </div>
                    @if (isMaxLevel) {
                      <button class="prestige-btn" (click)="promptPrestige()">PRESTIGE</button>
                    }
                  </div>
                </div>
              </div>
            </div>

            <!-- AI Coach -->
            <div class="fx">
              <button class="ai-coach-card" (click)="openAiCoach()">
                <span class="ai-coach-icon">✨</span>
                <span class="ai-coach-text">
                  <span class="ai-coach-title">AI COACH</span>
                  <span class="ai-coach-sub">Log an activity in plain English</span>
                </span>
                <span class="ai-coach-mode" *ngIf="aiMode === 'basic'">⚡ BASIC</span>
              </button>
            </div>

            <!-- Core stats -->
            <div class="stats3">
              <div class="fx"><div class="bevel bevel--sm">
                <div class="stat-lab">GLOBAL RANK</div>
                <div class="stat-val blue">{{ (data?.rank ?? 0) > 0 ? '#' + data!.rank : '—' }}</div>
              </div></div>
              <div class="fx"><div class="bevel bevel--sm">
                <div class="stat-lab">THIS WEEK</div>
                <div class="stat-val">{{ weeklyPoints | number }}</div>
              </div></div>
              <div class="fx"><div class="bevel bevel--sm">
                <div class="stat-lab">ACTIVITIES</div>
                <div class="stat-val">{{ data.activities.length }}</div>
              </div></div>
            </div>

            <!-- Daily missions -->
            <div class="fx"><div class="bevel">
              <div class="sec-head">
                <div class="sec-title"><span class="sec-bar lime"></span><span class="sec-name">DAILY MISSIONS</span></div>
                <span class="sec-sub">{{ missionsDone }} / {{ data?.dailyMissions?.length ?? 0 }} CLEARED</span>
              </div>
              <div class="missions">
                <div class="mission" *ngFor="let m of data?.dailyMissions"
                     [class.easy]="m.tier === 'easy'" [class.medium]="m.tier === 'medium'"
                     [class.hard]="m.tier === 'hard'" [class.done]="m.completed">
                  @if (m.completed) {
                    <div class="mission-check">
                      <svg width="14" height="14" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#1c2a06" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>
                  }
                  <div class="mission-body">
                    <div class="mission-name" [class.done]="m.completed">{{ m.description }}</div>
                    @if (m.completed) {
                      <div class="mission-cleared">MISSION CLEARED</div>
                    } @else {
                      <div class="mission-bar">
                        <div class="mission-fill"
                             [class.easy]="m.tier === 'easy'" [class.medium]="m.tier === 'medium'" [class.hard]="m.tier === 'hard'"
                             [style.width.%]="progressPercent(m)"></div>
                      </div>
                    }
                  </div>
                  <div class="mission-xp">+{{ m.xpReward }} XP</div>
                </div>
              </div>
            </div></div>

            <!-- Step core + Signal vault -->
            <div class="sv-row">
              <app-today-steps-card
                [todaySteps]="data?.todaySteps ?? 0"
                (stepsAdded)="loadData()"></app-today-steps-card>

              @if (pendingBoxes > 0) {
                <div class="vault-fx"><div class="vault">
                  <div class="vault-glow"></div>
                  <div class="vault-in">
                    <div class="sec-title" style="align-self:flex-start;"><span class="sec-bar lime"></span><span class="sec-name" style="color:#fff;">SIGNAL VAULT</span></div>
                    <div class="vault-ic"><app-icon name="package" [size]="30" /></div>
                    <div class="vault-txt">{{ pendingBoxes }} {{ pendingBoxes === 1 ? 'loot box' : 'loot boxes' }} ready</div>
                    <button class="vault-btn" (click)="openBoxModal()">OPEN VAULT</button>
                  </div>
                </div></div>
              } @else {
                <div class="fx"><div class="bevel" style="height:100%;">
                  <div class="vault-empty">
                    <div class="sec-title" style="align-self:flex-start;"><span class="sec-bar blue"></span><span class="sec-name">SIGNAL VAULT</span></div>
                    <div class="vault-empty-ic"><app-icon name="package" [size]="30" /></div>
                    <div class="vault-empty-txt">No boxes yet — earn them by leveling up and clearing missions.</div>
                  </div>
                </div></div>
              }
            </div>
          </div>

          <!-- ═══ RIGHT ═══ -->
          <div class="col">

            <!-- Rankings -->
            <div class="fx"><div class="bevel">
              <div class="sec-head">
                <div class="sec-title"><span class="sec-bar gold"></span><span class="sec-name">RANKINGS</span></div>
                <span class="sec-sub" style="color:#2E6BE6;">ALL TIME</span>
              </div>
              <div class="rank-list">
                <div *ngFor="let e of topEntries; let i = index" class="rank-row" [class.me]="e.isMe">
                  <span class="rank-num" [class.gold]="i === 0 && !e.isMe" [class.me]="e.isMe">{{ e.rank }}</span>
                  @if (e.activeAvatarImagePath) {
                    <img class="rank-av" [style.border]="e.activeBorderCss ?? '2px solid #E3EAF5'" [src]="e.activeAvatarImagePath" [alt]="e.firstName">
                  } @else {
                    <span class="rank-initial" [style.border]="e.activeBorderCss ?? '2px solid #E3EAF5'">{{ e.firstName[0] }}</span>
                  }
                  <span class="rank-name">{{ e.firstName }} {{ e.lastName }}{{ e.isMe ? ' (You)' : '' }}</span>
                  <span class="rank-pts" [class.me]="e.isMe">{{ e.totalPoints | number }}</span>
                </div>
              </div>
            </div></div>

            <!-- Duel (rival) -->
            <app-rival-card
              [rivalStatus]="data.rivalStatus"
              [myFirstName]="data.user.firstName"
              [myAvatarImagePath]="data.activeAvatar?.imagePath ?? null"
              [myBorderCss]="data.activeBorderCss"></app-rival-card>

            <!-- Vitals (weight) -->
            <app-weight-card [userId]="currentUserId"></app-weight-card>

            <!-- Combat log (recent activity) -->
            <div class="fx"><div class="bevel">
              <div class="sec-head">
                <div class="sec-title"><span class="sec-bar lime"></span><span class="sec-name">COMBAT LOG</span></div>
              </div>
              <div class="clog-list">
                <div class="clog-item" *ngFor="let a of data.activities.slice(0, 6)">
                  <div class="clog-ic" [style.background]="sportBg(a.sport)"><app-icon [name]="sportIconName(a.sport)" [size]="18" /></div>
                  <div class="clog-body">
                    <div class="clog-sport">{{ formatSport(a.sport) }} · {{ formatMetric(a) }}</div>
                    <div class="clog-meta">{{ formatDate(a.dateTime) }}</div>
                  </div>
                  <div class="clog-pts">+{{ a.points }}</div>
                </div>
                <div class="empty" *ngIf="data.activities.length === 0">No activities yet — start logging!</div>
              </div>
            </div></div>

            <!-- Trophies (achievements) -->
            <div class="fx"><div class="bevel">
              <div class="sec-head">
                <div class="sec-title"><span class="sec-bar gold"></span><span class="sec-name">TROPHIES</span></div>
                <a class="sec-link" routerLink="/achievements">SEE ALL →</a>
              </div>
              @if ((data?.recentAchievements?.length ?? 0) === 0) {
                <div class="empty">No achievements yet — keep going!</div>
              } @else {
                @for (a of data!.recentAchievements; track a.id) {
                  <div class="tro-row">
                    <div class="tro-strip" [style.background]="tierStrip(a.tier)"></div>
                    <div class="tro-info">
                      <div class="tro-name">{{ a.name }} <span class="rarity" [style.color]="tierLabelColor(a.tier)">· {{ a.tier | uppercase }}</span></div>
                      <div class="tro-desc">{{ a.description }}</div>
                    </div>
                    <div class="tro-date">{{ a.unlockedAt | date:'MMM d' }}</div>
                  </div>
                }
              }
            </div></div>

            <!-- Log activity CTA -->
            <button class="log-cta" (click)="openLogActivity()">+ LOG ACTIVITY</button>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="!loading && !data">
        <div class="not-found">User not found.</div>
      </ng-container>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  data: DashboardData | null = null;
  loading = true;
  weeklyPoints = 0;
  topEntries: any[] = [];
  pendingBoxes = 0;
  displayedXpPercent = 0;
  isBootUp = true;
  xpFlashActive = false;
  prevLevel = 0;
  levelUpActive = false;
  displayedLevel = 1;
  aiMode: 'ai' | 'basic' = 'basic';
  private sub?: Subscription;
  private _levelTicker?: ReturnType<typeof setInterval>;
  private _levelReset?: ReturnType<typeof setTimeout>;

  // XP / level (from API data.xp)
  get level(): number { return this.data?.xp?.level ?? 1; }
  get levelTitle(): string { return this.data?.xp?.levelTitle ?? 'ROOKIE'; }
  get xpPercent(): number { return this.data?.xp?.xpPercent ?? 0; }
  get xpInLevel(): number { return this.data?.xp?.xpInLevel ?? 0; }
  get xpForNextLevel(): number { return this.data?.xp?.xpForNextLevel ?? 200; }
  get prestigeLevel(): number { return this.data?.xp?.prestigeLevel ?? 0; }
  get isMaxLevel(): boolean { return this.level >= 10; }

  get missionsDone(): number { return this.data?.dailyMissions?.filter(m => m.completed).length ?? 0; }

  get currentUserId(): string { return localStorage.getItem('userId') ?? ''; }


  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private activityLogged: ActivityLoggedService,
    private userState: UserStateService,
  ) {}

  ngOnInit() {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }
    this.loadData(userId);
    this.sub = this.activityLogged.activityLogged$.subscribe(() => this.loadData());
    this.api.getAiStatus().subscribe({ next: s => this.aiMode = s.mode, error: () => {} });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    clearInterval(this._levelTicker);
    clearTimeout(this._levelReset);
  }

  private triggerLevelUp(fromLevel: number, toLevel: number): void {
    this.levelUpActive = true;
    this.xpFlashActive = true;
    this.displayedLevel = fromLevel;

    const steps = toLevel - fromLevel;
    let step = 0;
    this._levelTicker = setInterval(() => {
      step++;
      this.displayedLevel = fromLevel + step;
      if (step >= steps) clearInterval(this._levelTicker);
    }, 80);

    this._levelReset = setTimeout(() => { this.levelUpActive = false; }, 2000);
  }

  loadData(userId?: string) {
    const uid = userId ?? localStorage.getItem('userId');
    if (!uid) return;
    this.loading = true;
    this.api.getDashboard(uid).subscribe({
      next: data => {
        const bootUp = this.isBootUp;
        this.data = data;
        if (data.rivalStatus?.justFlipped && !data.rivalStatus.imAhead) {
          this.snackBar.open(`${data.rivalStatus.firstName} just passed you!`, '', { duration: 4000, panelClass: 's4y-toast' });
        }
        this.loadPendingBoxes(uid);
        if (data.xp) {
          this.userState.setXp(data.xp);
        }
        this.weeklyPoints = data.pointsOverTime
          .filter(p => new Date(p.date) >= new Date(Date.now() - 7 * 86400000))
          .reduce((s, p) => s + p.points, 0);
        this.loading = false;
        this.loadLeaderboard(uid);

        if (bootUp) {
          // Sync level display and snapshot on first load — no burst
          this.displayedLevel = this.level;
          this.prevLevel = this.level;
          setTimeout(() => {
            this.displayedXpPercent = this.xpPercent;
            setTimeout(() => { this.isBootUp = false; }, 1350);
          }, 0);
        } else {
          // Check for level crossing before updating snapshot
          if (this.level > this.prevLevel) {
            this.triggerLevelUp(this.prevLevel, this.level);
          } else {
            this.xpFlashActive = true;
          }
          this.displayedXpPercent = this.xpPercent;
          this.prevLevel = this.level;
        }
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 404) {
          localStorage.removeItem('userId');
          this.dialog.open(RegisterDialogComponent, { disableClose: true, width: '400px', panelClass: 's4y-welcome-dialog' })
            .afterClosed().subscribe(userId => {
              if (userId) window.location.reload();
            });
          return;
        }
        this.snackBar.open('Failed to load dashboard. Please try again.', 'OK', { duration: 4000 });
      },
    });
  }

  private loadLeaderboard(myId: string) {
    this.api.getLeaderboard().subscribe({
      next: entries => {
        this.topEntries = entries.slice(0, 4).map(e => ({ ...e, isMe: e.userId === myId }));
      },
    });
  }

  private loadPendingBoxes(userId: string): void {
    this.api.getBoxes(userId).subscribe({
      next: info => { this.pendingBoxes = info.pendingCount; },
      error: () => {},
    });
  }

  openBoxModal(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    const ref = this.dialog.open(LootBoxModalComponent, {
      data: { userId, pending: this.pendingBoxes },
      width: '400px',
      disableClose: false,
    });
    ref.afterClosed().subscribe(remaining => {
      if (remaining !== undefined) this.pendingBoxes = remaining;
    });
  }

  openAiCoach(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    const ref = this.dialog.open(AiCoachDialogComponent, {
      data: { userId, mode: this.aiMode },
      width: '400px',
    });
    ref.afterClosed().subscribe(logged => { if (logged) this.loadData(); });
  }

  promptPrestige(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    this.snackBar.open(
      'Reset to Level 1 for +5% activity XP, forever?', 'Prestige', { duration: 8000 }
    ).onAction().subscribe(() => this.confirmPrestige(userId));
  }

  private confirmPrestige(userId: string): void {
    this.api.prestige(userId).subscribe({
      next: ({ prestigeLevel }) => {
        this.loadData(userId);
        this.triggerPrestigeCelebration();
        this.snackBar.open(
          `🎉 Prestige ${prestigeLevel}! +${prestigeLevel * 5}% activity XP, forever.`, '',
          { duration: 5000, panelClass: 's4y-toast' }
        );
      },
      error: () => this.snackBar.open('Failed to prestige. Please try again.', 'OK', { duration: 4000 }),
    });
  }

  private triggerPrestigeCelebration(): void {
    this.levelUpActive = true;
    this.xpFlashActive = true;
    this.displayedLevel = 1;
    this._levelReset = setTimeout(() => { this.levelUpActive = false; }, 2000);
  }

  tierIcon(tier: string): string {
    return tier === 'easy' ? 'star' : tier === 'medium' ? 'trophy' : 'flame';
  }

  tierStrip(tier: string): string {
    const map: Record<string, string> = {
      gold: 'linear-gradient(180deg,#FDE9A7,#F5B300)',
      silver: 'linear-gradient(180deg,#F2F5FA,#93A1B7)',
      bronze: 'linear-gradient(180deg,#F5D3A3,#8A4F16)',
    };
    return map[tier] ?? 'linear-gradient(180deg,#F2F5FA,#93A1B7)';
  }

  tierLabelColor(tier: string): string {
    return { gold: '#C58A00', silver: '#7E8A9C', bronze: '#B5701E' }[tier] ?? '#7E8A9C';
  }

  progressPercent(m: DailyMissionItem): number {
    if (m.progressMax <= 0) return 0;
    return Math.min(100, Math.round((m.progress / m.progressMax) * 100));
  }

  openLogActivity() {
    const ref = this.dialog.open(LogActivityDialogComponent, { width: '560px', maxWidth: '95vw', panelClass: 's4y-watch-dialog' });
    ref.afterClosed().subscribe(result => { if (result?.points !== undefined) this.loadData(); });
  }

  formatSport(sport: string) { return sport.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  sportIconName(sport: string): string { return SPORT_ICON_NAMES[sport] ?? 'medal'; }
  sportBg(sport: string) {
    const map: Record<string, string> = {
      running: '#EAF7C9', walking: '#E7F0FF', cycling: '#E7F0FF',
      swimming: '#E7F6FA', gym: '#F5E7FF', daily_steps: '#FFF3E0',
    };
    return map[sport] ?? '#F4F6FB';
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatMetric(a: ActivityItem) {
    if (a.distance != null) return `${a.distance} km`;
    if (a.duration != null) return a.duration;
    if (a.steps != null) return `${a.steps.toLocaleString()} steps`;
    return '';
  }
}
