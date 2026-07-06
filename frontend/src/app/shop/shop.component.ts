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
    badgeLabel: 'COMMON', badgeColor: '#5c6881', badgeBg: 'rgba(255,255,255,.92)',
  },
  rare: {
    frame: 'linear-gradient(160deg,#F2F5FA,#C6CFDE 55%,#93A1B7)',
    frameShadow: '0 18px 30px -20px rgba(120,140,170,.55)',
    badgeLabel: 'RARE', badgeColor: '#fff', badgeBg: 'rgba(46,107,230,.92)',
  },
  legendary: {
    frame: 'linear-gradient(160deg,#FDE9A7,#F5B300 50%,#B57C00)',
    frameShadow: '0 18px 30px -18px rgba(245,179,0,.5)',
    badgeLabel: 'LEGENDARY', badgeColor: '#4a3400', badgeBg: 'rgba(245,179,0,.92)',
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
    .spotlight-art-img {
      width:200px; height:200px; object-fit:contain;
      filter:drop-shadow(0 14px 26px rgba(0,0,0,.4));
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
      } @else if (catalog) {
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
                  <img class="spotlight-art-img" src="assets/shop/lootbox-special.png" alt="Special Loot Box">
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
                  imagePath="assets/shop/xp-booster.png"
                  [iconName]="null"
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
                    [imagePath]="lootBoxImage(box)"
                    [iconName]="null"
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

  lootBoxImage(box: ShopLootBox): string {
    return box.tier === 'special' ? 'assets/shop/lootbox-special.png' : 'assets/shop/lootbox-normal.png';
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
