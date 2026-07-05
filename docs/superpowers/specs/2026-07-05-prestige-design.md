# Prestige

**Date:** 2026-07-05
**Status:** Approved
**Scope:** Additive. Does not touch the assignment's `POST /api/users` /
`POST /api/activities` contracts.

## Problem

XP and Points are already separate currencies in this app (Points drive the
leaderboard; XP drives levels/quests/loot-box triggers). Level 10
("IMMORTAL", 60,000 XP) is a hard ceiling — `GetLevelInfo` caps out and
returns `xpPercent: 100` forever with no further progression signal. A
dedicated player who reaches it has nothing left to work toward on the XP
side.

## Design

### Data model

`UserXp` gains `PrestigeLevel` (`int`, default `0`) — XP-progression state,
lives next to `TotalXp` on the same row.

### Backend

- `POST /api/users/{userId}/prestige`:
  - Validates the user is currently at Level 10
    (`GetLevelInfo(TotalXp).Level == 10`). If not: `400 { error: "Reach Level 10 (IMMORTAL) before you can prestige." }`.
  - On success: `TotalXp = 0`, `PrestigeLevel += 1`. Returns the fresh
    `XpSummary` (now Level 1, incremented prestige tier).
  - Nothing else resets — Points, achievements, avatars, borders, streaks,
    and already-unlocked loot-box rewards are untouched. Achievement
    unlocks are one-way (evaluation only adds newly-met achievements, never
    revokes earned ones), so "Immortal" (Reach Level 10) and similar stay
    unlocked permanently even after the level display resets to 1.
  - Re-climbing from Level 1 to Level 10 again naturally re-triggers the
    existing level-up loot-box awards (`AwardLevelUpBoxesAsync` fires
    whenever `levelBefore < levelAfter`, recomputed fresh from current
    `TotalXp` on every activity) — an intentional side effect, not
    something new to build.
- `AwardActivityXpAsync` multiplies the base activity XP by
  `1 + 0.05 * PrestigeLevel` (floored to an int), reading `PrestigeLevel`
  off the same `UserXp` row it already fetches for `previousXp` — no new
  query. `CalculateActivityXp` itself stays pure/unchanged; the multiplier
  is applied at the call site.
- `XpDto` (already part of the dashboard response) gains `PrestigeLevel`.

### Frontend

- **Level badge everywhere it renders** (dashboard hero, profile hero):
  when `prestigeLevel > 0`, a small "★N" chip appears immediately before
  "LEVEL X · TITLE". Shown on both own and public profiles — it's a
  read-only stat like the level number itself.
- **Dashboard hero, own view only:** when at Level 10, a "PRESTIGE" button
  appears next to the level badge.
- **Confirmation:** clicking it opens a snackbar with an action button
  ("Reset to Level 1 for +5% XP forever?" / "Prestige"), reusing the same
  action-snackbar pattern already used for the login rescue path — no new
  modal component.
- **On confirm:** call `POST /api/users/{userId}/prestige`, then reuse the
  existing `triggerLevelUp` animation (badge pop + expanding ring, already
  built for ordinary level-ups) to celebrate the reset, plus a snackbar:
  `"🎉 Prestige {N}! +{N*5}% activity XP, forever."`

## Out of scope

- Prestige-tier-colored borders or any new cosmetic/rarity system beyond
  the "★N" chip.
- A prestige-specific leaderboard or filter.
- Uncapping or changing the +5%/tier boost math.
- Resetting anything other than `TotalXp` and displayed level.

## Testing

Backend (xunit):
- prestige at Level 10 → `TotalXp` resets to 0, `PrestigeLevel` increments,
  dashboard reflects Level 1 + new prestige tier.
- prestige attempt below Level 10 → `400`.
- activity XP after prestiging is measurably higher than before (the +5%
  multiplier applied) for the same logged activity.
- achievements already unlocked before a prestige (e.g. "Immortal") remain
  unlocked after — evaluation is one-way and unaffected by the XP reset.
- repeat prestige (climb back to Level 10 again) succeeds and increments
  `PrestigeLevel` to 2.

Frontend: Playwright — a user at Level 10 sees the PRESTIGE button; clicking
through the confirmation resets the dashboard to Level 1 with a "★1" chip
and the celebration animation fires; the chip also appears on that user's
public profile.
