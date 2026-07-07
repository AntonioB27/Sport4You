# Trophy Track, Shop & Locker Mobile Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Achievements, Shop, and Avatars (Locker) pages real `<768px` mobile layouts (mockups 1a/1c/1e) with the filter-chip / segmented-tab interactions the mockups introduce, without touching desktop behavior or the backend.

**Architecture:** Each page gets a second, CSS-gated template block (`.mobile-view`, hidden above 768px) alongside the existing markup (wrapped in `.desktop-view`, hidden below 768px) — the same pattern `app.component.ts` already uses to swap the sidebar for the bottom nav. New interactive state (active tier/category/segment/group) is plain component fields + getters, no `BreakpointObserver`, no new HTTP calls.

**Tech Stack:** Angular 17+ standalone components, inline templates/styles, Jasmine/Karma specs (`ng test`).

## Global Constraints

- No backend changes — `ShopController`, `AchievementsController`, avatar/border endpoints are untouched.
- No changes to desktop layout or interactions for any of the three pages.
- No changes to the bottom nav in `app.component.ts` — it already matches the mockups.
- Breakpoint is `767px`/`768px`, matching the existing `@media (max-width: 768px)` in `app.component.ts`.
- Only mockups 1a (Achievements), 1c (Shop), 1e (Locker) are being built — not 1b/1d/1f.
- No `BreakpointObserver` or JS resize listeners — all mobile/desktop switching is CSS `display:none`.

---

### Task 1: Achievements mobile filter chips + grid (1a)

**Files:**
- Modify: `frontend/src/app/achievements/achievements.component.ts`
- Test: Create `frontend/src/app/achievements/achievements.component.spec.ts`

**Interfaces:**
- Consumes: `AchievementStatus` (from `../shared/models/dashboard.model`), the existing `SECTIONS`/`sections`, `oneTimeFeats`, `sectionAchievements()` already on `AchievementsComponent`.
- Produces: `ONE_TIME_LABEL` (exported const string `'One-Time Feats'`), `AchievementsComponent.activeTier: 'all' | 'bronze' | 'silver' | 'gold'`, `.activeCategory: string | null`, `.mobileCategories: string[]`, `.mobileFiltered: AchievementStatus[]`, `.setTier(tier)`, `.setCategory(category)` — no other task depends on these.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/app/achievements/achievements.component.spec.ts`:

```ts
import { AchievementsComponent, ONE_TIME_LABEL } from './achievements.component';
import { AchievementStatus } from '../shared/models/dashboard.model';

function makeAchievements(): AchievementStatus[] {
  return [
    { id: 'run-b', tier: 'bronze', name: 'First Strides', description: 'Run 10km', xpReward: 50,
      requirementType: 'total_km', unlocked: true, unlockedAt: '2026-06-01', sport: 'running',
      requirementValue: 10, progress: 32, ownedByPercent: 80 },
    { id: 'run-g', tier: 'gold', name: 'Marathoner', description: 'Run 100km', xpReward: 300,
      requirementType: 'total_km', unlocked: false, unlockedAt: null, sport: 'running',
      requirementValue: 100, progress: 32, ownedByPercent: 5 },
    { id: 'steps-b', tier: 'bronze', name: 'First Steps', description: '10k steps', xpReward: 50,
      requirementType: 'total_steps', unlocked: true, unlockedAt: '2026-06-02', sport: null,
      requirementValue: 10000, progress: 12000, ownedByPercent: 70 },
    { id: 'first-activity', tier: 'bronze', name: 'Getting Started', description: 'Log your first activity',
      xpReward: 20, requirementType: 'first_activity', unlocked: true, unlockedAt: '2026-05-01',
      sport: null, requirementValue: 1, progress: 1, ownedByPercent: 99 },
  ];
}

describe('AchievementsComponent mobile filtering', () => {
  let component: AchievementsComponent;

  beforeEach(() => {
    component = new AchievementsComponent({} as any);
    component.achievements = makeAchievements();
  });

  it('defaults to all tiers and all categories', () => {
    expect(component.activeTier).toBe('all');
    expect(component.activeCategory).toBeNull();
    expect(component.mobileFiltered.map(a => a.id).sort()).toEqual(
      ['first-activity', 'run-b', 'run-g', 'steps-b']
    );
  });

  it('filters to the matching section when a category chip is set', () => {
    component.setCategory('Sport Distance Milestones');
    expect(component.mobileFiltered.map(a => a.id).sort()).toEqual(['run-b', 'run-g']);
  });

  it('filters to one-time feats via the sentinel category', () => {
    component.setCategory(ONE_TIME_LABEL);
    expect(component.mobileFiltered.map(a => a.id)).toEqual(['first-activity']);
  });

  it('combines category and tier filters', () => {
    component.setCategory('Sport Distance Milestones');
    component.setTier('gold');
    expect(component.mobileFiltered.map(a => a.id)).toEqual(['run-g']);
  });

  it('toggles a category off when clicked twice', () => {
    component.setCategory('Sport Distance Milestones');
    component.setCategory('Sport Distance Milestones');
    expect(component.activeCategory).toBeNull();
  });

  it('lists section labels plus the one-time sentinel', () => {
    expect(component.mobileCategories).toContain('Sport Distance Milestones');
    expect(component.mobileCategories).toContain(ONE_TIME_LABEL);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx ng test --include='**/achievements.component.spec.ts' --watch=false`
Expected: FAIL — `ONE_TIME_LABEL` / `mobileFiltered` / `setTier` / `setCategory` do not exist on `AchievementsComponent`.

- [ ] **Step 3: Add the filtering fields, getters, and methods**

In `frontend/src/app/achievements/achievements.component.ts`, after the line `const TIER_ORDER = ['bronze', 'silver', 'gold'];` add:

```ts
export const ONE_TIME_LABEL = 'One-Time Feats';
```

Inside `export class AchievementsComponent` (after the existing `sections = SECTIONS;` field), add:

```ts
  activeTier: 'all' | 'bronze' | 'silver' | 'gold' = 'all';
  activeCategory: string | null = null;
  readonly ONE_TIME_LABEL = ONE_TIME_LABEL;

  get mobileCategories(): string[] {
    return [...this.sections.map(s => s.label), ONE_TIME_LABEL];
  }

  get mobileFiltered(): AchievementStatus[] {
    let list: AchievementStatus[];
    if (this.activeCategory === ONE_TIME_LABEL) {
      list = this.oneTimeFeats;
    } else if (this.activeCategory) {
      const section = this.sections.find(s => s.label === this.activeCategory);
      list = section ? this.sectionAchievements(section) : this.achievements;
    } else {
      list = this.achievements;
    }
    return this.activeTier === 'all' ? list : list.filter(a => a.tier === this.activeTier);
  }

  setTier(tier: 'all' | 'bronze' | 'silver' | 'gold'): void {
    this.activeTier = tier;
  }

  setCategory(category: string | null): void {
    this.activeCategory = this.activeCategory === category ? null : category;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx ng test --include='**/achievements.component.spec.ts' --watch=false`
Expected: PASS — all 6 specs green.

- [ ] **Step 5: Add the mobile CSS**

In `achievements.component.ts`, inside the `AchievementsComponent`'s `styles: []` array, find this existing block near the end:

```
    @media (max-width: 900px) {
      .spotlight { grid-template-columns:1fr; }
      .rail { flex-wrap:wrap; }
      .connector { min-width:100%; flex-basis:100%; }
    }
  `],
```

Replace it with:

```
    @media (max-width: 900px) {
      .spotlight { grid-template-columns:1fr; }
      .rail { flex-wrap:wrap; }
      .connector { min-width:100%; flex-basis:100%; }
    }

    /* ── Mobile layout (1a) ── */
    .mobile-view { display:none; }
    @media (max-width: 767px) {
      .desktop-view { display:none; }
      .mobile-view { display:block; }
    }
    .mobile-hud {
      position:sticky; top:0; z-index:10; padding:14px 18px 12px;
      background:linear-gradient(120deg,#12245090,#0e1a34 70%),
                 radial-gradient(120% 160% at 100% 0%, rgba(46,107,230,.55), transparent), #0f1e3b;
    }
    .mobile-hud-row { display:flex; align-items:center; justify-content:space-between; }
    .mobile-hud-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:16px; color:#fff; letter-spacing:.08em; }
    .mobile-hud-count { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; color:#C6E63B; }
    .chip-row { display:flex; gap:7px; overflow-x:auto; padding:10px 4px 2px; }
    .chip {
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; letter-spacing:.04em;
      border-radius:999px; padding:7px 13px; flex:0 0 auto; cursor:pointer; border:1px solid transparent;
      background:#fff; color:#5c6881; white-space:nowrap;
    }
    .chip.active { background:#2E6BE6; color:#fff; }
    .mobile-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; padding:14px; }
    .mobile-empty { padding:40px 20px; text-align:center; color:#8592ad; font-size:13px; }
  `],
```

- [ ] **Step 6: Add the mobile template and wrap the desktop template**

In the same file's `template: \`` string, find:

```
      } @else {
        <div class="panel-fx">
        <div class="panel">
          <!-- HUD -->
```

Replace it with:

```
      } @else {
        <div class="mobile-view">
          <div class="mobile-hud">
            <div class="mobile-hud-row">
              <div class="mobile-hud-title">TROPHY TRACK</div>
              <div class="mobile-hud-count">{{ unlockedCount }} / {{ achievements.length }}</div>
            </div>
            <div class="chip-row">
              <div class="chip" [class.active]="activeTier === 'all'" (click)="setTier('all')">ALL</div>
              <div class="chip" [class.active]="activeTier === 'bronze'" (click)="setTier('bronze')">BRONZE</div>
              <div class="chip" [class.active]="activeTier === 'silver'" (click)="setTier('silver')">SILVER</div>
              <div class="chip" [class.active]="activeTier === 'gold'" (click)="setTier('gold')">GOLD</div>
            </div>
            <div class="chip-row">
              @for (cat of mobileCategories; track cat) {
                <div class="chip" [class.active]="activeCategory === cat" (click)="setCategory(cat)">{{ cat }}</div>
              }
            </div>
          </div>
          @if (mobileFiltered.length === 0) {
            <div class="mobile-empty">No badges match this filter yet.</div>
          } @else {
            <div class="mobile-grid">
              @for (a of mobileFiltered; track a.id) {
                <app-achievement-card [a]="a"></app-achievement-card>
              }
            </div>
          }
        </div>

        <div class="desktop-view">
        <div class="panel-fx">
        <div class="panel">
          <!-- HUD -->
```

Then find the closing of that same `@else` block:

```
        </div>
        </div>
      }
    </div>
  `,
```

Replace it with:

```
        </div>
        </div>
        </div>
      }
    </div>
  `,
```

- [ ] **Step 7: Manually verify in the browser**

Run: `cd frontend && npm start`, open `http://localhost:4200/achievements` in Chrome DevTools device mode at 390×844 (iPhone 12/13). Confirm: sticky tier + category chips appear, tapping a chip filters the grid, desktop rails are not present below 768px, and widening the window past 768px shows the original rails/spotlight layout with no chips.

- [ ] **Step 8: Run the full frontend test suite**

Run: `cd frontend && npx ng test --watch=false`
Expected: PASS, no regressions in other specs.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/achievements/achievements.component.ts frontend/src/app/achievements/achievements.component.spec.ts
git commit -m "feat: add mobile filter-chip layout to Trophy Track (1a)"
```

---

### Task 2: Shop mobile segmented tabs (1c)

**Files:**
- Modify: `frontend/src/app/shop/shop.component.ts`
- Test: Create `frontend/src/app/shop/shop.component.spec.ts`

**Interfaces:**
- Consumes: `ShopCatalog`, `ShopAvatar`, `ShopLootBox` (from `../shared/models/shop.model`), existing `ShopComponent` methods `special()`, `lootBoxMeta()`, `lootBoxImage()`, `boosterName()`, `boosterActiveLine()`, `shortfall()`, `RARITY_META`, `boosterMeta`.
- Produces: `ShopComponent.activeSegment: 'boosters' | 'boxes' | 'avatars'`, `.setSegment(segment)` — no other task depends on these.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/app/shop/shop.component.spec.ts`:

```ts
import { ShopComponent } from './shop.component';

describe('ShopComponent mobile segment', () => {
  let component: ShopComponent;

  beforeEach(() => {
    component = new ShopComponent({} as any, {} as any, {} as any);
  });

  it('defaults to the boosters segment', () => {
    expect(component.activeSegment).toBe('boosters');
  });

  it('switches segments', () => {
    component.setSegment('avatars');
    expect(component.activeSegment).toBe('avatars');
    component.setSegment('boxes');
    expect(component.activeSegment).toBe('boxes');
    component.setSegment('boosters');
    expect(component.activeSegment).toBe('boosters');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx ng test --include='**/shop.component.spec.ts' --watch=false`
Expected: FAIL — `activeSegment` / `setSegment` do not exist on `ShopComponent`.

- [ ] **Step 3: Add the segment field and method**

In `frontend/src/app/shop/shop.component.ts`, inside `export class ShopComponent`, after `buying = false;` add:

```ts
  activeSegment: 'boosters' | 'boxes' | 'avatars' = 'boosters';

  setSegment(segment: 'boosters' | 'boxes' | 'avatars'): void {
    this.activeSegment = segment;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx ng test --include='**/shop.component.spec.ts' --watch=false`
Expected: PASS — both specs green.

- [ ] **Step 5: Extract the three item grids into `ng-template`s**

In the same file's `template: \`` string, find:

```
            <!-- XP Booster -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">XP BOOSTER</div>
              </div>
              <div class="feats-grid">
                <app-shop-item-card
```

Replace it with (this adds three `ng-template`s right before the existing sections, and changes the existing three `.feats-grid` blocks to use them via `ngTemplateOutlet` — do the three grid-body replacements described in Step 6 immediately after this):

```
            <ng-template #boosterGrid>
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
            </ng-template>
            <ng-template #boxesGrid>
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
            </ng-template>
            <ng-template #avatarsGrid>
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
            </ng-template>

            <!-- XP Booster -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">XP BOOSTER</div>
              </div>
              <ng-container *ngTemplateOutlet="boosterGrid"></ng-container>
            </div>
```

- [ ] **Step 6: Point the remaining two desktop sections at the new templates**

Find:

```
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
```

Replace it with:

```
            <!-- Loot Boxes -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">LOOT BOXES</div>
                <div class="section-count">{{ catalog.lootBoxes.length }}</div>
              </div>
              <ng-container *ngTemplateOutlet="boxesGrid"></ng-container>
            </div>

            <!-- Avatars -->
            <div class="section">
              <div class="section-header">
                <div class="section-title">AVATARS</div>
                <div class="section-count">{{ catalog.avatars.length }}</div>
              </div>
              <ng-container *ngTemplateOutlet="avatarsGrid"></ng-container>
            </div>
```

- [ ] **Step 7: Add the mobile CSS**

In the `styles: []` array, find:

```
    @media (max-width: 900px) {
      .spotlight { grid-template-columns:1fr; }
    }
  `],
```

Replace it with:

```
    @media (max-width: 900px) {
      .spotlight { grid-template-columns:1fr; }
    }

    /* ── Mobile layout (1c) ── */
    .mobile-view { display:none; }
    @media (max-width: 767px) {
      .desktop-view { display:none; }
      .mobile-view { display:block; }
    }
    .mobile-hud {
      position:sticky; top:0; z-index:10; padding:14px 18px 12px;
      background:linear-gradient(120deg,#12245090,#0e1a34 70%),
                 radial-gradient(120% 160% at 100% 0%, rgba(46,107,230,.55), transparent), #0f1e3b;
    }
    .mobile-hud-row { display:flex; align-items:center; justify-content:space-between; }
    .mobile-hud-title { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:16px; color:#fff; letter-spacing:.08em; }
    .mobile-hud-count { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:13px; color:#C6E63B; }
    .mobile-spotlight {
      margin:14px; padding:14px 16px; border-radius:14px;
      background:linear-gradient(135deg,#F5B300,#B57C00); color:#3a2800;
    }
    .mobile-spotlight-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:15px; }
    .mobile-spotlight-desc { font-size:11px; margin:4px 0 9px; font-weight:600; }
    .mobile-spotlight-buy {
      background:#0f1e3b; color:#C6E63B; border:none; font-family:'Chakra Petch',sans-serif;
      font-weight:700; font-size:12px; padding:7px 13px; border-radius:9px; cursor:pointer;
    }
    .mobile-spotlight-buy:disabled { opacity:.5; cursor:not-allowed; }
    .segmented { display:flex; background:#e2e9f4; border-radius:12px; padding:4px; gap:3px; margin:0 14px 14px; }
    .segment {
      flex:1; text-align:center; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px;
      letter-spacing:.04em; color:#8592ad; padding:9px 0; border-radius:9px; cursor:pointer;
    }
    .segment.active { color:#fff; background:#2E6BE6; }
    .mobile-section-body { padding:0 14px 20px; }
    .mobile-section-body .feats-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  `],
```

- [ ] **Step 8: Add the mobile template and wrap the desktop template**

Find:

```
      } @else if (catalog) {
        <div class="panel-fx">
        <div class="panel">
          <!-- HUD -->
```

Replace it with:

```
      } @else if (catalog) {
        <div class="mobile-view">
          <div class="mobile-hud">
            <div class="mobile-hud-row">
              <div class="mobile-hud-title">SHOP</div>
              <div class="mobile-hud-count">{{ catalog.coins | number }} coins</div>
            </div>
          </div>
          @if (special(catalog); as sp) {
            <div class="mobile-spotlight">
              <div class="mobile-spotlight-name">Better Odds, Guaranteed</div>
              <div class="mobile-spotlight-desc">{{ sp.commonPct }}% common · {{ sp.rarePct }}% rare · {{ sp.legendaryPct }}% legendary</div>
              <button class="mobile-spotlight-buy" [disabled]="buying || catalog.coins < sp.price" (click)="buyLootBox('special')">BUY — {{ sp.price | number }}</button>
            </div>
          }
          <div class="segmented">
            <div class="segment" [class.active]="activeSegment === 'boosters'" (click)="setSegment('boosters')">BOOSTERS</div>
            <div class="segment" [class.active]="activeSegment === 'boxes'" (click)="setSegment('boxes')">BOXES</div>
            <div class="segment" [class.active]="activeSegment === 'avatars'" (click)="setSegment('avatars')">AVATARS</div>
          </div>
          <div class="mobile-section-body">
            @switch (activeSegment) {
              @case ('boosters') { <ng-container *ngTemplateOutlet="boosterGrid"></ng-container> }
              @case ('boxes') { <ng-container *ngTemplateOutlet="boxesGrid"></ng-container> }
              @case ('avatars') { <ng-container *ngTemplateOutlet="avatarsGrid"></ng-container> }
            }
          </div>
        </div>

        <div class="desktop-view">
        <div class="panel-fx">
        <div class="panel">
          <!-- HUD -->
```

Then find the closing of that `@else if` block:

```
        </div>
        </div>
      }
    </div>
  `,
```

Replace it with:

```
        </div>
        </div>
        </div>
      }
    </div>
  `,
```

- [ ] **Step 9: Manually verify in the browser**

Run: `cd frontend && npm start`, open `http://localhost:4200/shop` in Chrome DevTools device mode at 390×844. Confirm: the spotlight box and segmented control appear, switching segments swaps the grid, buying still works (uses the same `app-shop-item-card` instances via the outlets), and widening past 768px restores the original three-stacked-sections layout.

- [ ] **Step 10: Run the full frontend test suite**

Run: `cd frontend && npx ng test --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/app/shop/shop.component.ts frontend/src/app/shop/shop.component.spec.ts
git commit -m "feat: add mobile segmented-tab layout to Shop (1c)"
```

---

### Task 3: Locker mobile compact header + category chips + Avatars/Borders toggle (1e)

**Files:**
- Modify: `frontend/src/app/profile/avatar-locker.component.ts`
- Modify: `frontend/src/app/avatars/avatars-page.component.ts`
- Test: Create `frontend/src/app/profile/avatar-locker.component.spec.ts`
- Test: Create `frontend/src/app/avatars/avatars-page.component.spec.ts`

**Interfaces:**
- Consumes: `AvatarStatus` (from `../shared/models/dashboard.model`), `BorderStatus` (from `../shared/models/border.model`), existing `AvatarLockerComponent.sections` getter, existing `AvatarsPageComponent.avatars`/`.borders`/`.sortedBorders`.
- Produces: `AvatarLockerComponent.activeGroup: string | null`, `.mobileSections: {label; items}[]`, `.setGroup(label)`; `AvatarsPageComponent.activeView: 'avatars' | 'borders'`, `.setView(view)`, `.equippedAvatar: AvatarStatus | null` — no other task depends on these.

- [ ] **Step 1: Write the failing test for `AvatarLockerComponent`**

Create `frontend/src/app/profile/avatar-locker.component.spec.ts`:

```ts
import { AvatarLockerComponent } from './avatar-locker.component';
import { AvatarStatus } from '../shared/models/dashboard.model';

function makeAvatars(): AvatarStatus[] {
  return [
    { id: 'a1', name: 'Starter Sporty', description: 'Default', imagePath: 'a1.png',
      unlockType: 'default', unlockValue: 0, unlocked: true, unlockedAt: '2026-01-01', isActive: true },
    { id: 'a2', name: 'Athletic Sporty', description: 'Reach level 10', imagePath: 'a2.png',
      unlockType: 'level_reached', unlockValue: 10, unlocked: true, unlockedAt: '2026-02-01', isActive: false },
    { id: 'a3', name: 'Elite Sporty', description: 'Reach level 20', imagePath: 'a3.png',
      unlockType: 'level_reached', unlockValue: 20, unlocked: false, unlockedAt: null, isActive: false },
  ];
}

describe('AvatarLockerComponent mobile grouping', () => {
  let component: AvatarLockerComponent;

  beforeEach(() => {
    component = new AvatarLockerComponent();
    component.avatars = makeAvatars();
  });

  it('shows every non-empty group by default', () => {
    expect(component.activeGroup).toBeNull();
    expect(component.mobileSections.map(s => s.label)).toEqual(['STARTER', 'LEVEL UP']);
  });

  it('filters to a single group when set', () => {
    component.setGroup('LEVEL UP');
    expect(component.mobileSections.map(s => s.label)).toEqual(['LEVEL UP']);
    expect(component.mobileSections[0].items.map(a => a.id)).toEqual(['a2', 'a3']);
  });

  it('toggles a group off when clicked twice', () => {
    component.setGroup('LEVEL UP');
    component.setGroup('LEVEL UP');
    expect(component.activeGroup).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx ng test --include='**/avatar-locker.component.spec.ts' --watch=false`
Expected: FAIL — `activeGroup` / `mobileSections` / `setGroup` do not exist on `AvatarLockerComponent`.

- [ ] **Step 3: Add the grouping field, getter, and method**

In `frontend/src/app/profile/avatar-locker.component.ts`, inside `export class AvatarLockerComponent`, after `@Output() equip = new EventEmitter<AvatarStatus>();` add:

```ts
  activeGroup: string | null = null;

  get mobileSections(): { label: string; items: AvatarStatus[] }[] {
    return this.activeGroup ? this.sections.filter(s => s.label === this.activeGroup) : this.sections;
  }

  setGroup(label: string | null): void {
    this.activeGroup = this.activeGroup === label ? null : label;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx ng test --include='**/avatar-locker.component.spec.ts' --watch=false`
Expected: PASS — all 3 specs green.

- [ ] **Step 5: Add the mobile CSS**

In the same file's `styles: []` array, find:

```
    .body { padding: 28px 30px 32px; display: grid; grid-template-columns: 300px 1fr; gap: 26px; }
    @media (max-width: 900px) { .body { grid-template-columns: 1fr; } }
```

Replace it with:

```
    .body { padding: 28px 30px 32px; display: grid; grid-template-columns: 300px 1fr; gap: 26px; }
    @media (max-width: 900px) { .body { grid-template-columns: 1fr; } }

    /* ── Mobile layout (1e) ── */
    .mobile-view { display:none; }
    @media (max-width: 767px) {
      .desktop-view { display:none; }
      .mobile-view { display:block; }
    }
    .mobile-mini-hud {
      display:flex; align-items:center; gap:13px; padding:14px 18px 16px;
      background:linear-gradient(120deg,#12245090,#0e1a34 70%),
                 radial-gradient(120% 160% at 100% 0%, rgba(46,107,230,.55), transparent), #0f1e3b;
    }
    .mobile-mini-avatar {
      width:52px; height:52px; flex:0 0 auto; border-radius:50%; overflow:hidden;
      background:linear-gradient(165deg,#F1F6FF,#D6E4FB); box-shadow:0 0 0 3px rgba(198,230,59,.6);
    }
    .mobile-mini-avatar img { width:100%; height:100%; object-fit:cover; object-position:50% 22%; }
    .mobile-mini-name { font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:16px; color:#fff; }
    .mobile-mini-sub { font-size:11px; color:#9db3dd; font-weight:700; margin-top:2px; }
    .mobile-chip-row { display:flex; gap:7px; overflow-x:auto; padding:12px 18px 4px; }
    .mobile-chip {
      font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px; letter-spacing:.04em;
      border-radius:999px; padding:6px 12px; flex:0 0 auto; cursor:pointer; white-space:nowrap;
      background:#fff; border:1px solid #e3eaf5; color:#5c6881;
    }
    .mobile-chip.active { background:#EAF1FF; border-color:transparent; color:#2E6BE6; }
    .mobile-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px 10px; padding:14px 18px 20px; }
```

- [ ] **Step 6: Add the mobile template and wrap the desktop template**

In the `template: \`` string, find:

```
    <div class="panel-fx">
    <div class="panel">
      <div class="hud">
```

Replace it with:

```
    <div class="mobile-view">
      @for (eq of equipped ? [equipped] : []; track eq.id) {
        <div class="mobile-mini-hud">
          <div class="mobile-mini-avatar"><img [src]="eq.imagePath" [alt]="eq.name"></div>
          <div>
            <div class="mobile-mini-name">{{ eq.name }}</div>
            <div class="mobile-mini-sub">{{ unlockedCount }} / {{ avatars.length }} lockers open</div>
          </div>
        </div>
      } @empty {
        <div class="mobile-mini-hud">
          <div class="mobile-mini-avatar"></div>
          <div>
            <div class="mobile-mini-name">No avatar equipped</div>
            <div class="mobile-mini-sub">{{ unlockedCount }} / {{ avatars.length }} lockers open</div>
          </div>
        </div>
      }
      <div class="mobile-chip-row">
        @for (section of sections; track section.label) {
          <div class="mobile-chip" [class.active]="activeGroup === section.label" (click)="setGroup(section.label)">{{ section.label }}</div>
        }
      </div>
      @for (section of mobileSections; track section.label) {
        <div class="mobile-grid">
          @for (a of section.items; track a.id) {
            <div class="locker">
              @if (a.unlocked) {
                <div class="porthole" [class.equipped-porthole]="a.isActive"
                     (click)="onEquip(a)" [title]="a.description">
                  <div class="porthole-img"><img [src]="a.imagePath" [alt]="a.name"></div>
                  @if (a.isActive) { <div class="equip-ring"></div> }
                </div>
                @if (a.isActive) {
                  <div class="locker-equipped-tag">✓ EQUIPPED</div>
                } @else {
                  <div class="locker-name">{{ a.name }}</div>
                }
              } @else {
                <div class="porthole locked-porthole">
                  <div class="locked-face"><span class="locked-q">?</span></div>
                  <div class="lock-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" fill="#8592ad"/><path d="M8 11V8a4 4 0 018 0v3" stroke="#8592ad" stroke-width="2" fill="none"/></svg>
                  </div>
                </div>
                <div class="locker-name">??? Sporty</div>
              }
            </div>
          }
        </div>
      }
    </div>

    <div class="desktop-view">
    <div class="panel-fx">
    <div class="panel">
      <div class="hud">
```

Then find the closing of the template:

```
    </div>
    </div>
  `,
```

Replace it with:

```
    </div>
    </div>
    </div>
  `,
```

- [ ] **Step 7: Run the `AvatarLockerComponent` test again to confirm the template compiles**

Run: `cd frontend && npx ng test --include='**/avatar-locker.component.spec.ts' --watch=false`
Expected: PASS.

- [ ] **Step 8: Write the failing test for `AvatarsPageComponent`**

Create `frontend/src/app/avatars/avatars-page.component.spec.ts`:

```ts
import { AvatarsPageComponent } from './avatars-page.component';
import { AvatarStatus } from '../shared/models/dashboard.model';

describe('AvatarsPageComponent mobile view toggle', () => {
  let component: AvatarsPageComponent;

  beforeEach(() => {
    component = new AvatarsPageComponent({} as any, {} as any);
  });

  it('defaults to the avatars view', () => {
    expect(component.activeView).toBe('avatars');
  });

  it('switches to borders and back', () => {
    component.setView('borders');
    expect(component.activeView).toBe('borders');
    component.setView('avatars');
    expect(component.activeView).toBe('avatars');
  });

  it('exposes the currently equipped avatar', () => {
    const active: AvatarStatus = {
      id: 'a1', name: 'Starter Sporty', description: 'Default', imagePath: 'a1.png',
      unlockType: 'default', unlockValue: 0, unlocked: true, unlockedAt: '2026-01-01', isActive: true,
    };
    component.avatars = [active];
    expect(component.equippedAvatar).toEqual(active);
  });

  it('returns null when no avatar is equipped', () => {
    component.avatars = [];
    expect(component.equippedAvatar).toBeNull();
  });
});
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `cd frontend && npx ng test --include='**/avatars-page.component.spec.ts' --watch=false`
Expected: FAIL — `activeView` / `setView` / `equippedAvatar` do not exist on `AvatarsPageComponent`.

- [ ] **Step 10: Add the view-toggle field, getter, and method**

In `frontend/src/app/avatars/avatars-page.component.ts`, inside `export class AvatarsPageComponent`, after `equippingBorder = false;` add:

```ts
  activeView: 'avatars' | 'borders' = 'avatars';

  get equippedAvatar(): AvatarStatus | null {
    return this.avatars.find(a => a.isActive) ?? null;
  }

  setView(view: 'avatars' | 'borders'): void {
    this.activeView = view;
  }
```

- [ ] **Step 11: Run the test to verify it passes**

Run: `cd frontend && npx ng test --include='**/avatars-page.component.spec.ts' --watch=false`
Expected: PASS — all 4 specs green.

- [ ] **Step 12: Add the mobile toggle CSS**

In the same file's `styles: []` array, after the closing `.active-label { ... }` line (the last rule), add:

```
    .mobile-toggle-header { display:none; }
    @media (max-width: 767px) {
      .mobile-toggle-header { display:flex; }
      .mobile-hidden { display:none; }
    }
    .segmented { display:flex; background:#e2e9f4; border-radius:12px; padding:4px; gap:3px; flex:1; }
    .segment {
      flex:1; text-align:center; font-family:'Chakra Petch',sans-serif; font-weight:700; font-size:11px;
      letter-spacing:.04em; color:#8592ad; padding:9px 0; border-radius:9px; cursor:pointer;
    }
    .segment.active { color:#fff; background:#2E6BE6; }
```

- [ ] **Step 13: Add the toggle markup and gate the two panes**

In the `template: \`` string, find:

```
        <app-avatar-locker
          [avatars]="avatars"
          [equipping]="equipping"
          [activeBorderCss]="activeBorderCss"
          (equip)="equip($event)"></app-avatar-locker>

        @if (!bordersLoading && borders.length > 0) {
          <div class="borders-section">
```

Replace it with:

```
        <div class="mobile-toggle-header">
          <div class="segmented">
            <div class="segment" [class.active]="activeView === 'avatars'" (click)="setView('avatars')">AVATARS</div>
            <div class="segment" [class.active]="activeView === 'borders'" (click)="setView('borders')">BORDERS</div>
          </div>
        </div>

        <div [class.mobile-hidden]="activeView !== 'avatars'">
          <app-avatar-locker
            [avatars]="avatars"
            [equipping]="equipping"
            [activeBorderCss]="activeBorderCss"
            (equip)="equip($event)"></app-avatar-locker>
        </div>

        @if (!bordersLoading && borders.length > 0) {
          <div class="borders-section" [class.mobile-hidden]="activeView !== 'borders'">
```

- [ ] **Step 14: Run the `AvatarsPageComponent` test again to confirm the template compiles**

Run: `cd frontend && npx ng test --include='**/avatars-page.component.spec.ts' --watch=false`
Expected: PASS.

- [ ] **Step 15: Manually verify in the browser**

Run: `cd frontend && npm start`, open `http://localhost:4200/avatars` in Chrome DevTools device mode at 390×844. Confirm: a compact equipped-avatar header appears above category chips and a 3-col porthole grid, the AVATARS/BORDERS segmented toggle switches between the locker and the border grid, tapping category chips filters the porthole groups, and widening past 768px restores the original 2-pane portrait + stacked-rows layout with both avatars and borders visible at once.

- [ ] **Step 16: Run the full frontend test suite**

Run: `cd frontend && npx ng test --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 17: Commit**

```bash
git add frontend/src/app/profile/avatar-locker.component.ts frontend/src/app/profile/avatar-locker.component.spec.ts frontend/src/app/avatars/avatars-page.component.ts frontend/src/app/avatars/avatars-page.component.spec.ts
git commit -m "feat: add mobile compact header, category chips, and Avatars/Borders toggle to Locker (1e)"
```
