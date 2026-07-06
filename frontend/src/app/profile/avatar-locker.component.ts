// frontend/src/app/profile/avatar-locker.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarStatus } from '../shared/models/dashboard.model';

interface LockerGroup {
  key: string;
  label: string;
}

const GROUPS: LockerGroup[] = [
  { key: 'default',            label: 'STARTER' },
  { key: 'level_reached',      label: 'LEVEL UP' },
  { key: 'streak_days',        label: 'STREAK' },
  { key: 'achievement_earned', label: 'BADGE EARNED' },
  { key: 'activities_logged',  label: 'ACTIVITIES LOGGED' },
  { key: 'loot_box',           label: 'LOOT BOX' },
  { key: 'shop',               label: 'SHOP' },
];

@Component({
  selector: 'app-avatar-locker',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }
    .panel-fx { filter: drop-shadow(0 34px 70px rgba(16,30,60,.4)); }
    .panel {
      position: relative; overflow: hidden; background: #EEF3FB; box-shadow: inset 0 0 0 1px #dbe4f2;
      clip-path: polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px);
    }

    /* ── HUD bar ── */
    .hud {
      display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
      padding: 22px 30px;
      background: linear-gradient(120deg,#12245090,#0e1a34 70%),
                  radial-gradient(120% 160% at 100% 0%, rgba(46,107,230,.55), transparent), #0f1e3b;
    }
    .hud-left { display: flex; align-items: center; gap: 14px; }
    .hud-icon {
      width: 42px; height: 42px; border-radius: 12px;
      background: linear-gradient(150deg,#C6E63B,#9ECF10);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 18px -8px rgba(158,207,16,.9);
    }
    .hud-title { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 22px; color: #fff; letter-spacing: .14em; }
    .hud-sub { font-size: 12px; color: #9db3dd; font-weight: 700; }
    .hud-count {
      display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,.08);
      border: 1px solid rgba(198,230,59,.4); border-radius: 999px; padding: 9px 18px;
    }
    .hud-count-n { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 20px; color: #C6E63B; }
    .hud-count-total { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; color: #c8d6f0; }

    /* ── Body ── */
    .body { padding: 28px 30px 32px; display: grid; grid-template-columns: 300px 1fr; gap: 26px; }
    @media (max-width: 900px) { .body { grid-template-columns: 1fr; } }

    /* ── Portrait pane ── */
    .portrait {
      position: relative; overflow: hidden; align-self: start;
      background: linear-gradient(180deg,#EAF1FF,#DCE8FF); box-shadow: inset 0 0 0 2px #C7D8F5; padding: 24px 20px;
      display: flex; flex-direction: column; align-items: center;
      clip-path: polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px);
      animation: popIn .5s ease;
    }
    @keyframes popIn { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.03); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    .portrait-pill {
      font-family: 'Chakra Petch', sans-serif; font-size: 10px; letter-spacing: .22em; color: #2E6BE6;
      font-weight: 700; margin-bottom: 14px; background: #fff; border: 1px solid #d3e0f5;
      border-radius: 999px; padding: 5px 12px;
    }
    .portrait-stage { position: relative; width: 216px; height: 216px; display: flex; align-items: center; justify-content: center; }
    .portrait-ring {
      position: absolute; inset: 0; border-radius: 50%;
      border: 2px dashed rgba(46,107,230,.35); animation: ringSpin 16s linear infinite;
    }
    @keyframes ringSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .medallion {
      position: relative; width: 180px; height: 180px; border-radius: 50%; padding: 7px;
      background: linear-gradient(150deg,#2E6BE6,#1B47AE);
      box-shadow: 0 0 0 5px rgba(198,230,59,.5), 0 18px 34px -16px rgba(30,79,184,.7);
    }
    .medallion-inner {
      width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
      background: linear-gradient(165deg,#F1F6FF,#D6E4FB);
      box-shadow: inset 0 3px 10px rgba(16,30,60,.18);
    }
    .medallion-inner img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; display: block; }
    .portrait-name {
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 26px; color: #101f3c;
      letter-spacing: .02em; margin-top: 16px; text-align: center;
    }
    .portrait-desc { font-size: 13px; color: #5c6881; text-align: center; margin-top: 6px; }

    /* ── Locker rows ── */
    .row { margin-bottom: 22px; }
    .row:last-child { margin-bottom: 0; }
    .row-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .row-header::before {
      content: ''; display: block; flex: 0 0 auto; width: 3px; height: 16px;
      background: #9ECF10; box-shadow: 0 0 8px rgba(158,207,16,.7);
    }
    .row-label { font-family: 'Chakra Petch', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .18em; color: #10203E; }
    .row-rule { flex: 1; height: 2px; background: linear-gradient(90deg,#d7e0f0,transparent); border-radius: 2px; }
    .row-items { display: flex; flex-wrap: wrap; gap: 18px; }

    .locker { width: 104px; text-align: center; }
    .porthole {
      position: relative; width: 96px; height: 96px; margin: 0 auto; border-radius: 50%; padding: 4px;
      background: linear-gradient(160deg,#ffffff,#cddcf5);
      box-shadow: 0 12px 22px -14px rgba(16,30,60,.5);
      cursor: pointer; transition: transform .18s;
    }
    .porthole:hover { transform: translateY(-5px); }
    .porthole.equipped-porthole { cursor: default; }
    .porthole.equipped-porthole:hover { transform: none; }
    .porthole-img { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: linear-gradient(165deg,#EAF1FF,#D2E2FF); }
    .porthole-img img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%; display: block; }
    .equip-ring {
      position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
      box-shadow: 0 0 0 4px #C6E63B, 0 0 16px rgba(198,230,59,.8);
      animation: glowPulse 1.8s ease-in-out infinite;
    }
    @keyframes glowPulse { 0%,100% { box-shadow: 0 0 0 4px #C6E63B, 0 0 0 0 rgba(198,230,59,.55); } 50% { box-shadow: 0 0 0 4px #C6E63B, 0 0 0 10px rgba(198,230,59,0); } }

    .porthole.locked-porthole {
      background: linear-gradient(160deg,#eef2f8,#dbe3ef);
      box-shadow: 0 8px 16px -14px rgba(16,30,60,.4); cursor: default;
    }
    .porthole.locked-porthole:hover { transform: none; }
    .locked-face {
      width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
      background: radial-gradient(circle at 50% 38%, #f2f5fa, #dde5f1);
      display: flex; align-items: center; justify-content: center;
    }
    .locked-q { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 34px; color: #c2cddd; }
    .lock-badge {
      position: absolute; bottom: -2px; right: -2px; width: 30px; height: 30px; border-radius: 50%;
      background: #fff; border: 1px solid #e0e6ef; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 12px -6px rgba(16,30,60,.35);
    }

    .locker-equipped-tag { font-family: 'Chakra Petch', sans-serif; font-size: 9px; font-weight: 700; color: #5f7a00; margin-top: 8px; letter-spacing: .06em; }
    .locker-name { font-family: 'Chakra Petch', sans-serif; font-size: 10px; font-weight: 700; color: #10203E; margin-top: 8px; line-height: 1.2; min-height: 24px; }
    .locker-unlock { font-size: 9px; color: #8592ad; line-height: 1.25; }
  `],
  template: `
    <div class="panel-fx">
    <div class="panel">
      <div class="hud">
        <div class="hud-left">
          <div class="hud-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" fill="#0f1e3b"/><circle cx="15" cy="12" r="1.4" fill="#C6E63B"/></svg>
          </div>
          <div>
            <div class="hud-title">GEAR UP · SPOTRY LOCKERS</div>
            <div class="hud-sub">Pick a porthole to equip your fighter</div>
          </div>
        </div>
        <div class="hud-count">
          <span class="hud-count-n">{{ unlockedCount }}</span>
          <span class="hud-count-total">/ {{ avatars.length }} LOCKERS OPEN</span>
        </div>
      </div>

      <div class="body">
        <!-- Portrait pane; @for over one element so popIn replays per equip -->
        @for (eq of equipped ? [equipped] : []; track eq.id) {
          <div class="portrait">
            <div class="portrait-pill">✦ EQUIPPED · ON YOUR HERO</div>
            <div class="portrait-stage">
              <div class="portrait-ring"></div>
              <div class="medallion">
                <div class="medallion-inner" [style.border]="activeBorderCss">
                  <img [src]="eq.imagePath" [alt]="eq.name">
                </div>
              </div>
            </div>
            <div class="portrait-name">{{ eq.name }}</div>
            <div class="portrait-desc">{{ eq.description }}</div>
          </div>
        } @empty {
          <div class="portrait">
            <div class="portrait-pill">✦ NO AVATAR EQUIPPED</div>
            <div class="portrait-stage">
              <div class="portrait-ring"></div>
              <div class="medallion"><div class="medallion-inner"></div></div>
            </div>
            <div class="portrait-desc">Pick a porthole to equip your first Spotry.</div>
          </div>
        }

        <div>
          @for (section of sections; track section.label) {
            <div class="row">
              <div class="row-header">
                <div class="row-label">{{ section.label }}</div>
                <div class="row-rule"></div>
              </div>
              <div class="row-items">
                @for (a of section.items; track a.id) {
                  <div class="locker">
                    @if (a.unlocked) {
                      <div class="porthole" [class.equipped-porthole]="a.isActive"
                           (click)="onEquip(a)" [title]="a.description">
                        <div class="porthole-img"><img [src]="a.imagePath" [alt]="a.name"></div>
                        @if (a.isActive) { <div class="equip-ring"></div> }
                      </div>
                      @if (a.isActive) {
                        <div class="locker-equipped-tag">✓ EQUIPPED</div>
                      } @else {
                        <div class="locker-name">{{ a.name }}</div>
                      }
                    } @else {
                      <div class="porthole locked-porthole">
                        <div class="locked-face"><span class="locked-q">?</span></div>
                        <div class="lock-badge">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="#8592ad"/><path d="M8 11V8a4 4 0 018 0v3" stroke="#8592ad" stroke-width="2" fill="none"/></svg>
                        </div>
                      </div>
                      <div class="locker-name">??? Sporty</div>
                      <div class="locker-unlock">{{ a.description }}</div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
    </div>
  `,
})
export class AvatarLockerComponent {
  @Input({ required: true }) avatars: AvatarStatus[] = [];
  @Input() equipping = false;
  /** Equipped border CSS, shown as a ring around the preview avatar. */
  @Input() activeBorderCss: string | null = null;
  @Output() equip = new EventEmitter<AvatarStatus>();

  get unlockedCount(): number {
    return this.avatars.filter(a => a.unlocked).length;
  }

  get equipped(): AvatarStatus | null {
    return this.avatars.find(a => a.isActive) ?? null;
  }

  get sections(): { label: string; items: AvatarStatus[] }[] {
    return GROUPS
      .map(g => ({
        label: g.label,
        items: this.avatars
          .filter(a => a.unlockType === g.key)
          .sort((a, b) => a.unlockValue - b.unlockValue),
      }))
      .filter(s => s.items.length > 0);
  }

  onEquip(a: AvatarStatus): void {
    if (a.isActive || this.equipping || !a.unlocked) return;
    this.equip.emit(a);
  }
}
