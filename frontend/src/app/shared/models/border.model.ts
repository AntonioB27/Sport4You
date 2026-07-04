export interface BorderStatus {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  borderCss: string;
  imagePath: string;
  unlocked: boolean;
  unlockedAt: string | null;
  isActive: boolean;
}

export interface BoxInfo {
  pendingCount: number;
}

export interface OpenBoxResult {
  type: 'avatar' | 'border';
  rarity: 'common' | 'rare' | 'legendary';
  name: string;
  imagePath: string;
  wasDuplicate: boolean;
  duplicateXpAwarded: number;
  remainingBoxes: number;
}
