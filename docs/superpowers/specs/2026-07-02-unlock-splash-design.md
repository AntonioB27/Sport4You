# Unlock Splash — Achievement & Avatar Completion Screens

**Date:** 2026-07-02
**Status:** Approved
**Scope:** Frontend only — `log-activity-dialog.component.ts` overlays. No backend changes.

## Problem

When an activity log unlocks achievements or avatars, the dialog shows flat dark
overlays: a tier pill, name, description, +XP, and a button. The achievement
artwork — the strongest asset in the app — never appears, and the moment feels
anticlimactic next to the redesigned Trophy Track achievements page.

## Design

### Full-bleed art splash

The unlock overlay keeps its position (absolute inset over the dialog, rounded
corners, z-50) but is rebuilt as a splash:

- **Background:** the achievement's own artwork fills the entire overlay
  (`object-fit: cover`).
- **Wash:** from ~40% height downward, a tier-colored gradient darkens into the
  bottom edge so text stays legible. Tier colors: bronze `#8A4F16`-family,
  silver slate, gold `#B57C00`-family. Avatar splash uses the app blue
  (`#173B92`-family).
- **Content block (bottom):**
  1. Tag: `ACHIEVEMENT UNLOCKED`
  2. Tier line: `GOLD · LEGENDARY` (rarity mapping identical to the
     achievements page: bronze→COMMON, silver→RARE, gold→LEGENDARY)
  3. Achievement name (large, Chakra Petch)
  4. Description
  5. `+N XP`
  6. Button — existing queue logic unchanged (`NEXT →` while queued,
     `AWESOME! 🏅` on last)

### Avatar splash

Identical structure using the avatar's `imagePath`; blue wash; tag
`AVATAR UNLOCKED`; no tier line, no XP ticker; button keeps
`NEXT →` / `NICE! 🎭` queue logic.

### Motion (maximal)

| Effect | Detail |
|---|---|
| Entry flash | Tier-colored flash fading out ~400 ms |
| Ken Burns | Artwork zooms 1.0 → ~1.12 over 8 s, ease-out |
| Staggered text | Tag/tier/name/desc/XP/button slide up ~80 ms apart; readable within ~1 s |
| XP count-up | 0 → xpReward over ~800 ms via rAF ticker in the component, restarted per queued achievement |
| Confetti | Burst on entry, reusing the existing `s4y-conf` particle pattern |
| Holo shimmer | Gold tier only: one shimmer sweep across the splash |

### Code moves

- `achievementIconPath()` moves from `achievements.component.ts` to
  `shared/utils/achievement-icon.ts`; both the achievements page and the
  dialog import it from there. It needs only `tier` + `name`, which
  `UnlockedAchievement` provides.

## Out of scope

- Queue/sequencing logic, backend DTOs, the confirmation ("ACTIVITY LOGGED")
  overlay, and the dashboard unlock widget.

## Verification

Playwright against the running app: log activities that unlock a bronze
achievement, a gold achievement, and an avatar; screenshot each splash state
and confirm artwork, wash color, rarity line, XP value, and queue buttons.
