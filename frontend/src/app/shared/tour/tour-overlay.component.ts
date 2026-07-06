import { Component, HostListener, signal } from '@angular/core';
import { TourService } from './tour.service';

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 2000; pointer-events: none; font-family: 'Nunito', system-ui, sans-serif; }

    @keyframes floaty { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-9px) rotate(4deg); } }
    @keyframes pop    { from { opacity: 0; transform: scale(.92) translateY(8px); } to { opacity: 1; transform: none; } }

    /* Transparent full-screen catcher blocks page interaction; tour advances via buttons. */
    .catcher { position: fixed; inset: 0; pointer-events: auto; }

    /* The lit "hole": its huge box-shadow dims everything around the target, with a lime ring. */
    .spotlight {
      position: fixed; border-radius: 14px; pointer-events: none;
      box-shadow: 0 0 0 9999px rgba(6,13,30,.74), 0 0 0 3px rgba(198,230,59,.85), 0 0 26px 4px rgba(198,230,59,.45);
      transition: top .22s ease, left .22s ease, width .22s ease, height .22s ease;
    }

    /* Unclipped wrapper so Sporty (a sibling of .panel) is never clipped by the panel shape. */
    .callout { position: fixed; width: 300px; max-width: 90vw; pointer-events: auto; }
    .panel {
      position: relative; background: #fff; color: #10203E; padding: 20px 18px 15px;
      clip-path: polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);
      box-shadow: 0 30px 60px rgba(6,13,30,.55);
      animation: pop .28s cubic-bezier(.2,.9,.3,1.2) both;
    }
    /* lime accent bar along the top edge */
    .panel::before {
      content:''; position:absolute; top:0; left:0; right:0; height:4px;
      background: linear-gradient(90deg,#C6E63B,#9ECF10);
    }

    /* Sporty pops over the top-right corner of every callout (full body, unclipped) */
    .mascot {
      position:absolute; top:-62px; right:-6px; width:88px; z-index:1; pointer-events:none;
      filter: drop-shadow(0 8px 12px rgba(0,0,0,.35)) drop-shadow(0 0 12px rgba(198,230,59,.45));
      animation: floaty 4s ease-in-out infinite;
    }

    .eyebrow {
      font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700; letter-spacing:.2em;
      color:#2E6BE6; margin:0 0 5px;
    }
    .panel h3 { margin:0 0 6px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:16.5px; color:#10203E; padding-right:62px; }
    .panel p  { margin:0 0 14px; font-size:13.5px; color:#5c6881; line-height:1.5; }

    .progress { height:5px; background:#e7edf7; border-radius:99px; overflow:hidden; margin-bottom:12px; }
    .progress-fill { height:100%; background:linear-gradient(90deg,#C6E63B,#9ECF10); border-radius:99px; box-shadow:0 0 8px rgba(198,230,59,.85); transition:width .25s ease; }

    .row { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .count { font-size:11.5px; color:#9aa6bd; font-weight:700; letter-spacing:.05em; }
    .btns { display:flex; gap:8px; }
    button {
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12.5px; cursor:pointer; border:none; padding:8px 13px;
      clip-path: polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px);
    }
    .skip { background: transparent; color:#9aa6bd; }
    .back { background:#EEF3FB; color:#5c6881; }
    .next { background: linear-gradient(150deg,#C6E63B,#9ECF10); color:#10203E; box-shadow:0 3px 0 #7c9c00; }
    .next:active { transform: translateY(1px); box-shadow:0 1px 0 #7c9c00; }
  `],
  template: `
    @if (tour.activeStep(); as active) {
      <div class="catcher"></div>
      @if (rect(); as r) {
        <div class="spotlight"
             [style.top.px]="r.top - 6" [style.left.px]="r.left - 6"
             [style.width.px]="r.width + 12" [style.height.px]="r.height + 12"></div>
      }
      <div class="callout" [style.top.px]="calloutTop()" [style.left.px]="calloutLeft()">
        <img class="mascot" src="assets/sporty_wave.png" alt="Sporty" />
        <div class="panel">
          <p class="eyebrow">SPORTY · GUIDE</p>
          <h3>{{ active.step.title }}</h3>
          <p>{{ active.step.body }}</p>
          <div class="progress"><div class="progress-fill" [style.width.%]="(active.index + 1) / active.total * 100"></div></div>
          <div class="row">
            <span class="count">{{ active.index + 1 }} / {{ active.total }}</span>
            <div class="btns">
              <button class="skip" (click)="tour.skip()">Skip</button>
              @if (!active.isFirst) { <button class="back" (click)="tour.back()">Back</button> }
              <button class="next" (click)="tour.next()">{{ active.step.nextLabel ?? 'Next' }}</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class TourOverlayComponent {
  /** Bounding rect of the current step's target, or null when off-screen. */
  readonly rect = signal<DOMRect | null>(null);
  private lastStepIndex = -1;

  constructor(public tour: TourService) {}

  ngDoCheck(): void {
    // Re-measure whenever the active step changes (cheap; runs with change detection).
    const active = this.tour.activeStep();
    const idx = active ? active.index : -1;
    if (idx !== this.lastStepIndex) {
      this.lastStepIndex = idx;
      if (active) {
        requestAnimationFrame(() => this.rect.set(this.measure(active.step.selectors)));
      } else {
        this.rect.set(null);
      }
    }
  }

  private measure(selectors: string[]): DOMRect | null {
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && el.offsetParent !== null) return el.getBoundingClientRect();
    }
    return null;
  }

  calloutTop(): number {
    const r = this.rect();
    // Keep room above the card for Sporty (who pops up ~54px).
    if (!r) return Math.max(64, window.innerHeight / 2 - 90);
    const below = r.bottom + 16;
    return below + 180 < window.innerHeight ? below : Math.max(64, r.top - 190);
  }

  calloutLeft(): number {
    const r = this.rect();
    if (!r) return Math.max(12, window.innerWidth / 2 - 150);
    return Math.min(Math.max(12, r.left), window.innerWidth - 312);
  }

  @HostListener('window:resize')
  onResize(): void {
    const active = this.tour.activeStep();
    this.rect.set(active ? this.measure(active.step.selectors) : null);
  }

  @HostListener('window:keydown.escape')
  onEsc(): void {
    if (this.tour.activeStep()) this.tour.skip();
  }
}
