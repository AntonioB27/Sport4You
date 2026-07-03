# Avatar Picker — "Locker Select" (design 2a) — PARKED

**Date:** 2026-07-03
**Status:** Approved direction, implementation deferred until Phase 4b (user
profile screen) is finished and committed. The standalone `/avatars` page was
removed by Phase 4b; the picker now lives as the AVATARS tab in
`frontend/src/app/profile/profile.component.ts`. Placement decision (tab vs.
standalone page) re-confirm with Antonio at implementation time — he chose to
wait rather than pick.

**Source:** Claude Design project `f176e8f8-3ce7-4bf4-8ed0-8995116610c4`,
file `Avatar Picker.dc.html`, section `id="2a"` ("Locker Select — framed
circular portholes"). Re-fetch via DesignSync for exact markup.

## Design summary (2a)

Panel (radius 26, `#EEF3FB`, border `#dbe4f2`) with:

1. **Navy HUD bar** (same gradient as achievements page): lime locker icon,
   title `GEAR UP · SPOTRY LOCKERS`, subtitle "Pick a porthole to equip your
   fighter", pill `{unlocked} / {total} LOCKERS OPEN`.
2. **Two-column body** `300px + 1fr`:
   - **Portrait pane** (light `#EAF1FF→#DCE8FF`, border `#C7D8F5`): pill
     `✦ EQUIPPED · ON YOUR HERO`; 216px stage with spinning dashed ring
     (`ringSpin` 16s); circular medallion 180px — 7px blue-gradient ring
     (`#2E6BE6→#1B47AE`) + 5px lime outer glow; image `object-fit:cover;
     object-position:50% 22%`; name 26px Chakra Petch + description.
   - **Locker rows** grouped by unlock type, each row: Chakra Petch label +
     fading divider, then 104px-wide items:
     - **Unlocked**: 96px circle, 4px white→`#cddcf5` gradient frame, image
       cover 50% 22%, hover `translateY(-5px)`, click = equip. Name below.
     - **Equipped**: adds lime ring `0 0 0 4px #C6E63B` + `glowPulse`
       animation and `✓ EQUIPPED` label (olive `#5f7a00`).
     - **Locked**: gray gradient circle with big `?`, small white lock badge
       bottom-right, name masked as `??? Sporty`, unlock text
       (= avatar description) in 9px gray below.

## Data mapping (no backend changes needed)

`AvatarStatus`: id, name, description, imagePath, unlockType, unlocked,
unlockedAt, isActive. Groups by `unlockType`:

| unlockType | Row label |
|---|---|
| `default` | STARTER |
| `level_reached` | LEVEL UP |
| `streak_days` | STREAK |
| `achievement_earned` | BADGE EARNED |
| `activities_logged` | ACTIVITIES LOGGED |

(The design mock omits a `default` group — add the STARTER row first.)
Locked unlock text = `description`. Equip = existing
`setActiveAvatar(userId, avatarId)`; on success update `isActive` flags
locally (same optimistic pattern the old page used). 2a has no progress bars
on locked items (unlike siblings 1a/1b), so no progress data is required.

## Motion

`ringSpin` (16s linear), `glowPulse` on the equipped porthole, hover lift,
`popIn` on portrait pane when equip changes (recreate DOM per equipped id —
`@for` over one-element array, track by id, like the unlock splashes).
