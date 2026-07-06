# Coins + Shop — Design

Status: approved
Date: 2026-07-06

## Purpose

A new soft currency ("Coins"), earned passively from every logged activity,
spendable in a new Shop on: an XP booster consumable, two tiers of
purchasable loot boxes, and six brand-new shop-exclusive avatars. Gives
grinding activities an ongoing spend-side purpose beyond XP/achievements —
a lightweight economy layer, not a pay-to-win mechanic (everything is
coin-only, no real money).

## Scope

- New currency: Coins, earned as a fixed fraction of the points every
  logged activity already awards.
- Three purchasable item categories in a new `/shop` page:
  1. **XP Booster** — temporary XP multiplier consumable.
  2. **Loot boxes** — Normal and Special tiers, differing only in rarity
     odds, otherwise reusing the entire existing Loot Box system unchanged
     (same reward pool, same open/reveal modal, same duplicate→XP
     conversion).
  3. **Shop-exclusive avatars** — six brand-new avatars, purchasable
     outright (no RNG), never obtainable via any other unlock path.
- Explicitly NOT in scope: buying existing loot-box-exclusive or
  achievement-exclusive avatars/borders directly (would undercut their
  scarcity — see "Out of scope").

## Data model changes

**`UserXp`** (`backend/Sport4You.Api/Models/UserXp.cs`) gains two new
fields, following the exact pattern `PrestigeLevel` already establishes for
per-user transient state on this table:

```csharp
public int Coins { get; set; }
public int BoostedActivitiesRemaining { get; set; }
```

**`Avatar`** (`backend/Sport4You.Api/Models/Avatar.cs`) gains two new
nullable fields, set only when `UnlockType == "shop"` (mirroring how
`UnlockAchievementId` is already nullable and only set for
`"achievement_earned"`):

```csharp
public string? ShopRarity { get; set; }  // "common" | "rare" | "legendary" — shop avatars only
public int? ShopPrice { get; set; }      // coin price — shop avatars only
```

Note: `Avatar` today has no general `Rarity` field — rarity currently only
exists on `LootBoxReward`, scoped to the loot-box reward pool. These two
new fields are shop-specific and orthogonal to that; the six new shop
avatars are seeded with `UnlockType = "shop"` (joining the existing
`"default"|"level_reached"|"achievement_earned"|"streak_days"|"activities_logged"|"loot_box"`
set) and their `ShopRarity`/`ShopPrice` set directly per item (300/800/1500
by tier — a plain field rather than a computed lookup, since it's simpler
and just as correct for exactly six fixed items).

**`LootBox`** (`backend/Sport4You.Api/Models/LootBox.cs`) — no schema
changes. Purchased boxes are inserted with `EarnReason = "shop_normal"` or
`"shop_special"`, joining the existing `"level_up"|"streak"|"mission"`
values. `EarnReason` is purely a provenance/analytics tag today (it's never
branched on when *opening* a box) except for the once-per-day dedup check
scoped specifically to `"streak"` — shop purchases are unaffected by that
check since it's an `if (reason == "streak")` guard.

**`LootBoxReward`** — no schema changes. Same reward pool (avatar/border ×
common/rare/legendary) serves both free and purchased boxes.

## Earning coins

In `ActivityService.LogActivityAsync`, immediately after `Points` is
computed for the activity (same call site that already feeds `Points` into
`AwardActivityXpAsync`):

```csharp
var coinsEarned = points / 10; // integer division, floors naturally
```

`UserXp.Coins` is incremented by `coinsEarned` in the same
`SaveChangesAsync` batch that already writes XP/points for this activity —
no new round trip, no new transaction boundary.

Example: a 5 km run scores `floor(5 × 100) = 500` points → 50 coins.

## XP Booster

**Item:** +50% XP on the next 3 logged activities. Price: 400 coins.

**Purchase** (`ShopService.PurchaseBoosterAsync(userId)`):
1. Load `UserXp` row (create if missing, same lazy-creation pattern
   `XpService.AwardActivityXpAsync` already uses).
2. If `Coins < 400`, return an error result (`BadRequest({ error:
   "Insufficient coins" })` at the controller, same `IsError`/`Error`
   result-record pattern as `ActivityResult`).
3. Deduct 400 coins, `BoostedActivitiesRemaining += 3` (additive — buying a
   second booster while one is still active extends the counter rather
   than resetting or stacking multipliers; there is only ever one
   multiplier tier, 1.5×, regardless of how many purchases contributed to
   the remaining count).

**Applying it** — in `XpService.AwardActivityXpAsync`, alongside the
existing prestige bonus multiplier:

```csharp
var boosted = userXp.BoostedActivitiesRemaining > 0;
if (boosted)
{
    xpEarned = (int)(xpEarned * 1.5);
    userXp.BoostedActivitiesRemaining--;
}
```

This runs on the already-prestige-adjusted `xpEarned` value (multipliers
compound: prestige bonus first, then the 1.5× booster on top), then the
usual level-up detection (`GetLevelInfo` before/after comparison) proceeds
completely unchanged — a boosted XP total simply may cross a level
threshold sooner than it otherwise would, which already and automatically
triggers `AwardLevelUpBoxesAsync` with zero new code there. `boosted` is
returned up the call chain (see DTO changes below) so the frontend knows to
show the boost line on this specific activity's splash.

## Loot boxes: Normal and Special tiers

Both tiers reuse `LootBoxService.OpenBoxAsync` unchanged in every respect
(reward pool, type roll, duplicate handling) except the rarity roll, which
becomes reason-dependent:

| Reason | Common | Rare | Legendary | Price |
|---|---|---|---|---|
| `level_up` / `streak` / `mission` (existing, unchanged) | 60% | 30% | 10% | free |
| `shop_normal` (new) | 60% | 30% | 10% | 500 coins |
| `shop_special` (new) | 30% | 45% | 25% | 1000 coins |

**Purchase** (`ShopService.PurchaseLootBoxAsync(userId, tier)` where `tier`
is `"normal"` or `"special"`):
1. Validate `Coins >= price` for the requested tier.
2. Deduct the price.
3. Call the existing `LootBoxService.EarnBoxAsync(userId, reason)` with
   `reason = "shop_normal"` or `"shop_special"` — this inserts a pending
   `LootBox` row exactly as any other earn path does (the `"streak"`-only
   once-per-day guard inside `EarnBoxAsync` does not apply to these
   reasons, so repeat purchases in one day are allowed, as expected for a
   paid item).

**Opening a purchased box:** identical UX to any other pending box — it
appears in the user's pending-box count and opens through the existing
Signal Vault modal (`loot-box-modal.component.ts`), unmodified. The rarity
roll inside `OpenBoxAsync` is the only code that branches on `EarnReason`.

## Shop-exclusive avatars

Six new avatars, `UnlockType = "shop"`, never earnable via loot box or
achievement — purely a coin purchase. Fixed pricing by `ShopRarity`:

| Rarity | Price |
|---|---|
| Common | 300 coins |
| Rare | 800 coins |
| Legendary | 1500 coins |

Follows the existing "Sporty" mascot art convention (512×512, cute
water-bottle character in a themed costume) and the existing pattern of
pop-culture-adjacent homage already present in the loot-box set (e.g.
"Wizard Sporty", "Windrunner Sporty" — archetypal costumes and flavor-text
nods, not literal renderings of specific copyrighted characters):

**Common**
- **Sleuth Sporty** — deerstalker cap, cape, magnifying glass. *"Elementary,
  my dear hydration."*
- **Scavenger Sporty** — fedora, bullwhip, leather satchel. *"Fortune and
  glory... and electrolytes."*

**Rare**
- **Bladewalker Sporty** — hooded robe, glowing energy blade, twin-sun
  desert backdrop. *"May the pace be with you."*
- **Ringbearer Sporty** — hooded cloak, small glowing ring on a chain,
  misty hillside backdrop. *"One does not simply skip leg day."*

**Legendary**
- **Master Assassin Sporty** — white hood, hidden blade, Renaissance
  rooftop at sunset. *"Nothing is true, everything is cardio."*
- **Dark Lord Sporty** — dark armored cape, red energy blade, starship
  bridge with red emergency lighting. *"I find your lack of hydration
  disturbing."*

**AI image-generation prompts** (512×512, matching the existing mascot
style — cute rounded plastic water-bottle character with a sweatband,
simple dot eyes, smiling, glossy 3D-rendered/Pixar-adjacent lighting; same
generator + `sips -Z 512` downscale workflow as existing avatars):

1. **Sleuth Sporty**: "A cute round blue plastic water bottle mascot
   character with a white cap, big friendly dot eyes and a smile, wearing a
   tan deerstalker cap and a short tweed cape, holding a small brass
   magnifying glass, standing in a foggy Victorian London street at night
   with a gas lamp glowing nearby, glossy 3D render, soft cinematic
   lighting, mobile game icon style, centered composition, plain
   vignette background."
2. **Scavenger Sporty**: "A cute round blue plastic water bottle mascot
   character with a white cap, big friendly dot eyes and a smile, wearing a
   worn brown fedora and a small leather satchel across its body, holding a
   coiled bullwhip, standing in an ancient sandstone temple ruin with
   golden sunbeams cutting through dust, glossy 3D render, adventurous
   warm lighting, mobile game icon style, centered composition."
3. **Bladewalker Sporty**: "A cute round blue plastic water bottle mascot
   character with a white cap, big friendly dot eyes and a smile, wearing a
   hooded tan-and-brown desert robe, holding a glowing blue energy blade,
   standing on a sand dune under twin suns at dusk, glossy 3D render,
   dramatic sci-fi lighting, mobile game icon style, centered composition."
4. **Ringbearer Sporty**: "A cute round blue plastic water bottle mascot
   character with a white cap, big friendly dot eyes and a smile, wearing a
   soft green hooded cloak, holding a tiny glowing gold ring on a chain,
   standing on a grassy hillside path with a misty valley and round
   cottage doors in the background, glossy 3D render, warm golden-hour
   lighting, mobile game icon style, centered composition."
5. **Master Assassin Sporty**: "A cute round blue plastic water bottle
   mascot character with a white cap, big friendly dot eyes and a smile,
   wearing a white hooded cloak with a red sash and a small hidden blade
   bracer, crouched on a terracotta rooftop overlooking a Renaissance
   Italian city skyline at sunset, glossy 3D render, cinematic warm-orange
   lighting, mobile game icon style, centered composition."
6. **Dark Lord Sporty**: "A cute round blue plastic water bottle mascot
   character with a white cap, big friendly dot eyes and a smile, wearing a
   sleek black armored chest piece and a flowing black cape, holding a
   glowing red energy blade, standing on a starship bridge with red
   emergency lighting and control panels in the background, glossy 3D
   render, dramatic high-contrast lighting, mobile game icon style,
   centered composition."

## API surface

- `GET /api/users/{id}/shop` — returns `Coins`, `BoostedActivitiesRemaining`,
  and the full catalog (booster price/description, both loot box
  tiers with price + odds, all 6 shop avatars with price + owned flag).
- `POST /api/users/{id}/shop/booster` — purchase the XP booster.
- `POST /api/users/{id}/shop/lootbox` — body `{ tier: "normal" | "special" }`
  — purchase a loot box (grants a pending `LootBox`, does not open it).
- `POST /api/users/{id}/shop/avatar` — body `{ avatarId }` — purchase a
  specific shop-exclusive avatar. Follows the existing `IsError`/`IsConflict`
  result-pattern used across the other controllers (e.g.
  `UsersController.cs:28,57`): `BadRequest({ error })` if the avatar isn't
  `UnlockType == "shop"` or coins are insufficient, `Conflict({ error })` if
  already owned.
- All four endpoints follow the existing unauthenticated userId-in-path
  convention used by every other `/api/users/{id}/...` endpoint (avatars,
  borders, boxes) — no new auth model introduced.
- `ActivityResult` (`IActivityService.cs`) and its DTO gain one field:
  `bool BoostApplied`.

## Frontend

- New `/shop` route + top-level nav item (alongside Leaderboard/Dashboard/
  Achievements/Profile).
- Shop page: coin balance header, three sections — Booster (single card,
  buy button, shows remaining boosted-activities count if active),
  Loot Boxes (two cards side by side, price + odds breakdown), Avatars (six
  cards, price, owned/purchased state grays out the buy button).
- Purchased loot boxes surface through the existing pending-box count and
  open via the existing Signal Vault modal — no new opening UI.
- Dashboard hero (`dashboard.component.ts`): the existing `.coins-badge`
  (`dashboard.component.ts:245`) is **mislabeled today** — it displays
  `totalPoints`, not any currency. Rename it to `.points-badge` (CSS class
  and any related naming) so it continues showing points under an accurate
  name. Add a new, genuine coin balance badge next to it, plus a small
  "Boost: N left" chip shown only when `BoostedActivitiesRemaining > 0`.
- Activity confirmation splash (`log-activity-dialog.component.ts:323`):
  when the log response's `boostApplied` is true, append "· +50% XP BOOST
  APPLIED" next to the existing "POINTS EARNED · +XP" line.

## Testing

- Backend: coin award formula (`points / 10`, floor behavior at boundary
  values like 9 and 10 points).
- Backend: booster purchase — insufficient funds rejected; successful
  purchase deducts 400 and sets `BoostedActivitiesRemaining = 3`; a second
  purchase while `BoostedActivitiesRemaining > 0` adds rather than resets
  (e.g. 2 remaining + purchase → 5, not 3).
- Backend: `AwardActivityXpAsync` applies the 1.5× multiplier only while
  `BoostedActivitiesRemaining > 0`, decrements it once per activity, stops
  applying once it reaches 0, and correctly compounds on top of the
  existing prestige multiplier.
- Backend: loot box purchase — `shop_normal` uses 60/30/10 odds,
  `shop_special` uses 30/45/25 odds (statistical test over many rolls, same
  style as any existing rarity-roll test in `LootBoxTests.cs`); price
  deduction and insufficient-funds rejection for both tiers.
- Backend: shop avatar purchase — rejects non-shop avatars, rejects
  duplicate purchase of an already-owned avatar, rejects insufficient
  funds, successful purchase creates the `UserAvatar` unlock row and
  deducts the correct rarity-based price.
- Live Playwright verification: log an activity, confirm coin balance
  increases by the expected amount on the dashboard; buy the booster,
  confirm the dashboard chip appears and the next activity-log splash
  shows the boost line and correct boosted XP amount; buy a Normal and a
  Special loot box, confirm each opens through the existing modal; buy a
  shop avatar, confirm it appears equippable in the profile's Locker
  Select and can no longer be purchased again.

## Out of scope

- No purchasing of existing loot-box-exclusive or achievement-exclusive
  avatars/borders directly with coins — would undercut their scarcity
  (explicitly decided against during design).
- No dynamic/configurable pricing system (e.g. admin-editable prices,
  sales, rotating stock) — `ShopPrice` is a fixed seeded value per avatar,
  since there's no present need for runtime price changes.
- No real-money purchases anywhere in this system — Coins are earned
  in-app only.
- No changes to `POST /api/users` or `POST /api/activities` contracts.
