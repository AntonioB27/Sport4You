# Rivals

**Date:** 2026-07-05
**Status:** Approved
**Scope:** Additive feature. Does not touch the assignment's core
`POST /api/users` / `POST /api/activities` contracts.

## Problem

The leaderboard is the app's main competitive surface, but it's a static
all-time ranking — there's no way to track a single specific rival over
time or get any signal when the standing between you and them changes.

## Design

### Data model

`User` gains two nullable fields:
- `RivalUserId` (`Guid?`) — the user currently being tracked. One at a time;
  setting a new rival replaces the old one.
- `RivalAheadLastSeen` (`bool?`) — whether the user was ahead of their rival
  as of their last dashboard load. `null` until a rival is set. This is the
  entire state needed to detect a "just got passed" moment without a
  notification table.

### Backend

- `PUT /api/users/{userId}/rival` — body `{ rivalUserId: Guid }`. Validates
  the rival exists and `rivalUserId != userId` (400 otherwise). Sets
  `RivalUserId` and immediately computes + stores `RivalAheadLastSeen` from
  current points, so picking a rival never fires a false "just overtook" on
  the very next load.
- `DELETE /api/users/{userId}/rival` — clears both fields.
- No new GET endpoint. `GET /api/users/{userId}/dashboard` gains a
  `RivalStatus` object on the response (`null` if no rival set):
  ```
  {
    userId, firstName, lastName, imagePath, borderCss,
    myPoints, rivalPoints, pointsGap,      // myPoints - rivalPoints, can be negative
    imAhead: bool,
    justFlipped: bool                       // true exactly once per direction change
  }
  ```
  Computation on every dashboard load: fetch rival's total points, compute
  `imAheadNow`. If `user.RivalAheadLastSeen != null && user.RivalAheadLastSeen
  != imAheadNow`, set `justFlipped = true`. Always persist
  `RivalAheadLastSeen = imAheadNow` after computing, regardless of the flag —
  so the next load starts from the fresh state and `justFlipped` doesn't
  repeat.

### Frontend

- **Dashboard**: new Rival card in the existing card grid. Two avatar
  medallions (reusing the existing avatar+border rendering) face off around
  a `VS` chip; below, the point gap ("+40 pts ahead" / "−120 pts behind")
  and a comparison bar. If `justFlipped && !imAhead`, fire one
  `MatSnackBar`: *"{rivalFirstName} just passed you!"* — reusing the
  dashboard's existing snackbar pattern, no new component. No card at all
  if `rivalStatus` is `null`; instead a "Pick a Rival" prompt linking to the
  leaderboard.
- **Leaderboard page**: each row (except the viewer's own) gets a small
  text-pill button matching the existing EQUIP button styling: `RIVAL` when
  unset for that row, a filled/active state (e.g. `YOUR RIVAL`) on whichever
  row is the current pick, clickable to clear.
- **Public profile page**: same set/clear action, placed near the existing
  hero card actions — shown only when `!isOwnProfile` (the page already has
  this flag; visiting your own profile shows no rival action).

### Out of scope (tracked separately in `docs/FEATURE_IDEAS.md`)

Multiple simultaneous rivals, mutual/accepted rivalries, historical
rival-vs-you trend charts, notifications for anything other than the single
overtaken moment.

## Testing

Backend (xunit):
- set rival → dashboard includes correct `RivalStatus`, `justFlipped` false
  on the immediate next load
- rival overtakes (log activity for the rival past the user's total) →
  next dashboard load for the user has `justFlipped: true`, `imAhead: false`
- second load after a flip → `justFlipped` false again (no repeat)
- set rival to self → 400; set rival to nonexistent id → 400/404
- clear rival → `RivalStatus` null on next dashboard load

Frontend: Playwright — set a rival from the leaderboard, verify the
dashboard card appears with the right gap; simulate the rival overtaking via
API and reload, verify the snackbar fires once and not on a second reload;
clear the rival and verify the card disappears.
