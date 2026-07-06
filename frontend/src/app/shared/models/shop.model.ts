// frontend/src/app/shared/models/shop.model.ts
export interface ShopBooster {
  price: number;
  boostedActivities: number;
  multiplier: number;
}

export interface ShopLootBox {
  tier: 'normal' | 'special';
  price: number;
  commonPct: number;
  rarePct: number;
  legendaryPct: number;
}

export interface ShopAvatar {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  rarity: 'common' | 'rare' | 'legendary';
  price: number;
  owned: boolean;
}

export interface ShopCatalog {
  coins: number;
  boostedActivitiesRemaining: number;
  booster: ShopBooster;
  lootBoxes: ShopLootBox[];
  avatars: ShopAvatar[];
}

export interface BoosterPurchaseResult {
  success: boolean;
  error: string | null;
  coins: number;
  boostedActivitiesRemaining: number;
}

export interface LootBoxPurchaseResult {
  success: boolean;
  error: string | null;
  coins: number;
  pendingBoxes: number;
}

export interface AvatarPurchaseResult {
  success: boolean;
  error: string | null;
  coins: number;
}
