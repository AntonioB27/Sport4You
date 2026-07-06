import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-welcome-dialog',
  standalone: true,
  imports: [IconComponent],
  styles: [`
    :host { display: block; width: 100%; font-family: 'Nunito', system-ui, sans-serif; }

    @keyframes floaty { 0%,100% { transform: translateX(-50%) translateY(0) rotate(-3deg); } 50% { transform: translateX(-50%) translateY(-11px) rotate(3deg); } }
    @keyframes rise   { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes sweep  { 0% { transform: translateX(-140%); } 100% { transform: translateX(240%); } }

    .card-fx { width: 100%; filter: drop-shadow(0 50px 90px rgba(4,10,26,.72)); }
    .card {
      position: relative; width: 100%; overflow: hidden; color: #eaf1ff;
      background: radial-gradient(130% 90% at 50% -12%, rgba(46,107,230,.30), transparent 58%), #0a1730;
      clip-path: polygon(28px 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%, 0 28px);
    }
    /* faint tactical grid across the whole card */
    .card::before {
      content:''; position:absolute; inset:0; pointer-events:none; opacity:.5;
      background-image:
        linear-gradient(rgba(122,150,210,.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(122,150,210,.08) 1px, transparent 1px);
      background-size: 30px 30px;
    }
    /* lime halo bleeding down from the hero */
    .card::after {
      content:''; position:absolute; top:26%; left:50%; transform:translateX(-50%);
      width:60%; height:40%; pointer-events:none;
      background: radial-gradient(closest-side, rgba(198,230,59,.18), transparent 72%);
    }

    /* ── Hero video band ── (wrap is unclipped so Sporty can burst out) */
    .hero-wrap { position: relative; }
    .hero { position: relative; overflow: hidden; aspect-ratio: 16 / 6.4; max-height: 40vh; }
    .hero video { width:100%; height:100%; object-fit:cover; display:block; filter: saturate(1.06) contrast(1.03); }
    .hero-grid {
      position:absolute; inset:0; pointer-events:none;
      background-image:
        linear-gradient(rgba(122,150,210,.16) 1px, transparent 1px),
        linear-gradient(90deg, rgba(122,150,210,.16) 1px, transparent 1px);
      background-size: 30px 30px;
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,.7), transparent 72%);
              mask-image: linear-gradient(to bottom, rgba(0,0,0,.7), transparent 72%);
    }
    .hero::after {
      content:''; position:absolute; inset:0; pointer-events:none;
      background: linear-gradient(to top, #0a1730 3%, rgba(10,23,48,.25) 46%, transparent 78%);
    }
    .scanline {
      position:absolute; top:0; bottom:0; width:32%; pointer-events:none;
      background: linear-gradient(90deg, transparent, rgba(198,230,59,.10), transparent);
      animation: sweep 6s ease-in-out infinite;
    }

    /* Sporty bursts out of the video into the content (sibling of .hero, so not clipped) */
    .sporty {
      position:absolute; left:50%; bottom:-34px; transform:translateX(-50%);
      width: clamp(124px, 17vw, 158px); z-index:4;
      filter: drop-shadow(0 16px 22px rgba(0,0,0,.55)) drop-shadow(0 0 20px rgba(198,230,59,.4));
      animation: floaty 4.6s ease-in-out infinite;
    }

    /* ── Content ── */
    .content { position:relative; z-index:2; padding: 58px clamp(22px,5vw,52px) 34px; text-align:center; }
    .eyebrow {
      font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; letter-spacing:.3em;
      color:#C6E63B; margin-bottom:12px; text-shadow: 0 0 14px rgba(198,230,59,.5);
      opacity:0; animation: rise .5s ease .05s forwards;
    }
    .title {
      font-family:'Chakra Petch',sans-serif; font-weight:700; margin:0 0 14px;
      font-size: clamp(26px, 5vw, 44px); letter-spacing:.02em; color:#fff; line-height:1.04;
      opacity:0; animation: rise .6s ease .13s forwards;
    }
    .title span { color:#C6E63B; text-shadow: 0 0 24px rgba(198,230,59,.65); }
    .lead {
      font-size: clamp(13.5px,1.5vw,15.5px); color:#a9bbdd; line-height:1.62; max-width:600px; margin:0 auto;
      opacity:0; animation: rise .6s ease .21s forwards;
    }
    .lead strong { color:#eaf1ff; font-weight:700; }

    .pillars {
      display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin:26px auto 2px; max-width:660px;
      opacity:0; animation: rise .6s ease .3s forwards;
    }
    .pillar {
      flex:1 1 165px; max-width:200px; padding:16px 14px;
      background: linear-gradient(180deg, rgba(34,56,102,.72), rgba(18,34,66,.72));
      box-shadow: inset 0 0 0 1px rgba(122,150,210,.22);
      clip-path: polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px);
      display:flex; flex-direction:column; align-items:center; gap:9px;
    }
    .pillar .ic { color:#C6E63B; display:flex; filter: drop-shadow(0 0 8px rgba(198,230,59,.55)); }
    .pillar .pt { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.14em; color:#fff; }
    .pillar .ps { font-size:11.5px; color:#8ea3c9; line-height:1.4; }

    .cta {
      margin-top:28px; border:none; cursor:pointer;
      background: linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E;
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; letter-spacing:.06em;
      padding:15px 42px; box-shadow: 0 6px 0 #7c9c00, 0 0 30px rgba(198,230,59,.4);
      clip-path: polygon(13px 0,100% 0,100% calc(100% - 13px),calc(100% - 13px) 100%,0 100%,0 13px);
      transition: transform .1s, box-shadow .1s; opacity:0; animation: rise .6s ease .42s forwards;
    }
    .cta:hover  { transform: translateY(-2px); box-shadow: 0 8px 0 #7c9c00, 0 0 36px rgba(198,230,59,.65); }
    .cta:active { transform: translateY(2px);  box-shadow: 0 3px 0 #7c9c00; }
  `],
  template: `
    <div class="card-fx">
      <div class="card">
        <div class="hero-wrap">
          <div class="hero">
            <video autoplay muted loop playsinline poster="assets/sporty_wave.png">
              <source src="assets/sporty_hero.mp4" type="video/mp4" />
            </video>
            <div class="hero-grid"></div>
            <div class="scanline"></div>
          </div>
          <img class="sporty" src="assets/sporty_wave.png" alt="Sporty the mascot" />
        </div>

        <div class="content">
          <div class="eyebrow">MISSION BRIEFING</div>
          <h1 class="title">WELCOME TO SPORT<span>4</span>YOU</h1>
          <p class="lead">
            I’m <strong>Sporty</strong> — your coach. Log workouts across
            <strong>running, cycling, swimming, gym & daily steps</strong>, and we’ll fold them
            into one fair <strong>points</strong> score that ranks you on a live global leaderboard.
          </p>

          <div class="pillars">
            <div class="pillar">
              <span class="ic"><app-icon name="sneaker" [size]="26" /></span>
              <span class="pt">TRACK</span>
              <span class="ps">Every run, ride, swim, set & step</span>
            </div>
            <div class="pillar">
              <span class="ic"><app-icon name="trophy" [size]="26" /></span>
              <span class="pt">COMPETE</span>
              <span class="ps">Climb the global leaderboard</span>
            </div>
            <div class="pillar">
              <span class="ic"><app-icon name="package" [size]="26" /></span>
              <span class="pt">UNLOCK</span>
              <span class="ps">Loot boxes, avatars & badges</span>
            </div>
          </div>

          <button class="cta" (click)="close()">Let’s go →</button>
        </div>
      </div>
    </div>
  `,
})
export class WelcomeDialogComponent {
  constructor(private dialogRef: MatDialogRef<WelcomeDialogComponent>) {}

  close() {
    this.dialogRef.close();
  }
}
