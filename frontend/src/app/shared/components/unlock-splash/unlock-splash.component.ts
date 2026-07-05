import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UnlockedAchievement, UnlockedAvatar } from '../../models/dashboard.model';
import { achievementIconPath } from '../../utils/achievement-icon';

@Component({
  selector: 'app-unlock-splash',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { position:absolute; inset:0; display:block; pointer-events:none; z-index:50; }
    :host ::ng-deep .splash, .splash { pointer-events:auto; }

    @keyframes s4y-conf { 0%{transform:translateY(-14px) rotate(0);opacity:0} 15%{opacity:1} 100%{transform:translateY(360px) rotate(420deg);opacity:0} }

    /* unlock splash (achievements + avatars) */
    .splash {
      position:absolute; inset:0; border-radius:34px; z-index:50;
      overflow:hidden; display:flex; flex-direction:column; justify-content:flex-end;
      background:#0e1a34;
    }
    .splash-art {
      position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
      animation:s4y-kenburns 8s ease-out both;
    }
    @keyframes s4y-kenburns { from { transform:scale(1); } to { transform:scale(1.12); } }
    .splash-wash { position:absolute; inset:0; }
    .splash-wash.bronze { background:linear-gradient(180deg, transparent 38%, rgba(74,42,10,.82) 72%, rgba(46,24,4,.97)); }
    .splash-wash.silver { background:linear-gradient(180deg, transparent 38%, rgba(42,52,70,.82) 72%, rgba(20,28,42,.97)); }
    .splash-wash.gold   { background:linear-gradient(180deg, transparent 38%, rgba(96,62,0,.82) 72%, rgba(58,36,0,.97)); }
    .splash-wash.blue   { background:linear-gradient(180deg, transparent 38%, rgba(23,59,146,.82) 72%, rgba(12,30,74,.97)); }
    .splash-flash { position:absolute; inset:0; z-index:60; pointer-events:none; animation:s4y-flash .4s ease-out both; }
    .splash-flash.bronze { background:#F5D3A3; }
    .splash-flash.silver { background:#E8EEF7; }
    .splash-flash.gold   { background:#FDE9A7; }
    .splash-flash.blue   { background:#9db3dd; }
    @keyframes s4y-flash { from { opacity:.9; } to { opacity:0; } }
    .splash-shimmer {
      position:absolute; inset:0; z-index:55; pointer-events:none;
      background:linear-gradient(115deg, transparent 35%, rgba(255,255,255,.4) 48%, transparent 60%);
      background-size:220% 100%; animation:s4y-shimmer 1.6s ease-out .3s both;
    }
    @keyframes s4y-shimmer { from { background-position:220% 0; } to { background-position:-120% 0; } }
    .splash-content { position:relative; z-index:58; padding:0 30px 28px; }
    .splash-item { animation:s4y-rise .5s cubic-bezier(.2,.7,.3,1) both; }
    @keyframes s4y-rise { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
    .splash-tag { font-family:'Chakra Petch',sans-serif; font-size:11px; letter-spacing:.28em; font-weight:700; color:#C6E63B; text-shadow:0 0 14px rgba(198,230,59,.6); margin-bottom:8px; }
    .splash-tier { font-family:'Chakra Petch',sans-serif; font-size:12px; letter-spacing:.24em; font-weight:700; margin-bottom:6px; }
    .splash-tier.bronze { color:#F5D3A3; }
    .splash-tier.silver { color:#dfe7f2; }
    .splash-tier.gold   { color:#FDE9A7; }
    .splash-name { font-family:'Chakra Petch',sans-serif; font-size:32px; font-weight:700; color:#fff; line-height:1.05; margin-bottom:6px; text-shadow:0 4px 18px rgba(0,0,0,.5); }
    .splash-desc { font-family:'Nunito',sans-serif; font-size:14px; color:rgba(255,255,255,.85); margin-bottom:10px; max-width:300px; }
    .splash-xp { font-family:'Chakra Petch',sans-serif; font-size:22px; font-weight:700; color:#C6E63B; letter-spacing:.05em; margin-bottom:16px; text-shadow:0 0 16px rgba(198,230,59,.5); }
    .splash-confetti { position:absolute; border-radius:2px; z-index:57; }
    .ach-next  {
      background:linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px;
      letter-spacing:.05em; padding:13px 34px; border-radius:14px;
      cursor:pointer; border:none; box-shadow:0 6px 0 #7c9c00;
      transition:transform .1s, box-shadow .1s;
    }
    .ach-next:active { transform:translateY(3px); box-shadow:0 3px 0 #7c9c00; }
  `],
  template: `
    <!-- Achievement unlock splash (queued) -->
    @for (ach of currentAchievement ? [currentAchievement] : []; track ach.id) {
    <div class="splash">
      <img class="splash-art" [src]="achievementArt(ach)" [alt]="ach.name">
      <div class="splash-wash" [class]="ach.tier"></div>
      @if (ach.tier === 'gold') { <div class="splash-shimmer"></div> }
      <div class="splash-flash" [class]="ach.tier"></div>
      <div class="splash-confetti" style="left:14%;top:8%;width:11px;height:11px;background:#C6E63B;animation:s4y-conf 2.4s ease-in infinite;"></div>
      <div class="splash-confetti" style="left:38%;top:5%;width:10px;height:10px;background:#FFD54A;border-radius:50%;animation:s4y-conf 2.9s ease-in .3s infinite;"></div>
      <div class="splash-confetti" style="left:62%;top:7%;width:12px;height:12px;background:#fff;animation:s4y-conf 2.2s ease-in .5s infinite;"></div>
      <div class="splash-confetti" style="left:84%;top:11%;width:10px;height:10px;background:#C6E63B;border-radius:50%;animation:s4y-conf 3.1s ease-in .1s infinite;"></div>
      <div class="splash-confetti" style="left:26%;top:4%;width:9px;height:9px;background:#FFD54A;animation:s4y-conf 2.6s ease-in .7s infinite;"></div>
      <div class="splash-content">
        <div class="splash-item splash-tag" style="animation-delay:.15s">ACHIEVEMENT UNLOCKED</div>
        <div class="splash-item splash-tier" [class]="ach.tier" style="animation-delay:.23s">
          {{ ach.tier.toUpperCase() }} · {{ rarityLabel(ach.tier) }}
        </div>
        <div class="splash-item splash-name" style="animation-delay:.31s">{{ ach.name }}</div>
        <div class="splash-item splash-desc" style="animation-delay:.39s">{{ ach.description }}</div>
        <div class="splash-item splash-xp" style="animation-delay:.47s">+{{ displayedXp }} XP</div>
        <button class="splash-item ach-next" style="animation-delay:.55s" (click)="nextAchievement()">
          {{ achievementQueue.length > 0 ? 'NEXT →' : 'AWESOME!' }}
        </button>
      </div>
    </div>
    }

    <!-- Avatar unlock splash (after achievements) -->
    @for (av of currentAvatar ? [currentAvatar] : []; track av.id) {
    <div class="splash">
      <img class="splash-art" [src]="av.imagePath" [alt]="av.name">
      <div class="splash-wash blue"></div>
      <div class="splash-flash blue"></div>
      <div class="splash-confetti" style="left:14%;top:8%;width:11px;height:11px;background:#C6E63B;animation:s4y-conf 2.4s ease-in infinite;"></div>
      <div class="splash-confetti" style="left:38%;top:5%;width:10px;height:10px;background:#FFD54A;border-radius:50%;animation:s4y-conf 2.9s ease-in .3s infinite;"></div>
      <div class="splash-confetti" style="left:62%;top:7%;width:12px;height:12px;background:#fff;animation:s4y-conf 2.2s ease-in .5s infinite;"></div>
      <div class="splash-content">
        <div class="splash-item splash-tag" style="animation-delay:.15s">AVATAR UNLOCKED</div>
        <div class="splash-item splash-name" style="animation-delay:.23s">{{ av.name }}</div>
        <div class="splash-item splash-desc" style="animation-delay:.31s">{{ av.description }}</div>
        <button class="splash-item ach-next" style="animation-delay:.39s" (click)="nextAvatar()">
          {{ avatarQueue.length > 0 ? 'NEXT →' : 'NICE!' }}
        </button>
      </div>
    </div>
    }
  `,
})
export class UnlockSplashComponent implements OnChanges {
  @Input() achievements: UnlockedAchievement[] = [];
  @Input() avatars: UnlockedAvatar[] = [];
  @Output() finished = new EventEmitter<void>();

  currentAchievement: UnlockedAchievement | null = null;
  achievementQueue: UnlockedAchievement[] = [];
  currentAvatar: UnlockedAvatar | null = null;
  avatarQueue: UnlockedAvatar[] = [];
  displayedXp = 0;

  private xpRaf = 0;

  ngOnChanges(_: SimpleChanges): void {
    const achievements = this.achievements ?? [];
    const avatars = this.avatars ?? [];
    if (achievements.length > 0) {
      this.currentAchievement = achievements[0];
      this.achievementQueue = achievements.slice(1);
      this.avatarQueue = avatars;          // shown after achievements dismissed
      this.startXpTicker(achievements[0].xpReward);
    } else if (avatars.length > 0) {
      this.currentAvatar = avatars[0];
      this.avatarQueue = avatars.slice(1);
    } else {
      this.finished.emit();
    }
  }

  nextAchievement(): void {
    this.currentAchievement = this.achievementQueue.shift() ?? null;
    if (this.currentAchievement) {
      this.startXpTicker(this.currentAchievement.xpReward);
    } else if (this.avatarQueue.length > 0) {
      this.currentAvatar = this.avatarQueue.shift() ?? null;
    } else {
      this.finished.emit();
    }
  }

  nextAvatar(): void {
    this.currentAvatar = this.avatarQueue.shift() ?? null;
    if (!this.currentAvatar) this.finished.emit();
  }

  rarityLabel(tier: string): string {
    return { bronze: 'COMMON', silver: 'RARE', gold: 'LEGENDARY' }[tier] ?? '';
  }

  achievementArt(a: UnlockedAchievement): string {
    return achievementIconPath(a);
  }

  private startXpTicker(target: number): void {
    cancelAnimationFrame(this.xpRaf);
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      this.displayedXp = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) this.xpRaf = requestAnimationFrame(tick);
    };
    this.xpRaf = requestAnimationFrame(tick);
  }
}
