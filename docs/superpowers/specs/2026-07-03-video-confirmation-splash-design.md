# Video Confirmation Splash — "ACTIVITY LOGGED" Screen

**Date:** 2026-07-03
**Status:** Approved
**Scope:** Frontend only — the `.conf` confirmation overlay in
`frontend/src/app/shared/components/log-activity-dialog/log-activity-dialog.component.ts`.
No backend changes. `done()`, mission snackbars, and the transition into
achievement/avatar splashes are untouched.

## Problem

After logging an activity, the dialog shows a static blue-gradient panel with
a mascot image, points, and XP. The unlock screens that follow it were just
rebuilt as full-bleed art splashes; the confirmation screen now looks flat by
comparison — and each sport already has a looping video asset that never
appears here.

## Design

### Layout — full-bleed video splash

- **Background:** the logged sport's video (`sport.video`) fills the dialog —
  `<video>` with `muted`, `autoplay`-via-`play()`, `loop`, `playsinline`,
  `object-fit: cover`.
- **Fallback (daily_steps has no video):** background is the sport's gradient
  (`sport.bg`) with the mascot pose (`sport.pose`) anchored bottom-right
  behind the wash.
- **Wash:** dark neutral gradient from ~40% height to the bottom edge
  (same structure as the unlock splash washes, navy-black family).
- **Content block (bottom-left), staggered rise-in ~80 ms apart:**
  1. Tag: `ACTIVITY LOGGED` (lime, splash-tag style)
  2. Big points number `+2,000` — counts up over ~800 ms
  3. Line: `POINTS EARNED · +400 XP` (XP part only when `earnedXp > 0`)
  4. Sport pill: `RUNNING · 20.0 km` (existing `.conf-pill` style)
  5. Button: `DONE 🎉` (existing button style)

### Motion

| Effect | Detail |
|---|---|
| Entry flash | Lime-tinted flash fading out ~400 ms (splash-flash pattern) |
| Staggered text | Items rise in ~80 ms apart (reuse `s4y-rise`) |
| Count-up | Points tick 0 → `earnedPoints` over ~800 ms |
| Confetti | Keep the existing five confetti particles |
| No Ken Burns | The video already provides motion |

### Code notes

- Generalize the existing `startXpTicker` into a reusable rAF count-up so
  points and XP tickers share one implementation (no duplicated rAF logic).
- Delete `.conf-*` styles that no longer apply (mascot, gradient panel);
  reuse splash classes where they fit.
- The 6 sport keys map 1:1 to what was logged; use the already-selected
  `sport` getter — no new state.

## Out of scope

Achievement/avatar splashes (done previously), the watch-face video layers,
backend, missions.

## Verification

Playwright: log a running activity (video sport) and a daily-steps activity
(fallback path); screenshot both confirmation screens; confirm video element
present and playing (`!video.paused`), wash, count-up final values, pill text,
DONE button; zero page errors.
