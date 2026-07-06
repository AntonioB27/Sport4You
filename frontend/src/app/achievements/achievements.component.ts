// frontend/src/app/achievements/achievements.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../shared/services/api.service';
import { AchievementStatus, XpInfo } from '../shared/models/dashboard.model';
import { achievementIconPath } from '../shared/utils/achievement-icon';

interface RailDef {
  label: string;
  pillColor: string;
  pillBg: string;
  requirementType: string;
  sport: string | null;
  unit: 'km' | 'min' | 'steps' | 'days' | 'level' | 'rank';
}

interface SectionDef {
  label: string;
  rails: RailDef[];
}

const SECTIONS: SectionDef[] = [
  {
    label: 'Sport Distance Milestones',
    rails: [
      { label: 'RUNNING', pillColor: '#2E6BE6', pillBg: '#EAF1FF', requirementType: 'total_km', sport: 'running', unit: 'km' },
      { label: 'WALKING', pillColor: '#2f9e57', pillBg: '#EAF7EE', requirementType: 'total_km', sport: 'walking', unit: 'km' },
      { label: 'CYCLING', pillColor: '#d1841f', pillBg: '#FFF3E6', requirementType: 'total_km', sport: 'cycling', unit: 'km' },
    ],
  },
  {
    label: 'Sport Duration Milestones',
    rails: [
      { label: 'SWIMMING', pillColor: '#0e93b0', pillBg: '#E6F7FB', requirementType: 'total_minutes', sport: 'swimming', unit: 'min' },
      { label: 'GYM', pillColor: '#7a4fd1', pillBg: '#F1EBFD', requirementType: 'total_minutes', sport: 'gym', unit: 'min' },
    ],
  },
  {
    label: 'Steps Milestones',
    rails: [
      { label: 'STEPS', pillColor: '#0f8f7a', pillBg: '#E5F6F2', requirementType: 'total_steps', sport: null, unit: 'steps' },
    ],
  },
  {
    label: 'Streaks',
    rails: [
      { label: 'STREAK', pillColor: '#d14f4f', pillBg: '#FDEDED', requirementType: 'streak_days', sport: null, unit: 'days' },
    ],
  },
  {
    label: 'XP Journey',
    rails: [
      { label: 'LEVELS', pillColor: '#5b3fd1', pillBg: '#EEEAFC', requirementType: 'level_reached', sport: null, unit: 'level' },
    ],
  },
  {
    label: 'Leaderboard Feats',
    rails: [
      { label: 'RANKING', pillColor: '#b58900', pillBg: '#FBF3DC', requirementType: 'leaderboard_rank', sport: null, unit: 'rank' },
    ],
  },
];

const ONE_TIME_TYPES = ['first_activity', 'first_mission', 'first_sweep', 'all_sports', 'points_in_day', 'achievements_unlocked'];
const TIER_ORDER = ['bronze', 'silver', 'gold'];

interface TierMeta {
  frame: string;
  frameShadow: string;
  labelColor: string;
  rarity: string;
  badgeColor: string;
  badgeBg: string;
}

const TIER_META: Record<string, TierMeta> = {
  bronze: {
    frame: 'linear-gradient(160deg,#F5D3A3,#CD7F32 55%,#8A4F16)',
    frameShadow: '0 18px 30px -20px rgba(205,127,50,.6)',
    labelColor: '#B5701E', rarity: 'COMMON',
    badgeColor: '#fff', badgeBg: 'rgba(138,79,22,.9)',
  },
  silver: {
    frame: 'linear-gradient(160deg,#F2F5FA,#C6CFDE 55%,#93A1B7)',
    frameShadow: '0 18px 30px -20px rgba(120,140,170,.55)',
    labelColor: '#7E8A9C', rarity: 'RARE',
    badgeColor: '#fff', badgeBg: 'rgba(90,105,130,.9)',
  },
  gold: {
    frame: 'linear-gradient(160deg,#FDE9A7,#F5B300 50%,#B57C00)',
    frameShadow: '0 18px 30px -18px rgba(245,179,0,.5)',
    labelColor: '#C58A00', rarity: 'LEGENDARY',
    badgeColor: '#7a5200', badgeBg: 'rgba(255,255,255,.85)',
  },
  platinum: {
    frame: 'linear-gradient(160deg,#ffffff,#cfd9ff 45%,#e8e8e8 70%,#b8c4ff)',
    frameShadow: '0 18px 30px -18px rgba(150,170,255,.6)',
    labelColor: '#5b6fd6', rarity: 'MYTHIC',
    badgeColor: '#3a4a9e', badgeBg: 'rgba(255,255,255,.9)',
  },
};

const LOCKED_FRAME = 'linear-gradient(160deg,#e3e9f2,#c1ccdb)';
const LOCKED_FRAME_SHADOW = '0 14px 24px -20px rgba(16,30,60,.4)';

@Component({
  selector: 'app-achievement-card',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display:block; width:100%; }
    .card {
      position:relative; border-radius:18px; padding:3px; cursor:pointer;
      transition:transform .18s, box-shadow .18s; overflow:hidden;
    }
    .card:hover { transform:translateY(-6px); }
    .holo {
      position:absolute; inset:0; z-index:4; pointer-events:none;
      background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.55) 48%, transparent 58%);
      background-size:220% 100%; animation:holoSweep 4s linear infinite;
    }
    @keyframes holoSweep { 0% { background-position:-160% 0; } 100% { background-position:260% 0; } }
    .rarity {
      position:absolute; top:12px; right:12px; z-index:5;
      font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700;
      letter-spacing:.12em; border-radius:999px; padding:4px 9px;
    }
    .inner { border-radius:15px; background:#fff; overflow:hidden; }
    .inner.locked-bg { background:#f7f9fc; }
    .art { position:relative; aspect-ratio:1; overflow:hidden; }
    .art img { width:100%; height:100%; object-fit:cover; display:block; }
    .art img.locked-img { filter:grayscale(1) brightness(1.1) opacity(.45); }
    .tier-chip {
      position:absolute; top:10px; left:10px; width:32px; height:32px; border-radius:9px;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 6px 12px -6px rgba(16,30,60,.5);
    }
    .lock-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; }
    .lock-circle {
      width:42px; height:42px; border-radius:50%; background:rgba(255,255,255,.88);
      border:1px solid #e0e6ef; display:flex; align-items:center; justify-content:center;
      box-shadow:0 8px 16px -8px rgba(16,30,60,.35);
    }
    .body { padding:12px 14px 14px; }
    .tier-label {
      font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700;
      letter-spacing:.16em; margin-bottom:4px;
    }
    .name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:16px; color:#10203E; line-height:1.1; }
    .name.locked-text { color:#5c6881; }
    .desc { font-size:12px; color:#8592ad; margin-top:2px; }
    .footer {
      display:flex; align-items:center; justify-content:space-between;
      margin-top:11px; padding-top:10px; border-top:1px solid #eef2f8;
    }
    .unlocked-tag {
      display:inline-flex; align-items:center; gap:6px;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; color:#5f7a00;
    }
    .check {
      width:16px; height:16px; border-radius:50%; background:#C6E63B;
      display:inline-flex; align-items:center; justify-content:center;
    }
    .locked-tag {
      display:inline-flex; align-items:center; gap:5px;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; color:#8592ad;
    }
    .date { font-family:'Chakra Petch',sans-serif; font-size:11px; color:#b0bcd4; }
    .xp-reward { font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; color:#2E6BE6; }
  `],
  template: `
    <div class="card"
         [style.background]="frame"
         [style.box-shadow]="frameShadow">
      @if (showHolo) { <div class="holo"></div> }
      <div class="rarity" [style.color]="rarityColor" [style.background]="rarityBg"
           [style.border]="a.unlocked ? 'none' : '1px solid #e0e6ef'">
        {{ meta.rarity }} · {{ a.ownedByPercent }}%
      </div>
      <div class="inner" [class.locked-bg]="!a.unlocked">
        <div class="art">
          <img [src]="iconPath" [alt]="a.name" [class.locked-img]="!a.unlocked">
          @if (a.unlocked) {
            <div class="tier-chip" [style.background]="meta.frame">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2l2.6 5.6L20 8.3l-4 4 1 5.7L12 15.6 7 18l1-5.7-4-4 5.4-.7L12 2z" fill="#fff"/></svg>
            </div>
          } @else {
            <div class="lock-overlay">
              <div class="lock-circle">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" [attr.fill]="lockColor"/><path d="M8 11V8a4 4 0 018 0v3" [attr.stroke]="lockColor" stroke-width="2" fill="none"/></svg>
              </div>
            </div>
          }
        </div>
        <div class="body">
          <div class="tier-label" [style.color]="meta.labelColor">{{ a.tier.toUpperCase() }}</div>
          <div class="name" [class.locked-text]="!a.unlocked">{{ a.name }}</div>
          <div class="desc">{{ a.description }}</div>
          <div class="footer">
            @if (a.unlocked) {
              <div class="unlocked-tag">
                <span class="check"><svg width="9" height="9" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#1c2a06" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                Unlocked
              </div>
              <div class="date">{{ a.unlockedAt | date:'MMM d' }}</div>
            } @else {
              <div class="locked-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="#a3aec2"/><path d="M8 11V8a4 4 0 018 0v3" stroke="#a3aec2" stroke-width="2" fill="none"/></svg>
                LOCKED
              </div>
              <div class="xp-reward" [style.color]="a.tier === 'gold' ? '#C58A00' : '#2E6BE6'">+{{ a.xpReward }} XP</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AchievementCardComponent {
  @Input({ required: true }) a!: AchievementStatus;

  get meta(): TierMeta { return TIER_META[this.a.tier] ?? TIER_META['bronze']; }
  get iconPath(): string { return achievementIconPath(this.a); }

  // Locked cards get a muted gray frame — except gold, which keeps its
  // legendary gold + holo sweep as a tease (per the 2a design).
  get frame(): string {
    if (this.a.unlocked || this.a.tier === 'gold') return this.meta.frame;
    return LOCKED_FRAME;
  }
  get frameShadow(): string {
    if (this.a.unlocked || this.a.tier === 'gold') return this.meta.frameShadow;
    return LOCKED_FRAME_SHADOW;
  }
  get showHolo(): boolean { return this.a.tier === 'gold'; }
  get lockColor(): string { return this.a.tier === 'gold' ? '#C58A00' : '#8592ad'; }
  get rarityColor(): string { return this.a.unlocked || this.a.tier === 'gold' ? this.meta.badgeColor : '#7E8A9C'; }
  get rarityBg(): string { return this.a.unlocked || this.a.tier === 'gold' ? this.meta.badgeBg : '#f2f5fa'; }
}

@Component({
  selector: 'app-achievements',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, AchievementCardComponent],
  styles: [`
    .page { padding:26px 30px 60px; font-family:'Nunito',system-ui,sans-serif; max-width:1240px; }
    .spinner-wrap { display:flex; justify-content:center; padding:80px; }

    .panel-fx { filter: drop-shadow(0 34px 70px rgba(16,30,60,.4)); }
    .panel {
      position:relative; overflow:hidden; background:#EEF3FB; box-shadow: inset 0 0 0 1px #dbe4f2;
      clip-path: polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px);
    }

    /* ── HUD bar ── */
    .hud {
      display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
      padding:22px 30px;
      background:linear-gradient(120deg,#12245090,#0e1a34 70%),
                 radial-gradient(120% 160% at 100% 0%, rgba(46,107,230,.55), transparent), #0f1e3b;
    }
    .hud-left { display:flex; align-items:center; gap:14px; }
    .hud-star {
      width:42px; height:42px; border-radius:12px;
      background:linear-gradient(150deg,#C6E63B,#9ECF10);
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 8px 18px -8px rgba(158,207,16,.9);
    }
    .hud-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:22px; color:#fff; letter-spacing:.14em; }
    .hud-sub { font-size:12px; color:#9db3dd; font-weight:700; }
    .hud-right { display:flex; align-items:center; gap:12px; }
    .hud-level { text-align:right; }
    .hud-level-label { font-family:'Chakra Petch',sans-serif; font-size:11px; color:#9db3dd; font-weight:700; letter-spacing:.16em; }
    .hud-level-xp { font-family:'Chakra Petch',sans-serif; font-size:13px; color:#C6E63B; font-weight:700; }
    .hud-count {
      display:flex; align-items:center; gap:10px; background:rgba(255,255,255,.08);
      border:1px solid rgba(198,230,59,.4); border-radius:999px; padding:9px 18px;
    }
    .hud-count-n { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:20px; color:#C6E63B; }
    .hud-count-total { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; color:#c8d6f0; }

    .content { padding:26px 30px 34px; }

    /* ── Spotlight ── */
    .spotlight-fx { filter: drop-shadow(0 26px 46px rgba(30,79,184,.55)); margin-bottom:30px; }
    .spotlight {
      display:grid; grid-template-columns:300px 1fr; overflow:hidden;
      background:linear-gradient(135deg,#2E6BE6,#173B92); position:relative;
      clip-path: polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px);
    }
    .spotlight-sweep {
      position:absolute; inset:0; pointer-events:none;
      background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.22) 46%, transparent 60%);
      background-size:220% 100%; animation:holoSweepPage 4.5s linear infinite;
    }
    @keyframes holoSweepPage { 0% { background-position:-160% 0; } 100% { background-position:260% 0; } }
    .spotlight-art { position:relative; padding:22px; display:flex; align-items:center; justify-content:center; }
    .spotlight-art img {
      width:100%; height:220px; object-fit:cover; border-radius:16px;
      box-shadow:0 14px 26px rgba(0,0,0,.35);
    }
    .spotlight-body { position:relative; padding:30px 34px; color:#fff; display:flex; flex-direction:column; justify-content:center; }
    .spotlight-chip {
      display:inline-flex; align-self:flex-start; align-items:center; gap:8px;
      background:rgba(198,230,59,.16); border:1px solid rgba(198,230,59,.55); color:#C6E63B;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; letter-spacing:.2em;
      padding:6px 12px; border-radius:999px; margin-bottom:14px;
    }
    .spotlight-tier { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.24em; color:#f0c08a; margin-bottom:4px; }
    .spotlight-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:38px; line-height:1; margin-bottom:8px; text-shadow:0 0 22px rgba(46,107,230,.6); }
    .spotlight-desc { font-size:15px; color:#cfe0ff; margin-bottom:18px; }
    .spotlight-meta { display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
    .spotlight-xp {
      display:inline-flex; align-items:center; gap:8px; background:#C6E63B; color:#1c2a06;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px;
      padding:9px 16px; border-radius:11px; box-shadow:0 10px 20px -10px rgba(198,230,59,.9);
    }
    .spotlight-info { font-family:'Chakra Petch',sans-serif; font-size:13px; color:#a9c1ee; font-weight:700; }

    /* ── Section header ── */
    .section { margin-bottom:34px; }
    .section-header { display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap; margin-bottom:20px; }
    .section-title-wrap { display:flex; align-items:center; gap:12px; }
    .section-title-wrap::before {
      content:''; display:block; flex:0 0 auto; width:3px; height:18px;
      background:#9ECF10; box-shadow:0 0 8px rgba(158,207,16,.7);
    }
    .section-title { font-family:'Chakra Petch',sans-serif; font-size:15px; font-weight:700; letter-spacing:.18em; color:#10203E; }
    .section-count {
      font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700; color:#8592ad;
      background:#fff; border:1px solid #E3EAF5; border-radius:999px; padding:3px 11px;
    }
    .section-meter { display:flex; align-items:center; gap:12px; min-width:280px; flex:0 1 320px; }
    .section-meter-bar { flex:1; height:12px; border-radius:999px; background:#dbe4f2; overflow:hidden; box-shadow:inset 0 1px 3px rgba(16,30,60,.15); }
    .section-meter-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,#C6E63B,#9ECF10); box-shadow:0 0 10px rgba(158,207,16,.7); }
    .section-meter-label { font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700; color:#5f7a00; white-space:nowrap; }

    /* ── Rails ── */
    .rail { display:flex; align-items:center; gap:14px; margin-bottom:20px; }
    .rail:last-child { margin-bottom:0; }
    .rail-label { width:92px; flex:0 0 auto; }
    .rail-pill {
      display:inline-flex; align-items:center; font-family:'Chakra Petch',sans-serif;
      font-weight:700; font-size:13px; letter-spacing:.08em; border-radius:999px; padding:6px 12px;
    }
    .rail-total { font-family:'Chakra Petch',sans-serif; font-size:11px; color:#8592ad; margin-top:7px; padding-left:4px; }
    .rail-card { flex:1 1 220px; min-width:220px; max-width:300px; }
    .connector { flex:1 1 48px; min-width:48px; display:flex; flex-direction:column; align-items:center; gap:7px; }
    .connector-bar { width:100%; height:8px; border-radius:999px; background:#dbe4f2; overflow:hidden; }
    .connector-fill { height:100%; border-radius:999px; }
    .connector-fill.active { background:linear-gradient(90deg,#9ECF10,#C6E63B); }
    .connector-fill.pending { background:linear-gradient(90deg,#5b8ef0,#2E6BE6); }
    .connector-label {
      font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; color:#2E6BE6;
      background:#fff; border:1px solid #E3EAF5; border-radius:999px; padding:3px 9px; white-space:nowrap;
    }

    /* ── One-time feats grid ── */
    .feats-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:18px; }

    @media (max-width: 900px) {
      .spotlight { grid-template-columns:1fr; }
      .rail { flex-wrap:wrap; }
      .connector { min-width:100%; flex-basis:100%; }
    }
  `],
  template: `
    <div class="page">
      @if (loading) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else {
        <div class="panel-fx">
        <div class="panel">
          <!-- HUD -->
          <div class="hud">
            <div class="hud-left">
              <div class="hud-star">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.6 5.6L20 8.3l-4 4 1 5.7L12 15.6 7 18l1-5.7-4-4 5.4-.7L12 2z" fill="#0f1e3b"/></svg>
              </div>
              <div>
                <div class="hud-title">ACHIEVEMENTS</div>
                <div class="hud-sub">Push each rail from bronze to legendary gold</div>
              </div>
            </div>
            <div class="hud-right">
              @if (xp) {
                <div class="hud-level">
                  <div class="hud-level-label">LEVEL {{ xp.level }} · {{ xp.levelTitle.toUpperCase() }}</div>
                  <div class="hud-level-xp">{{ xpToNextLevel | number }} XP to next level</div>
                </div>
              }
              <div class="hud-count">
                <span class="hud-count-n">{{ unlockedCount }}</span>
                <span class="hud-count-total">/ {{ achievements.length }} unlocked</span>
              </div>
            </div>
          </div>

          <div class="content">
            <!-- Latest unlock spotlight -->
            @if (latestUnlock; as latest) {
              <div class="spotlight-fx">
              <div class="spotlight">
                <div class="spotlight-sweep"></div>
                <div class="spotlight-art">
                  <img [src]="iconPath(latest)" [alt]="latest.name">
                </div>
                <div class="spotlight-body">
                  <div class="spotlight-chip">✦ LATEST UNLOCK</div>
                  <div class="spotlight-tier">{{ latest.tier.toUpperCase() }} · {{ rarity(latest) }}</div>
                  <div class="spotlight-name">{{ latest.name }}</div>
                  <div class="spotlight-desc">{{ latest.description }}</div>
                  <div class="spotlight-meta">
                    <div class="spotlight-xp">+{{ latest.xpReward }} XP earned</div>
                    <div class="spotlight-info">
                      Unlocked {{ latest.unlockedAt | date:'MMM d, y' }} · owned by {{ latest.ownedByPercent }}% of players
                    </div>
                  </div>
                </div>
              </div>
              </div>
            }

            <!-- Progression rails per section -->
            @for (section of sections; track section.label) {
              @if (sectionAchievements(section).length > 0) {
                <div class="section">
                  <div class="section-header">
                    <div class="section-title-wrap">
                      <div class="section-title">{{ section.label.toUpperCase() }}</div>
                      <div class="section-count">{{ sectionUnlocked(section) }} / {{ sectionAchievements(section).length }}</div>
                    </div>
                    <div class="section-meter">
                      <div class="section-meter-bar">
                        <div class="section-meter-fill" [style.width.%]="sectionXpPercent(section)"></div>
                      </div>
                      <div class="section-meter-label">{{ sectionXpEarned(section) }} / {{ sectionXpTotal(section) }} XP</div>
                    </div>
                  </div>

                  @for (rail of section.rails; track rail.label) {
                    @if (railAchievements(rail).length > 0) {
                      <div class="rail">
                        <div class="rail-label">
                          <div class="rail-pill" [style.color]="rail.pillColor" [style.background]="rail.pillBg">{{ rail.label }}</div>
                          <div class="rail-total">{{ railTotal(rail) }}</div>
                        </div>
                        @for (a of railAchievements(rail); track a.id; let i = $index, last = $last) {
                          <div class="rail-card"><app-achievement-card [a]="a"></app-achievement-card></div>
                          @if (!last) {
                            <div class="connector">
                              <div class="connector-bar">
                                <div class="connector-fill"
                                     [class.active]="a.unlocked" [class.pending]="!a.unlocked"
                                     [style.width.%]="connectorPercent(rail, i)"></div>
                              </div>
                              <div class="connector-label">{{ connectorLabel(rail, i) }}</div>
                            </div>
                          }
                        }
                      </div>
                    }
                  }
                </div>
              }
            }

            <!-- One-time feats -->
            @if (oneTimeFeats.length > 0) {
              <div class="section">
                <div class="section-header">
                  <div class="section-title-wrap">
                    <div class="section-title">ONE-TIME FEATS</div>
                    <div class="section-count">{{ oneTimeUnlocked }} / {{ oneTimeFeats.length }}</div>
                  </div>
                  <div class="section-meter">
                    <div class="section-meter-bar">
                      <div class="section-meter-fill" [style.width.%]="oneTimeXpPercent"></div>
                    </div>
                    <div class="section-meter-label">{{ oneTimeXpEarned }} / {{ oneTimeXpTotal }} XP</div>
                  </div>
                </div>
                <div class="feats-grid">
                  @for (a of oneTimeFeats; track a.id) {
                    <app-achievement-card [a]="a"></app-achievement-card>
                  }
                </div>
              </div>
            }
          </div>
        </div>
        </div>
      }
    </div>
  `,
})
export class AchievementsComponent implements OnInit {
  achievements: AchievementStatus[] = [];
  xp: XpInfo | null = null;
  loading = true;
  sections = SECTIONS;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }

    this.api.getAchievements(userId).subscribe({
      next: (page) => {
        this.achievements = page.achievements;
        this.xp = page.xp;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  get unlockedCount(): number {
    return this.achievements.filter(a => a.unlocked).length;
  }

  get xpToNextLevel(): number {
    return this.xp ? Math.max(0, this.xp.xpForNextLevel - this.xp.xpInLevel) : 0;
  }

  get latestUnlock(): AchievementStatus | null {
    const unlocked = this.achievements.filter(a => a.unlocked && a.unlockedAt);
    if (unlocked.length === 0) return null;
    return unlocked.reduce((best, a) => a.unlockedAt! > best.unlockedAt! ? a : best);
  }

  get oneTimeFeats(): AchievementStatus[] {
    return this.achievements.filter(a => ONE_TIME_TYPES.includes(a.requirementType));
  }
  get oneTimeUnlocked(): number { return this.oneTimeFeats.filter(a => a.unlocked).length; }
  get oneTimeXpEarned(): number { return this.oneTimeFeats.filter(a => a.unlocked).reduce((s, a) => s + a.xpReward, 0); }
  get oneTimeXpTotal(): number { return this.oneTimeFeats.reduce((s, a) => s + a.xpReward, 0); }
  get oneTimeXpPercent(): number { return this.oneTimeXpTotal === 0 ? 0 : Math.round(100 * this.oneTimeXpEarned / this.oneTimeXpTotal); }

  railAchievements(rail: RailDef): AchievementStatus[] {
    return this.achievements
      .filter(a => a.requirementType === rail.requirementType
                && (rail.sport === null || a.sport?.toLowerCase() === rail.sport))
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  }

  sectionAchievements(section: SectionDef): AchievementStatus[] {
    return section.rails.flatMap(r => this.railAchievements(r));
  }
  sectionUnlocked(section: SectionDef): number {
    return this.sectionAchievements(section).filter(a => a.unlocked).length;
  }
  sectionXpEarned(section: SectionDef): number {
    return this.sectionAchievements(section).filter(a => a.unlocked).reduce((s, a) => s + a.xpReward, 0);
  }
  sectionXpTotal(section: SectionDef): number {
    return this.sectionAchievements(section).reduce((s, a) => s + a.xpReward, 0);
  }
  sectionXpPercent(section: SectionDef): number {
    const total = this.sectionXpTotal(section);
    return total === 0 ? 0 : Math.round(100 * this.sectionXpEarned(section) / total);
  }

  railTotal(rail: RailDef): string {
    const list = this.railAchievements(rail);
    if (list.length === 0) return '';
    const p = list[0].progress;
    switch (rail.unit) {
      case 'km':    return `${this.fmt(p)} km total`;
      case 'min':   return `${this.fmt(p)} min total`;
      case 'steps': return `${p.toLocaleString()} steps`;
      case 'days':  return `${p} day streak`;
      case 'level': return `Level ${p}`;
      case 'rank':  return `Rank #${p}`;
    }
  }

  // Progress from card i toward card i+1 on a rail (0–100).
  connectorPercent(rail: RailDef, i: number): number {
    const list = this.railAchievements(rail);
    const next = list[i + 1];
    if (!next) return 0;
    if (next.unlocked) return 100;
    if (rail.unit === 'rank') {
      // Lower rank is better: progress toward "reach top N".
      return Math.min(100, Math.round(100 * next.requirementValue / Math.max(next.progress, 1)));
    }
    if (next.requirementValue <= 0) return 0;
    return Math.min(100, Math.round(100 * next.progress / next.requirementValue));
  }

  connectorLabel(rail: RailDef, i: number): string {
    const list = this.railAchievements(rail);
    const next = list[i + 1];
    if (!next) return '';
    if (next.unlocked) return '✓ Unlocked';
    const p = next.progress;
    const req = next.requirementValue;
    switch (rail.unit) {
      case 'km':    return `${this.fmt(p)} / ${this.fmt(req)} km`;
      case 'min':   return `${this.fmt(p)} / ${this.fmt(req)} min`;
      case 'steps': return `${p.toLocaleString()} / ${req.toLocaleString()}`;
      case 'days':  return `${p} / ${req} days`;
      case 'level': return `Lv ${p} / ${req}`;
      case 'rank':  return `#${p} → top ${req}`;
    }
  }

  rarity(a: AchievementStatus): string {
    return TIER_META[a.tier]?.rarity ?? 'COMMON';
  }

  iconPath(a: AchievementStatus): string {
    return achievementIconPath(a);
  }

  private fmt(v: number): string {
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  }
}
