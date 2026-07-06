# Shop Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Shop page's visuals to match the Achievements page's "game world" identity (dark HUD bar, gradient hero spotlight with holographic sweep, rarity-coded gradient card frames), reusing the exact color/gradient values so rarity coding is consistent across the whole app.

**Architecture:** A new small presentational `ShopItemCardComponent` (mirroring the existing `AchievementCardComponent` pattern — a dumb, input-driven card) replaces the current plain `.card` divs for all three item kinds (booster, loot boxes, avatars). `ShopComponent` is rewritten to wrap its content in the same `.panel`/`.hud`/`.spotlight`/`.section` structure the Achievements page already uses, computing a rarity→frame/badge lookup keyed by shop data (`avatar.rarity`, loot box `tier`) instead of achievement tier, and passing the resolved values into the new card component.

**Tech Stack:** Angular 17 standalone components, no new dependencies. Frontend-only — no backend or model changes.

## Global Constraints

- Presentation-layer only: no changes to `ShopCatalog`/`ShopAvatar` models, `ApiService`, or any backend code.
- No new purchase flows, no new item types, no new API calls — `buyBooster()`, `buyLootBox()`, `buyAvatar()`, and `load()` keep their exact existing signatures and behavior from the current `shop.component.ts`.
- All colors/gradients are copied verbatim from `frontend/src/app/achievements/achievements.component.ts`'s `TIER_META`/`LOCKED_FRAME`/`.panel`/`.hud`/`.spotlight`/`.section`/`.feats-grid` block — this is a direct visual port, not a new design.
- The hero spotlight always features the Special Loot Box (static, not rotating).
- Loot box rarity-frame mapping: `tier: "normal"` → the `common` frame/badge, `tier: "special"` → the `legendary` frame/badge (matches their odds skew).
- The XP Booster is not rarity-tiered — it gets its own lime gradient frame (`linear-gradient(160deg,#C6E63B,#9ECF10)`) and a "POWER-UP" badge instead of a rarity word.
- No shared cross-page "themed shell" component — each page keeps owning its own inline styles, per this codebase's existing convention.
- No frontend test runner or Playwright/e2e config exists in this repo — verification is `ng build` (clean compile) plus manual browser confirmation.

---

### Task 1: `ShopItemCardComponent`

**Files:**
- Create: `frontend/src/app/shop/shop-item-card.component.ts`

**Interfaces:**
- Produces: `ShopItemCardComponent` — a standalone Angular component, selector `app-shop-item-card`, with inputs `name: string`, `description: string`, `imagePath: string | null`, `iconName: string | null`, `frameGradient: string`, `frameShadow: string`, `badgeLabel: string`, `badgeColor: string`, `badgeBg: string`, `price: number`, `owned: boolean`, `affordable: boolean`, `buying: boolean`, `shortfall: number`, `extraLine: string | null`, and output `buy: EventEmitter<void>`. Consumed by Task 2.

- [ ] **Step 1: Create the component file**

Create `frontend/src/app/shop/shop-item-card.component.ts`:

```typescript
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx ng build`
Expected: SUCCESS. `ShopItemCardComponent` is not imported anywhere yet, so this only confirms the new file itself is syntactically and type-valid — Angular's build will still succeed even though nothing references it yet (unused standalone components don't cause build errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/shop/shop-item-card.component.ts
git commit -m "feat: add reusable ShopItemCardComponent with rarity-frame styling"
```

---

### Task 2: Redesign `ShopComponent` to use the new HUD/spotlight/card visual language

**Files:**
- Modify: `frontend/src/app/shop/shop.component.ts` (full rewrite of `styles`/`template`; `ShopComponent` class keeps its existing `catalog`/`loading`/`buying` state and `load()`/`buyBooster()`/`buyLootBox()`/`buyAvatar()` methods unchanged, with new getters/helpers added)

**Interfaces:**
- Consumes: `ShopItemCardComponent` (Task 1) — inputs/output as defined above. `ShopCatalog`/`ShopAvatar`/`ShopLootBox` models (already existing, unchanged) from `frontend/src/app/shared/models/shop.model.ts`.
- Produces: the redesigned `ShopComponent` — no new public interface, this is the final task in the plan.

- [ ] **Step 1: Replace the entire file content**

Replace the full contents of `frontend/src/app/shop/shop.component.ts` with:

```typescript
// frontend/src/app/shop/shop.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../shared/services/api.service';
import { IconComponent } from '../shared/components/icon/icon.component';
import { ShopItemCardComponent } from './shop-item-card.component';
import { ShopCatalog, ShopAvatar, ShopLootBox } from '../shared/models/shop.model';

interface CardMeta {
  frame: string;
  frameShadow: string;
  badgeLabel: string;
  badgeColor: string;
  badgeBg: string;
}

const RARITY_META: Record<'common' | 'rare' | 'legendary', CardMeta> = {
  common: {
    frame: 'linear-gradient(160deg,#F5D3A3,#CD7F32 55%,#8A4F16)',
    frameShadow: '0 18px 30px -20px rgba(205,127,50,.6)',
    badgeLabel: 'COMMON', badgeColor: '#fff', badgeBg: 'rgba(138,79,22,.9)',
  },
  rare: {
    frame: 'linear-gradient(160deg,#F2F5FA,#C6CFDE 55%,#93A1B7)',
    frameShadow: '0 18px 30px -20px rgba(120,140,170,.55)',
    badgeLabel: 'RARE', badgeColor: '#fff', badgeBg: 'rgba(90,105,130,.9)',
  },
  legendary: {
    frame: 'linear-gradient(160deg,#FDE9A7,#F5B300 50%,#B57C00)',
    frameShadow: '0 18px 30px -18px rgba(245,179,0,.5)',
    badgeLabel: 'LEGENDARY', badgeColor: '#7a5200', badgeBg: 'rgba(255,255,255,.85)',
  },
};

const BOOSTER_META: CardMeta = {
  frame: 'linear-gradient(160deg,#C6E63B,#9ECF10)',
  frameShadow: '0 18px 30px -20px rgba(158,207,16,.6)',
  badgeLabel: 'POWER-UP', badgeColor: '#1c2a06', badgeBg: 'rgba(255,255,255,.85)',
};

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, IconComponent, ShopItemCardComponent],
  styles: [`
    .page { padding:26px 30px 60px; font-family:'Nunito',system-ui,sans-serif; max-width:1240px; margin:0 auto; }
    .spinner-wrap { display:flex; justify-content:center; padding:80px; }

    .panel {
      border-radius:26px; overflow:hidden; background:#EEF3FB;
      border:1px solid #dbe4f2; box-shadow:0 40px 90px -46px rgba(16,30,60,.55);
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
      width:42px; height:42px; border-radius:12px; color:#0f1e3b;
      background:linear-gradient(150deg,#C6E63B,#9ECF10);
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 8px 18px -8px rgba(158,207,16,.9);
    }
    .hud-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:22px; color:#fff; letter-spacing:.14em; }
    .hud-sub { font-size:12px; color:#9db3dd; font-weight:700; }
    .hud-right { display:flex; align-items:center; gap:12px; }
    .hud-count {
      display:flex; align-items:center; gap:10px; background:rgba(255,255,255,.08);
      border:1px solid rgba(198,230,59,.4); border-radius:999px; padding:9px 18px;
      color:#C6E63B;
    }
    .hud-count-n { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:20px; color:#C6E63B; }

    .content { padding:26px 30px 34px; }

    /* ── Spotlight ── */
    .spotlight {
      display:grid; grid-template-columns:300px 1fr; border-radius:20px; overflow:hidden;
      margin-bottom:30px; background:linear-gradient(135deg,#2E6BE6,#173B92);
      box-shadow:0 26px 50px -24px rgba(30,79,184,.7); position:relative;
    }
    .spotlight-sweep {
      position:absolute; inset:0; pointer-events:none;
      background:linear-gradient(115deg, transparent 30%, rgba(255,255,255,.22) 46%, transparent 60%);
      background-size:220% 100%; animation:holoSweepPage 4.5s linear infinite;
    }
    @keyframes holoSweepPage { 0% { background-position:-160% 0; } 100% { background-position:260% 0; } }
    .spotlight-art { position:relative; padding:22px; display:flex; align-items:center; justify-content:center; }
    .spotlight-art-circle {
      width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,.12);
      display:flex; align-items:center; justify-content:center; color:#fff;
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
      border:none; cursor:pointer; transition:background .15s;
    }
    .spotlight-xp:hover:not(:disabled) { background:#9ECF10; }
    .spotlight-xp:disabled { background:#c8d6f0; color:#5c6881; cursor:not-allowed; }
    .spotlight-info { font-family:'Chakra Petch',sans-serif; font-size:13px; color:#a9c1ee; font-weight:700; }

    /* ── Section header ── */
    .section { margin-bottom:34px; }
    .section:last-child { margin-bottom:0; }
    .section-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
    .section-title { font-family:'Chakra Petch',sans-serif; font-size:15px; font-weight:700; letter-spacing:.18em; color:#10203E; }
    .section-count {
      font-family:'Chakra Petch',sans-serif; font-size:12px; font-weight:700; color:#8592ad;
      background:#fff; border:1px solid #E3EAF5; border-radius:999px; padding:3px 11px;
    }

    /* ── Item grid ── */
    .feats-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:18px; }

    @media (max-width: 900px) {
      .spotlight { grid-template-columns:1fr; }
    }
  `],
  template: `
    <div class="page">
      @if (loading) {
        <div class="spinner-wrap"><mat-spinner diameter="36"></mat-spinner></div>
      } @else if (catalog; as catalog) {
        <div class="panel">
          <!-- HUD -->
          <div class="hud">
            <div class="hud-left">
              <div class="hud-star"><app-icon name="coin" [size]="22" /></div>
              <div>
                <div class="hud-title">SHOP</div>
                <div class="hud-sub">Spend coins earned from every activity you log</div>
              </div>
            </div>
            <div class="hud-right">
              <div class="hud-count">
                <app-icon name="coin" [size]="18" />
                <span class="hud-count-n">{{ catalog.coins | number }}</span>
              </div>
            </div>
          </div>

          <div class="content">
            <!-- Featured Special Loot Box spotlight -->
            @if (special(catalog); as sp) {
              <div class="spotlight">
                <div class="spotlight-sweep"></div>
                <div class="spotlight-art">
                  <div class="spotlight-art-circle"><app-icon name="package" [size]="72" /></div>
                </div>
                <div class="spotlight-body">
                  <div class="spotlight-chip">✦ FEATURED</div>
                  <div class="spotlight-tier">SPECIAL LOOT BOX</div>
                  <div class="spotlight-name">Better Odds, Guaranteed</div>
                  <div class="spotlight-desc">
                    {{ sp.commonPct }}% common · {{ sp.rarePct }}% rare · {{ sp.legendaryPct }}% legendary — the same reward pool, better odds.
                  </div>
                  <div class="spotlight-meta">
                    <button class="spotlight-xp" [disabled]="buying || catalog.coins < sp.price" (click)="buyLootBox('special')">
                      BUY — {{ sp.price | number }}
                    </button>
                    <div class="spotlight-info">Rolls from the same avatar/border pool as every other box</div>
                  </div>
                </div>
              </div>
            }

            <!-- XP Booster -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">XP BOOSTER</div>
              </div>
              <div class="feats-grid">
                <app-shop-item-card
                  [name]="boosterName(catalog)"
                  description="Boosts your next {{ catalog.booster.boostedActivities }} logged activities."
                  [imagePath]="null"
                  iconName="lightning"
                  [frameGradient]="boosterMeta.frame"
                  [frameShadow]="boosterMeta.frameShadow"
                  [badgeLabel]="boosterMeta.badgeLabel"
                  [badgeColor]="boosterMeta.badgeColor"
                  [badgeBg]="boosterMeta.badgeBg"
                  [price]="catalog.booster.price"
                  [owned]="false"
                  [affordable]="catalog.coins >= catalog.booster.price"
                  [buying]="buying"
                  [shortfall]="shortfall(catalog, catalog.booster.price)"
                  [extraLine]="boosterActiveLine(catalog)"
                  (buy)="buyBooster()">
                </app-shop-item-card>
              </div>
            </div>

            <!-- Loot Boxes -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">LOOT BOXES</div>
                <div class="section-count">{{ catalog.lootBoxes.length }}</div>
              </div>
              <div class="feats-grid">
                @for (box of catalog.lootBoxes; track box.tier) {
                  <app-shop-item-card
                    [name]="box.tier === 'special' ? 'Special Loot Box' : 'Normal Loot Box'"
                    description="{{ box.commonPct }}% common · {{ box.rarePct }}% rare · {{ box.legendaryPct }}% legendary"
                    [imagePath]="null"
                    iconName="package"
                    [frameGradient]="lootBoxMeta(box).frame"
                    [frameShadow]="lootBoxMeta(box).frameShadow"
                    [badgeLabel]="lootBoxMeta(box).badgeLabel"
                    [badgeColor]="lootBoxMeta(box).badgeColor"
                    [badgeBg]="lootBoxMeta(box).badgeBg"
                    [price]="box.price"
                    [owned]="false"
                    [affordable]="catalog.coins >= box.price"
                    [buying]="buying"
                    [shortfall]="shortfall(catalog, box.price)"
                    (buy)="buyLootBox(box.tier)">
                  </app-shop-item-card>
                }
              </div>
            </div>

            <!-- Avatars -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">AVATARS</div>
                <div class="section-count">{{ catalog.avatars.length }}</div>
              </div>
              <div class="feats-grid">
                @for (avatar of catalog.avatars; track avatar.id) {
                  <app-shop-item-card
                    [name]="avatar.name"
                    [description]="avatar.description"
                    [imagePath]="avatar.imagePath"
                    [iconName]="null"
                    [frameGradient]="RARITY_META[avatar.rarity].frame"
                    [frameShadow]="RARITY_META[avatar.rarity].frameShadow"
                    [badgeLabel]="RARITY_META[avatar.rarity].badgeLabel"
                    [badgeColor]="RARITY_META[avatar.rarity].badgeColor"
                    [badgeBg]="RARITY_META[avatar.rarity].badgeBg"
                    [price]="avatar.price"
                    [owned]="avatar.owned"
                    [affordable]="catalog.coins >= avatar.price"
                    [buying]="buying"
                    [shortfall]="shortfall(catalog, avatar.price)"
                    (buy)="buyAvatar(avatar)">
                  </app-shop-item-card>
                }
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ShopComponent implements OnInit {
  catalog: ShopCatalog | null = null;
  loading = true;
  buying = false;

  readonly RARITY_META = RARITY_META;
  readonly boosterMeta = BOOSTER_META;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load();
  }

  special(catalog: ShopCatalog): ShopLootBox | undefined {
    return catalog.lootBoxes.find(b => b.tier === 'special');
  }

  lootBoxMeta(box: ShopLootBox): CardMeta {
    return RARITY_META[box.tier === 'special' ? 'legendary' : 'common'];
  }

  boosterName(catalog: ShopCatalog): string {
    const pct = Math.round((catalog.booster.multiplier - 1) * 100);
    return `+${pct}% XP Booster`;
  }

  boosterActiveLine(catalog: ShopCatalog): string | null {
    return catalog.boostedActivitiesRemaining > 0
      ? `Active — ${catalog.boostedActivitiesRemaining} boosted activities left`
      : null;
  }

  shortfall(catalog: ShopCatalog, price: number): number {
    return Math.max(0, price - catalog.coins);
  }

  private load() {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }
    this.loading = true;
    this.api.getShop(userId).subscribe({
      next: (catalog) => { this.catalog = catalog; this.loading = false; },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load shop', '', { duration: 2500 });
      },
    });
  }

  buyBooster() {
    const userId = localStorage.getItem('userId');
    if (!userId || this.buying) return;
    this.buying = true;
    this.api.purchaseBooster(userId).subscribe({
      next: (result) => {
        this.buying = false;
        if (result.success) {
          this.snackBar.open('XP Booster purchased!', '', { duration: 2500, panelClass: 's4y-toast' });
          this.load();
        } else {
          this.snackBar.open(result.error ?? 'Purchase failed', '', { duration: 2500 });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.buying = false;
        this.snackBar.open(err.error?.error ?? 'Purchase failed', '', { duration: 2500 });
        this.load();
      },
    });
  }

  buyLootBox(tier: 'normal' | 'special') {
    const userId = localStorage.getItem('userId');
    if (!userId || this.buying) return;
    this.buying = true;
    this.api.purchaseLootBox(userId, tier).subscribe({
      next: (result) => {
        this.buying = false;
        if (result.success) {
          this.snackBar.open('Loot box purchased! Open it from your dashboard.', '', { duration: 3000, panelClass: 's4y-toast' });
          this.load();
        } else {
          this.snackBar.open(result.error ?? 'Purchase failed', '', { duration: 2500 });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.buying = false;
        this.snackBar.open(err.error?.error ?? 'Purchase failed', '', { duration: 2500 });
        this.load();
      },
    });
  }

  buyAvatar(avatar: ShopAvatar) {
    const userId = localStorage.getItem('userId');
    if (!userId || this.buying || avatar.owned) return;
    this.buying = true;
    this.api.purchaseShopAvatar(userId, avatar.id).subscribe({
      next: (result) => {
        this.buying = false;
        if (result.success) {
          this.snackBar.open(`${avatar.name} unlocked!`, '', { duration: 2500, panelClass: 's4y-toast' });
          this.load();
        } else {
          this.snackBar.open(result.error ?? 'Purchase failed', '', { duration: 2500 });
        }
      },
      error: (err: HttpErrorResponse) => {
        this.buying = false;
        this.snackBar.open(err.error?.error ?? 'Purchase failed', '', { duration: 2500 });
        this.load();
      },
    });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx ng build`
Expected: SUCCESS. If TypeScript complains about `RARITY_META[avatar.rarity]` indexing (since `avatar.rarity` is typed as `'common' | 'rare' | 'legendary'` in `shop.model.ts`, this should index cleanly — if it doesn't, confirm `ShopAvatar.rarity`'s type in `frontend/src/app/shared/models/shop.model.ts` matches exactly, and adjust the `RARITY_META` key type to match rather than casting).

- [ ] **Step 3: Manual browser verification**

With both dev servers running (`dotnet run` in `backend/Sport4You.Api`, `npx ng serve` in `frontend`, restarting the Angular dev server if it was already running, since this task doesn't add new asset folders but does add a new component file — a restart avoids any stale-build confusion): log in, navigate to `/shop`, and confirm:
- The dark HUD bar renders at the top with "SHOP" + tagline on the left, coin balance pill on the right.
- The blue gradient spotlight banner renders below the HUD, always showing the Special Loot Box with its odds and a working "BUY — 1000" button (disabled if coins < 1000).
- All three sections (XP BOOSTER, LOOT BOXES, AVATARS) render their items as gradient-framed cards with the holographic sweep animation.
- Avatar cards show the correct rarity-colored frame (common=bronze, rare=silver, legendary=gold) matching the same colors as the Achievements page's bronze/silver/gold cards.
- Loot box cards show bronze framing for Normal and gold framing for Special.
- The XP Booster card shows the distinct lime "POWER-UP" frame, not a rarity color.
- An avatar you can't yet afford shows the greyed-out locked frame and "Need N 🪙" instead of a buy button; an owned avatar shows the lime "OWNED" checkmark tag instead of a buy button.
- Buying any item still works end-to-end (balance updates, owned/afford states refresh) exactly as before this redesign — this task changed no purchase logic.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/shop/shop.component.ts
git commit -m "feat: redesign Shop page with Achievements-style HUD, spotlight, and rarity-framed cards"
```

---

## Self-Review Notes

- **Spec coverage:** Page shell/HUD (Task 2, HUD block), hero spotlight banner (Task 2, spotlight block), section styling (Task 2, section/feats-grid blocks), card treatments including rarity mapping, booster's distinct frame, and owned/affordable/locked states (Task 1's `ShopItemCardComponent` + Task 2's per-item-kind meta lookups), and the new `ShopItemCardComponent` extraction (Task 1) are all covered. Testing section's manual-verification approach matches the spec's stated testing section (no automated frontend tests in this repo).
- **Type consistency:** `ShopItemCardComponent`'s inputs (Task 1) are used with matching names and types at every call site in Task 2's template (`frameGradient`, `frameShadow`, `badgeLabel`, `badgeColor`, `badgeBg`, `price`, `owned`, `affordable`, `buying`, `shortfall`, `extraLine`, `imagePath`, `iconName`, `buy` output). `CardMeta` interface is defined once in Task 2's file and used consistently for `RARITY_META`/`BOOSTER_META`/`lootBoxMeta()`'s return type.
- **Scope check:** Two tasks, one new focused component and one full-file page rewrite that consumes it — appropriately sized as a single plan for a presentation-only redesign with no backend/model surface.
