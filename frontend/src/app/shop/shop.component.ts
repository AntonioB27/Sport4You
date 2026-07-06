// frontend/src/app/shop/shop.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { IconComponent } from '../shared/components/icon/icon.component';
import { ShopCatalog, ShopAvatar } from '../shared/models/shop.model';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatSnackBarModule, IconComponent],
  styles: [`
    .page { max-width: 960px; margin: 0 auto; padding: 24px; }
    .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:24px; color:#10203E; }
    .balance { display:flex; align-items:center; gap:8px; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:20px; color:#B57C00; }
    .section-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:14px; letter-spacing:.1em; color:#8592ad; margin: 28px 0 12px; }
    .cards { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:16px; }
    .card {
      background:#fff; border-radius:16px; padding:16px; border:1px solid #eef2f8;
      display:flex; flex-direction:column; gap:10px;
    }
    .card-art { width:100%; aspect-ratio:1; border-radius:12px; overflow:hidden; background:#f5f7fb; }
    .card-art img { width:100%; height:100%; object-fit:cover; display:block; }
    .card-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; color:#10203E; }
    .card-desc { font-size:12px; color:#8592ad; }
    .card-rarity {
      align-self:flex-start; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:10px;
      letter-spacing:.1em; padding:3px 8px; border-radius:999px;
    }
    .card-rarity.common { color:#5c6881; background:#eef2f8; }
    .card-rarity.rare { color:#7E8A9C; background:#F2F5FA; }
    .card-rarity.legendary { color:#B57C00; background:#FBF3DC; }
    .card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:auto; }
    .price { display:flex; align-items:center; gap:6px; font-family:'Chakra Petch',sans-serif; font-weight:700; color:#B57C00; }
    .buy-btn {
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:12px; letter-spacing:.05em;
      background:#2E6BE6; color:#fff; border:none; border-radius:10px; padding:9px 14px; cursor:pointer;
      transition:transform .1s, background .15s;
    }
    .buy-btn:hover:not(:disabled) { background:#1B47AE; }
    .buy-btn:disabled { background:#e3e9f2; color:#9aa6bd; cursor:not-allowed; }
    .odds { font-size:11px; color:#8592ad; }
    .spinner-wrap { display:flex; justify-content:center; padding:60px 0; }
  `],
  template: `
    <div class="page">
      <div class="spinner-wrap" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
      </div>

      <ng-container *ngIf="!loading && catalog">
        <div class="header">
          <div class="title">SHOP</div>
          <div class="balance"><app-icon name="coin" [size]="22" /> {{ catalog.coins | number }}</div>
        </div>

        <div class="section-title">XP BOOSTER</div>
        <div class="cards">
          <div class="card">
            <div class="card-name">+{{ ((catalog.booster.multiplier - 1) * 100).toFixed(0) }}% XP Booster</div>
            <div class="card-desc">Boosts your next {{ catalog.booster.boostedActivities }} logged activities.</div>
            <div class="odds" *ngIf="catalog.boostedActivitiesRemaining > 0">
              Active — {{ catalog.boostedActivitiesRemaining }} boosted activities left
            </div>
            <div class="card-footer">
              <div class="price"><app-icon name="coin" [size]="16" /> {{ catalog.booster.price | number }}</div>
              <button class="buy-btn" [disabled]="buying || catalog.coins < catalog.booster.price"
                      (click)="buyBooster()">BUY</button>
            </div>
          </div>
        </div>

        <div class="section-title">LOOT BOXES</div>
        <div class="cards">
          <div class="card" *ngFor="let box of catalog.lootBoxes">
            <div class="card-name">{{ box.tier === 'special' ? 'Special' : 'Normal' }} Loot Box</div>
            <div class="odds">{{ box.commonPct }}% common · {{ box.rarePct }}% rare · {{ box.legendaryPct }}% legendary</div>
            <div class="card-footer">
              <div class="price"><app-icon name="coin" [size]="16" /> {{ box.price | number }}</div>
              <button class="buy-btn" [disabled]="buying || catalog.coins < box.price"
                      (click)="buyLootBox(box.tier)">BUY</button>
            </div>
          </div>
        </div>

        <div class="section-title">AVATARS</div>
        <div class="cards">
          <div class="card" *ngFor="let avatar of catalog.avatars">
            <div class="card-art"><img [src]="avatar.imagePath" [alt]="avatar.name" /></div>
            <div class="card-rarity" [class]="avatar.rarity">{{ avatar.rarity.toUpperCase() }}</div>
            <div class="card-name">{{ avatar.name }}</div>
            <div class="card-desc">{{ avatar.description }}</div>
            <div class="card-footer">
              <div class="price"><app-icon name="coin" [size]="16" /> {{ avatar.price | number }}</div>
              <button class="buy-btn" [disabled]="buying || avatar.owned || catalog.coins < avatar.price"
                      (click)="buyAvatar(avatar)">{{ avatar.owned ? 'OWNED' : 'BUY' }}</button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
})
export class ShopComponent implements OnInit {
  catalog: ShopCatalog | null = null;
  loading = true;
  buying = false;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.load();
  }

  private load() {
    const userId = localStorage.getItem('userId');
    if (!userId) { this.loading = false; return; }
    this.loading = true;
    this.api.getShop(userId).subscribe({
      next: (catalog) => { this.catalog = catalog; this.loading = false; },
      error: () => { this.loading = false; },
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
      error: () => { this.buying = false; },
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
      error: () => { this.buying = false; },
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
      error: () => { this.buying = false; },
    });
  }
}
