import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../shared/services/api.service';
import { ShopAvatar } from '../shared/models/shop.model';

export interface PurchaseModalData {
  kind: 'avatar' | 'booster' | 'lootbox';
  userId: string;
  title: string;
  subtitle: string;
  /** Present only for kind === 'avatar' (image, rarity, equip). */
  avatar?: ShopAvatar;
}

@Component({
  selector: 'app-purchase-confirm-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  styles: [`
    .card {
      width: 340px; max-width: 100%; padding: 26px 24px 22px; text-align: center;
      font-family: 'Nunito', system-ui, sans-serif;
      background: radial-gradient(120% 80% at 50% -10%, #23407e, #0f1e3b 78%);
      border-radius: 22px; color: #fff; position: relative; overflow: hidden;
    }
    .glow { position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(closest-side at 50% 22%, rgba(198,230,59,.22), transparent 62%); }
    .eyebrow { position: relative; font-family: 'Chakra Petch', sans-serif; font-size: 11px; font-weight: 700;
      letter-spacing: .22em; color: #C6E63B; margin-bottom: 14px; }
    .art-ring {
      position: relative; width: 148px; height: 148px; margin: 0 auto; border-radius: 50%; padding: 5px;
      background: linear-gradient(150deg,#C6E63B,#2E6BE6);
      box-shadow: 0 0 0 6px rgba(255,255,255,.08), 0 18px 34px -16px rgba(0,0,0,.6);
      animation: pop .45s cubic-bezier(.2,1.3,.35,1);
    }
    @keyframes pop { 0% { transform: scale(.6); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    .art-ring img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; object-position: 50% 18%; background: #12213f; }
    .art-emoji {
      position: relative; width: 128px; height: 128px; margin: 0 auto; border-radius: 28px;
      display: flex; align-items: center; justify-content: center; font-size: 64px;
      background: linear-gradient(160deg, rgba(255,255,255,.14), rgba(255,255,255,.04));
      border: 1px solid rgba(255,255,255,.14); box-shadow: 0 18px 34px -16px rgba(0,0,0,.6);
      animation: pop .45s cubic-bezier(.2,1.3,.35,1);
    }
    .name { position: relative; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 21px; margin-top: 16px; }
    .rarity { position: relative; display: inline-block; margin-top: 8px; font-family: 'Chakra Petch', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: .12em; padding: 3px 10px; border-radius: 999px; color: #10203E; }
    .rarity.common { background: #C7D0DE; }
    .rarity.rare { background: #6FB4FF; }
    .rarity.legendary { background: linear-gradient(150deg,#FFE066,#F5B301); }
    .desc { position: relative; font-size: 12.5px; color: #bcd2ff; margin-top: 10px; line-height: 1.4; }
    .btns { position: relative; display: flex; gap: 10px; margin-top: 20px; }
    .btn { flex: 1; border: none; cursor: pointer; border-radius: 12px; padding: 13px;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: .05em; }
    .btn.equip { background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E; box-shadow: 0 4px 0 #7c9c00; }
    .btn.equip:disabled { opacity: .6; }
    .btn.later { background: rgba(255,255,255,.1); color: #dbe8ff; border: 1px solid rgba(255,255,255,.22); }
  `],
  template: `
    <div class="card">
      <div class="glow"></div>
      <div class="eyebrow">✦ PURCHASED</div>

      @if (data.avatar; as av) {
        <div class="art-ring"><img [src]="av.imagePath" [alt]="av.name"></div>
        <div class="name">{{ av.name }}</div>
        <div class="rarity" [class]="av.rarity">{{ av.rarity.toUpperCase() }}</div>
        <div class="desc">{{ av.description }}</div>
        <div class="btns">
          <button class="btn equip" (click)="equip()" [disabled]="equipping || equipped">
            {{ equipped ? '✓ EQUIPPED' : (equipping ? 'EQUIPPING…' : 'EQUIP NOW') }}
          </button>
          <button class="btn later" (click)="close()">{{ equipped ? 'DONE' : 'MAYBE LATER' }}</button>
        </div>
      } @else {
        <div class="art-emoji">{{ data.kind === 'booster' ? '⚡' : '📦' }}</div>
        <div class="name">{{ data.title }}</div>
        <div class="desc">{{ data.subtitle }}</div>
        <div class="btns">
          @if (data.kind === 'lootbox') {
            <button class="btn equip" (click)="openBox()">OPEN NOW</button>
            <button class="btn later" (click)="close()">LATER</button>
          } @else {
            <button class="btn equip" (click)="close()">NICE!</button>
          }
        </div>
      }
    </div>
  `,
})
export class PurchaseConfirmModalComponent {
  equipping = false;
  equipped = false;

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private ref: MatDialogRef<PurchaseConfirmModalComponent, 'open' | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: PurchaseModalData,
  ) {}

  equip(): void {
    const av = this.data.avatar;
    if (!av || this.equipping || this.equipped) return;
    this.equipping = true;
    this.api.setActiveAvatar(this.data.userId, av.id).subscribe({
      next: () => {
        this.equipping = false;
        this.equipped = true;
        this.snackBar.open(`${av.name} equipped!`, '', { duration: 2500, panelClass: 's4y-toast' });
      },
      error: () => {
        this.equipping = false;
        this.snackBar.open('Failed to equip. Please try again.', '', { duration: 2500 });
      },
    });
  }

  /** Signal the shop to launch the loot-box opening modal. */
  openBox(): void { this.ref.close('open'); }

  close(): void { this.ref.close(); }
}
