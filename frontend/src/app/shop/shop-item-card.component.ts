// frontend/src/app/shop/shop-item-card.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../shared/components/icon/icon.component';

const LOCKED_FRAME = 'linear-gradient(160deg,#e3e9f2,#c1ccdb)';
const LOCKED_FRAME_SHADOW = '0 14px 24px -20px rgba(16,30,60,.4)';

@Component({
  selector: 'app-shop-item-card',
  standalone: true,
  imports: [CommonModule, IconComponent],
  styles: [`
    :host { display:block; width:100%; }
    .card {
      position:relative; border-radius:18px; padding:3px;
      transition:transform .18s, box-shadow .18s; overflow:hidden;
    }
    .card:hover { transform:translateY(-6px); }
    .holo {
      position:absolute; inset:0; z-index:4; pointer-events:none;
      background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.55) 48%, transparent 58%);
      background-size:220% 100%; animation:holoSweep 4s linear infinite;
    }
    @keyframes holoSweep { 0% { background-position:-160% 0; } 100% { background-position:260% 0; } }
    .badge {
      position:absolute; top:12px; right:12px; z-index:5;
      font-family:'Chakra Petch',sans-serif; font-size:10px; font-weight:700;
      letter-spacing:.12em; border-radius:999px; padding:4px 9px;
    }
    .inner { border-radius:15px; background:#fff; overflow:hidden; }
    .inner.locked-bg { background:#f7f9fc; }
    .art { position:relative; aspect-ratio:1; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#f5f7fb; }
    .art img { width:100%; height:100%; object-fit:cover; display:block; }
    .art img.locked-img { filter:grayscale(1) brightness(1.1) opacity(.45); }
    .art-icon { color:#2E6BE6; }
    .art-icon.locked-icon { color:#a3aec2; }
    .body { padding:12px 14px 14px; }
    .name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:16px; color:#10203E; line-height:1.1; }
    .desc { font-size:12px; color:#8592ad; margin-top:2px; }
    .extra { font-size:11px; color:#5f7a00; font-weight:700; margin-top:6px; }
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
    .need-more { display:flex; align-items:center; gap:4px; font-family:'Chakra Petch',sans-serif; font-size:11px; font-weight:700; color:#8592ad; }
    .price { display:flex; align-items:center; gap:6px; font-family:'Chakra Petch',sans-serif; font-weight:700; color:#B57C00; }
    .buy-btn {
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.05em;
      background:#C6E63B; color:#1c2a06; border:none; border-radius:10px; padding:8px 14px; cursor:pointer;
      transition:transform .1s, background .15s;
    }
    .buy-btn:hover:not(:disabled) { background:#9ECF10; }
    .buy-btn:disabled { background:#e3e9f2; color:#9aa6bd; cursor:not-allowed; }
  `],
  template: `
    <div class="card" [style.background]="resolvedFrame" [style.box-shadow]="resolvedFrameShadow">
      @if (showHolo) { <div class="holo"></div> }
      <div class="badge" [style.color]="badgeColor" [style.background]="badgeBg">{{ badgeLabel }}</div>
      <div class="inner" [class.locked-bg]="isLocked">
        <div class="art">
          @if (imagePath) {
            <img [src]="imagePath" [alt]="name" [class.locked-img]="isLocked">
          } @else if (iconName) {
            <div class="art-icon" [class.locked-icon]="isLocked"><app-icon [name]="iconName" [size]="56" /></div>
          }
        </div>
        <div class="body">
          <div class="name">{{ name }}</div>
          <div class="desc">{{ description }}</div>
          @if (extraLine) { <div class="extra">{{ extraLine }}</div> }
          <div class="footer">
            @if (owned) {
              <div class="unlocked-tag">
                <span class="check"><svg width="9" height="9" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="#1c2a06" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                OWNED
              </div>
            } @else if (affordable) {
              <div class="price"><app-icon name="coin" [size]="14" /> {{ price | number }}</div>
              <button class="buy-btn" [disabled]="buying" (click)="buy.emit()">BUY</button>
            } @else {
              <div class="locked-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="#a3aec2"/><path d="M8 11V8a4 4 0 018 0v3" stroke="#a3aec2" stroke-width="2" fill="none"/></svg>
                LOCKED
              </div>
              <div class="need-more">Need {{ shortfall | number }} <app-icon name="coin" [size]="12" /></div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ShopItemCardComponent {
  @Input({ required: true }) name!: string;
  @Input({ required: true }) description!: string;
  @Input() imagePath: string | null = null;
  @Input() iconName: string | null = null;
  @Input({ required: true }) frameGradient!: string;
  @Input({ required: true }) frameShadow!: string;
  @Input({ required: true }) badgeLabel!: string;
  @Input({ required: true }) badgeColor!: string;
  @Input({ required: true }) badgeBg!: string;
  @Input({ required: true }) price!: number;
  @Input() owned = false;
  @Input() affordable = false;
  @Input() buying = false;
  @Input() shortfall = 0;
  @Input() extraLine: string | null = null;
  @Output() buy = new EventEmitter<void>();

  get isLocked(): boolean { return !this.owned && !this.affordable; }
  get showHolo(): boolean { return !this.isLocked; }
  get resolvedFrame(): string { return this.isLocked ? LOCKED_FRAME : this.frameGradient; }
  get resolvedFrameShadow(): string { return this.isLocked ? LOCKED_FRAME_SHADOW : this.frameShadow; }
}
