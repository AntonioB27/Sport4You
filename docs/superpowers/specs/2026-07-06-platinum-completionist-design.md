# Platinum Completionist — Design

Status: approved
Date: 2026-07-06

## Purpose

A meta-achievement, avatar, and cosmetic border that unlock together once a
user has earned all 33 existing achievements — a "Platinum Trophy" moment
analogous to a PS5 Platinum trophy. Signals total mastery of the game
layer, distinct from any single achievement.

## Scope

- One new achievement ("Platinum Completionist"), one new avatar ("Platinum
  Sporty"), one new border ("Platinum"), all granted atomically the moment
  the 33rd (regular) achievement is earned.
- Achievement and avatar reuse existing unlock ceremony/splash machinery
  unchanged. The border grants silently — borders have never had an unlock
  ceremony (they've only ever surfaced via the Loot Box reveal modal), and
  this stays consistent with that: no new ceremony infrastructure.
- Trophy Track gets a 4th rail, "PLATINUM", after the existing
  bronze/silver/gold rails — a single card showing live progress (e.g.
  "32/33") until unlocked, same visual treatment as any other achievement
  card.
- Art assets already produced and in place (512×512, matching the existing
  "Sporty" mascot style):
  - `frontend/src/assets/achievements/platinum-completionist.png`
  - `frontend/src/assets/avatars/platinum-sporty.png`

## Data model changes

**`Achievement`** (`backend/Sport4You.Api/Models/Achievement.cs`) gains one
new nullable field:

```csharp
public Guid? GrantsBorderId { get; set; }  // only set on the Platinum achievement row
```

This mirrors `Avatar.UnlockAchievementId`'s existing reverse-FK pattern,
just pointed the other direction (achievement → border instead of
avatar → achievement).

**`Border`** (`backend/Sport4You.Api/Models/Border.cs`) — no schema changes.
One new seeded row: Name "Platinum", a new `"platinum"` rarity value
(joining the existing `"common"|"rare"|"legendary"` set), a border CSS ring
(slow-shimmering chrome/rainbow `conic-gradient`), and `ImagePath` left
matching the existing convention (borders are pure CSS rings — no image
asset needed for this one, consistent with how other borders are defined).

**`Avatar`** — no schema changes. The existing `UnlockType =
"achievement_earned"` + `UnlockAchievementId` mechanic is reused exactly as
today: seed the Platinum avatar with `UnlockAchievementId` pointing at the
Platinum achievement's seeded ID. `AvatarService.EvaluateAvatarsAsync`
already queries `UserAchievements` fresh from the database every time it
runs, so once the Platinum achievement row is persisted (same
`SaveChangesAsync` call, see below), the very next avatar evaluation in the
same activity-log pipeline call picks it up with zero code changes to
`AvatarService`.

## Unlock requirement and evaluation

New requirement type: `"achievements_unlocked"`, seeded with
`RequirementValue = 33`.

**Architectural wrinkle (must be handled correctly):**
`AchievementService.EvaluateAchievementsAsync` currently computes one
`UserAggregates` snapshot up front, then unlocks every qualifying
achievement in a single batch based on that snapshot. If a user's 33rd
regular achievement is earned in the very same activity log that should
also trigger Platinum, a naive single-pass check against the pre-batch
aggregate would under-count and miss the cascade (Platinum would look like
"32/33" even though the batch is about to bring it to 33/33).

The fix is a **two-phase evaluation** inside `EvaluateAchievementsAsync`:

1. Evaluate every unearned achievement EXCEPT the one with
   `RequirementType == "achievements_unlocked"`, exactly as today. This
   produces `toUnlock` (a list of achievements newly qualifying this call).
2. Separately, find the unearned achievement with
   `RequirementType == "achievements_unlocked"` (if any — there is only
   ever one, but this stays generic rather than a hardcoded Guid lookup).
   Compute `alreadyEarnedCount + toUnlock.Count` (already-earned before
   this call, plus however many are about to be newly earned in this same
   call). If that sum `>= RequirementValue` (33), add the Platinum
   achievement to `toUnlock` too.
3. The rest of the method proceeds unchanged — all of `toUnlock` (possibly
   now including Platinum) gets its `UserAchievements` row, XP transaction,
   and UserXp update in the same existing loop and single
   `SaveChangesAsync`.
4. Additionally, for any achievement in `toUnlock` with a non-null
   `GrantsBorderId`, add a `UserBorders` row for that user directly (same
   method, same `_db` instance, same `SaveChangesAsync` batch) —
   `AchievementService` already writes directly to `_db.UserAchievements`,
   `_db.XpTransactions`, and `_db.UserXp` inline without going through
   other services, so this is one more line in that same style, not a new
   dependency on `IBorderService`.

For **display purposes** (Trophy Track progress bar before it's unlocked),
`ComputeProgress` gets a new case for `"achievements_unlocked"`: the
progress value is the count of the user's already-unlocked achievements
whose `Tier != "platinum"` (i.e., excludes the Platinum achievement itself
from its own progress count — irrelevant once actually unlocked, but keeps
the "32/33" style progress bar honest beforehand).

## Seeding

New rows in `backend/Sport4You.Api/Data/DataSeeder.cs`:

- Achievement: `A("platinum", "Platinum Completionist", "Unlock all 33 achievements.", "achievements_unlocked", 33, null, 1000)` — 1000 XP reward, a clear step above gold's uniform 300, reflecting it as the ultimate achievement. `GrantsBorderId` set to the seeded Platinum border's ID after both are created (seeding order: border first, then achievement referencing it).
- Avatar: "Platinum Sporty", `UnlockType = "achievement_earned"`, `UnlockAchievementId` = the Platinum achievement's ID, `ImagePath = "assets/avatars/platinum-sporty.png"`.
- Border: "Platinum", `Rarity = "platinum"`, a shimmering chrome/rainbow `conic-gradient` CSS ring string.

## Frontend

- Achievements page (Trophy Track): the page's rails are progression
  *chains* per metric (e.g. a RUNNING rail connects bronze→silver→gold
  running-distance achievements with progress connectors) — Platinum is a
  one-off with no tiered chain, so it does NOT get a rail. Instead, add
  `"achievements_unlocked"` to the existing `ONE_TIME_TYPES` array in
  `frontend/src/app/achievements/achievements.component.ts`, alongside
  `"first_activity"`, `"first_mission"`, etc. — it then renders in the
  existing "one-time feats" grid with zero new UI sections. The page's
  existing "Latest Unlock" spotlight banner (shows whichever achievement
  was earned most recently, full hero treatment) will automatically
  feature Platinum the moment it's unlocked, since spotlight selection is
  driven by unlock recency, not achievement type — no new code needed for
  that payoff moment. Also add a `"platinum"` entry to the `TIER_META`
  record so the card renders with its own frame/rarity styling instead of
  falling back to the bronze default.
- Achievement unlock splash and avatar unlock splash fire unchanged (both
  already generic and driven by the same `UnlockedAchievementDto`/
  `UnlockedAvatarDto` payloads the activity-log response already carries).
- Border grants silently into the profile's Borders tab — no snackbar, no
  splash. User discovers it next time they open Borders and equips it
  manually, same as any other border.

## Testing

- Backend unit tests for the two-phase evaluation: a user with exactly 32
  earned achievements logs an activity that completes the 33rd — asserts
  the Platinum achievement, XP, and the `UserBorders` row all appear in the
  same `EvaluateAchievementsAsync` call's result/DB state. Also test the
  avatar cascade (via `AvatarService.EvaluateAvatarsAsync` called right
  after, per the existing pipeline order) picks up the newly-earned
  Platinum achievement and unlocks the Platinum avatar in the same
  activity-log request.
- Test the boundary case: exactly 32/33 does NOT unlock Platinum.
- Test `ComputeProgress`'s new `"achievements_unlocked"` case returns the
  correct pre-unlock count.
- Live Playwright verification: drive a test user through unlocking all 33
  regular achievements (likely via direct API/DB seeding of qualifying
  activities rather than one-by-one UI clicks, given the volume), confirm
  the achievement + avatar splashes both fire on the triggering activity
  log, confirm the Platinum rail appears on Trophy Track, confirm the
  Platinum border appears (unequipped) in the profile's Borders tab.

## Out of scope

- No special border-unlock ceremony/splash (explicitly decided against).
- No generic achievement-linked border unlock system — this is a targeted,
  one-off grant inside `AchievementService`, not a new `BorderService`
  evaluation pipeline (explicitly decided against, since there is exactly
  one border this applies to today).
- No changes to `POST /api/users` or `POST /api/activities` contracts.
