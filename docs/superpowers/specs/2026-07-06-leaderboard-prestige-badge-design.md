# Leaderboard Prestige Badge — Design Spec

**Date:** 2026-07-06
**Status:** Approved, ready for planning

## Problem

Prestige already exists (`UserXp.PrestigeLevel`, +5% activity XP per level, reset at Level 10
"IMMORTAL"). It's surfaced on the dashboard hero and the profile as a lime `★{n}` star, but the
**leaderboard shows no sign of it**. A player who has prestiged looks identical to everyone else in
the ranked list and podium. We want a visual mark on the leaderboard so prestige is recognizable
at a glance.

## Solution Overview

Render a small **star badge (`★{n}`)** overlaid on the top-right corner of each athlete's avatar,
in both the ranked list rows and the podium cards. The badge appears only when
`prestigeLevel > 0`, so it doubles as the signal that a user has prestiged at all. Amber/gold fill
(distinct from the dashboard's lime star) so it reads on white rows and against any avatar art.

The overlay placement was chosen deliberately: it does not shift the name column and stays subtle
while remaining glanceable.

**Explicitly out of scope:** no new prestige mechanics, no change to leaderboard ordering or
tiebreaks. Points ordering is untouched. This is a purely visual surface.

## Backend Changes

1. **`LeaderboardEntryDto`** — add `public int PrestigeLevel { get; set; }` (defaults to 0).

2. **`IXpService` / `XpService`** — add `Task<Dictionary<Guid, int>> GetPrestigeLevelMapAsync()`.
   - Single query over `UserXp` projecting `UserId → PrestigeLevel`.
   - Mirrors the existing map-helper pattern used by `IAvatarService.GetAvatarImageMapAsync()` and
     `IBorderService.GetActiveBorderCssMapAsync()`. No N+1.

3. **`LeaderboardService`** — inject `IXpService`; fetch the prestige map once alongside the avatar
   and border maps; set `PrestigeLevel` per entry, defaulting to 0 when the user has no `UserXp`
   row (`map.TryGetValue(...)` → 0).

## Frontend Changes

1. **`LeaderboardEntry` model** — add `prestigeLevel: number`.

2. **`leaderboard.component.ts`**
   - Wrap each avatar — both the `<img class="av-thumb">` and the `<span class="av-initial">`
     fallback — in a `position: relative` container (list rows *and* podium slots).
   - When `e.prestigeLevel > 0`, render a `.prestige-badge` span containing `★{{ e.prestigeLevel }}`
     absolutely positioned at the avatar's top-right corner.
   - Badge sizing scales for the two avatar sizes (`sm` list ~32px avatars, `lg` podium ~48px
     avatars), so add a size modifier or two badge size rules.

3. **Badge style** (added to the component's inline `styles`)
   - Amber/gold gradient fill, white star + number, a thin light ring/border and small shadow so it
     lifts off the avatar. Small, circular/pill, high-contrast.

## Testing

- **Backend:** extend/add a `LeaderboardService` test asserting `PrestigeLevel` is populated from
  the prestige map, and that a user with **no `UserXp` row** yields `PrestigeLevel == 0`.
- **Frontend:** template/style change — verify visually in the running app that badges appear on
  prestiged users (list + podium) and are absent at prestige 0.

## Notes / Gotchas

- The prestige map key is `UserId`; users who have never earned XP have no `UserXp` row, so the
  `TryGetValue → 0` default is required (not optional).
- Amber is intentionally different from the dashboard/profile lime star because the leaderboard
  backgrounds (white rows, gold/silver/bronze podium cards) differ from the dark hero; consistency
  of *meaning* (a star + number) matters more than exact color here.
