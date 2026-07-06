# Onboarding Spotlight Tour — Design

**Date:** 2026-07-07
**Status:** Approved (brainstorm)

## Purpose

A brand-new user, after passing the registration gate, lands on a feature-dense
app (leaderboard, dashboard, quests, achievements, shop, avatars, loot boxes,
rivals, weight, AI coach) with an empty account and no idea where to start. This
feature adds a **quick guided spotlight tour** that orients first-time users to
the app's navigation and ends by nudging them to take the one action that powers
everything: **logging their first activity**.

## Scope & decisions

- **Form:** interactive spotlight tour — dims the screen, highlights one real UI
  element at a time, advances via a "Next" button. (Not a slide carousel or a
  checklist.)
- **Range:** shell-only. Steps target only the always-present app shell (nav +
  the `+ LOG ACTIVITY` button), so the tour never drives the router or waits on
  lazy-loaded pages. The final step converts orientation into action.
- **Trigger:** new registrations only. Login/recovery and existing accounts
  never see it.
- **Out of scope:** multi-page walkthroughs, page-specific highlights (daily
  quests card, avatar locker), any backend change.

## Trigger & persistence

- `RegisterDialogComponent` sets `localStorage['s4y.tourPending'] = '1'`
  **only when `mode === 'register'`** (a genuine new sign-up), immediately before
  its existing `window.location.reload()`. Login/recovery does not set it.
- On the next load, `AppComponent` reads `s4y.tourPending`. If present, it
  **removes the flag first**, then starts the tour. Consuming the flag up front
  means the tour fires exactly once — a mid-tour refresh will not re-trigger it.
- No other persisted flag is required. The one-shot flag is the whole
  persistence model; the "?" replay button (below) starts the tour on demand
  without touching localStorage.

## Architecture

Two small, independently reasoned units:

### `TourService` (`shared/tour/tour.service.ts`)
Owns tour state and step definitions; contains no DOM logic.
- Holds the ordered `steps` list and a current-index.
- Exposes `start()`, `next()`, `back()`, `skip()`, `end()`, and an `activeStep`
  signal (`null` when the tour is inactive).
- `next()` past the last step calls the final step's action then `end()`.
- Fully unit-testable in isolation.

### `TourOverlayComponent` (`shared/tour/tour-overlay.component.ts`)
Rendered once via `<app-tour-overlay/>` in `AppComponent`. Subscribes to
`TourService.activeStep`. When a step is active it renders:
- a **full-screen dim + spotlight** layer, and
- a **callout card**: title, body, step counter (e.g. "3 / 5"), and
  Skip / Back / Next controls (Back hidden on step 1; Next shows the final
  step's action label, e.g. "Log an activity").

## Anchoring & spotlight technique

- Each step names one or more **CSS selectors** for its target
  (e.g. `.log-btn`, `[routerLink="/leaderboard"]`).
- **Responsive targeting:** the desktop sidebar and the mobile bottom-nav are
  different elements, so a step may list both selectors; the overlay picks the
  first **visible** match (`el.offsetParent !== null`).
- The overlay reads `getBoundingClientRect()` on the chosen target to position:
  - **Spotlight:** a transparent, rounded rectangle sized to the target with
    `box-shadow: 0 0 0 9999px rgba(8,16,34,.72)` — dims the whole app while
    punching a lit hole around the target.
  - **Callout:** positioned adjacent to the target (flips side to stay on-screen).
- The dim layer intercepts page clicks (interaction is driven by the callout
  buttons). Recompute positions on `window:resize`.

## Steps

Orientation building to the call-to-action; the `+ LOG ACTIVITY` button appears
exactly once, as the climax:

1. **Leaderboard** (nav) — "The global leaderboard — see how you rank against
   everyone."
2. **Home / Dashboard** (nav) — "Your dashboard: daily quests, stats, and charts."
3. **Badges / Shop / Avatars** (one combined step) — "Earn achievements, spend
   coins, and collect avatars." Anchors the spotlight on the **Badges** nav item
   (its neighbours Shop and Avatars sit right beside it); the copy covers all
   three so we keep the tour to five steps.
4. **Profile** (nav) — "Your public profile and personal records."
5. **+ LOG ACTIVITY** (nudge to act) — "Everything here is powered by logging
   activities — let's do your first one!" The Next button on this step **opens
   the Log Activity dialog** and ends the tour.

## Skip & replay

- **Skip** (button) and the **`Esc`** key end the tour immediately. Because the
  pending flag was already consumed at start, it will not reappear.
- A small **"?" help button** in the sidebar calls `TourService.start()` on
  demand, letting a returning user (or a reviewer) replay the tour anytime.

## Testing

- **Unit** (`tour.service.spec.ts`, runs in normal CI): step advancement via
  `next`/`back`, `skip`/`end` deactivation, one-shot `s4y.tourPending`
  consumption, and that the final `next` invokes the log-activity action.
- **Visual** (manual, in the running Docker app): spotlight aligns to targets on
  desktop sidebar and mobile bottom-nav, callout stays on-screen, Skip/`Esc`
  work, and the final step opens the Log Activity dialog. The overlay's DOM
  positioning cannot be headless-rendered in the current sandbox.

## Files

- **New:** `frontend/src/app/shared/tour/tour.service.ts`
- **New:** `frontend/src/app/shared/tour/tour-overlay.component.ts`
- **New:** `frontend/src/app/shared/tour/tour.service.spec.ts`
- **Edit:** `frontend/src/app/app.component.ts` — render `<app-tour-overlay/>`,
  consume `s4y.tourPending` on init to start the tour, add the "?" replay button.
- **Edit:** `frontend/src/app/shared/components/register-dialog/register-dialog.component.ts`
  — set `s4y.tourPending` on a new registration only.
