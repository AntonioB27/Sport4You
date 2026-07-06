# Nav Bar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `app.component.ts`'s desktop sidebar and mobile bottom-nav to use the
app's new "game HUD" corner/glow language (beveled clip-path corners, lime-green glow
accents) instead of the original rounded-corner/flat-gradient look, with zero changes to
layout, links, or behavior.

**Architecture:** Pure CSS change inside `app.component.ts`'s existing `styles` array —
no new files, no template restructuring, no new Angular logic. Rounded corners become
clip-path bevels; `box-shadow` glows on clipped elements become `filter: drop-shadow(...)`
(box-shadow is clipped away by `clip-path`, but `filter` correctly follows the clipped
shape — this avoids needing extra wrapper `<div>`s around each nav item). The one new
visual element (the bottom-nav active-item glow accent) is added via a CSS `::after`
pseudo-element, so the template stays byte-for-byte unchanged.

**Tech Stack:** Angular 17 standalone component, inline component styles (no SCSS
changes, no shared style file — see Global Constraints).

## Global Constraints

- No changes to `styles.scss` — this redesign stays entirely inside
  `app.component.ts`'s own `styles` array (per spec: a separate in-flight session has
  unrelated changes in `styles.scss`).
- No new shared CSS/TS file for the clip-path primitives — duplicate the small set of
  rules directly in `app.component.ts`, matching the existing codebase convention where
  `dashboard.component.ts` and `shop.component.ts` each already duplicate their own
  copy of the `.bevel`/`.fx` clip-path pattern rather than sharing one.
- No changes to the sidebar's background color, width, layout, logo, or to any
  `routerLink`/`routerLinkActive` behavior — this is a shape/accent-language pass only.
- No changes to `.signout-btn` — it has no rounded corners to convert and is explicitly
  out of scope per the design spec.
- Design spec: `docs/superpowers/specs/2026-07-06-nav-bar-redesign-design.md`

---

### Task 1: Restyle the nav shell (sidebar, bottom-nav, XP widget, buttons)

**Files:**
- Modify: `frontend/src/app/app.component.ts:14-89` (the `styles` array only — the
  `template` and the `AppComponent` class body below it are untouched)

**Interfaces:**
- Consumes: nothing new — this task touches only CSS selectors that already exist and
  are already bound to the unchanged template (`.nav-item`, `.nav-item.active`,
  `.xp-widget`, `.log-btn`, `.bottom-nav-item`, `.bottom-nav-item.active`, `.bottom-fab`).
- Produces: nothing new for later tasks — this plan has a single task.

This is a pure CSS restyle with no new application logic, so there is no unit test to
write (see the design spec's Testing/Verification section: verification here is a
frontend build check plus a manual visual pass). The steps below replace the `styles`
array in place, then verify.

- [ ] **Step 1: Replace the `styles` array in `app.component.ts`**

Open `frontend/src/app/app.component.ts`. Replace the entire `styles: [` ... `` `]``
block (currently lines 14-89) with the following. Every selector name is unchanged from
the current file — only property values inside each rule change (rounded corners →
clip-path bevels; `box-shadow` glows on clipped elements → `filter: drop-shadow(...)`
so the glow isn't clipped away; `border` on clipped elements → `box-shadow: inset 0 0 0
1px` so the hairline edge still renders along the cut corners, matching the existing
`.bevel` convention already used in `dashboard.component.ts`). The
`.signout-btn`/`.sidebar-gap`/`.main-content`/`@media` rules and the `:host`/`.logo`
rules are copied through unchanged.

```typescript
  styles: [`
    :host { display: flex; min-height: 100vh; background: #EEF3FB; font-family: 'Nunito', system-ui, sans-serif; }

    .sidebar {
      width: 230px; background: #fff; border-right: 1px solid #E3EAF5;
      padding: 22px 16px; display: flex; flex-direction: column;
      position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
    }
    .logo { display: flex; align-items: center; gap: 10px; padding: 0 8px 20px; }
    .logo img { width: 34px; height: 40px; object-fit: contain; }
    .logo-text { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 18px; color: #10203E; letter-spacing: .3px; }
    .logo-text span { color: #2E6BE6; }

    .nav-items { display: flex; flex-direction: column; gap: 6px; }
    .nav-item {
      display: flex; align-items: center; gap: 12px; padding: 11px 14px;
      color: #5c6881;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px;
      text-decoration: none; transition: background .15s;
      clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
    }
    .nav-item:hover { background: #F4F6FB; }
    .nav-item.active {
      background: linear-gradient(150deg,#2E6BE6,#1B47AE); color: #fff;
      filter: drop-shadow(0 8px 14px rgba(46,107,230,.55)) drop-shadow(0 0 10px rgba(198,230,59,.55));
    }

    .xp-widget {
      margin-top: auto; padding: 16px;
      background: radial-gradient(120% 80% at 80% 0%, rgba(198,230,59,.35), transparent), #F4FBE3;
      box-shadow: inset 0 0 0 1px rgba(158,207,16,.5);
      clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
      text-align: center;
    }
    .xp-label { font-family: 'Chakra Petch', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: .1em; color: #5f7a00; }
    .xp-value { font-family: 'Chakra Petch', sans-serif; font-size: 26px; font-weight: 700; color: #10203E; }
    .xp-bar { height: 8px; border-radius: 999px; background: #e4eecb; margin-top: 8px; overflow: hidden; }
    .xp-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg,#8CE00E,#C6E63B); box-shadow: 0 0 10px rgba(198,230,59,.9); }

    .log-btn {
      margin-top: 14px; text-align: center;
      background: linear-gradient(150deg,#C6E63B,#9ECF10); color: #10203E;
      font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 14px; letter-spacing: .05em;
      padding: 13px;
      clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
      filter: drop-shadow(0 0 14px rgba(198,230,59,.5)) drop-shadow(0 4px 0 #7c9c00);
      cursor: pointer; border: none; width: 100%; transition: transform .1s, filter .1s;
    }
    .log-btn:hover { transform: translateY(-1px); filter: drop-shadow(0 0 18px rgba(198,230,59,.7)) drop-shadow(0 5px 0 #7c9c00); }
    .log-btn:active { transform: translateY(1px); filter: drop-shadow(0 0 10px rgba(198,230,59,.4)) drop-shadow(0 2px 0 #7c9c00); }

    .signout-btn {
      margin-top: 10px; width: 100%; background: transparent; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px;
      color: #9aa6bd; font-family: 'Chakra Petch', sans-serif; font-weight: 700;
      font-size: 11px; letter-spacing: .08em; transition: color .15s;
    }
    .signout-btn:hover { color: #e5484d; }

    .sidebar-gap { width: 230px; flex-shrink: 0; }
    .main-content { flex: 1; min-height: 100vh; min-width: 0; overflow-x: hidden; }

    .bottom-nav {
      display: none; position: fixed; bottom: 0; left: 0; right: 0;
      background: #fff; border-top: 1px solid #E3EAF5;
      padding: 10px 8px 20px; justify-content: space-between; align-items: center; gap: 8px; z-index: 100;
    }
    .nav-side { flex: 1 1 0; min-width: 0; display: flex; justify-content: space-around; align-items: center; gap: 4px; }
    .bottom-nav-item {
      position: relative;
      display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1 1 0; min-width: 0;
      color: #9aa6bd; font-family: 'Chakra Petch', sans-serif; font-weight: 700;
      font-size: 10px; letter-spacing: .05em; text-decoration: none; transition: color .15s; white-space: nowrap;
    }
    .bottom-nav-item.active { color: #2E6BE6; }
    .bottom-nav-item.active::after {
      content: ''; position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
      width: 18px; height: 3px; border-radius: 2px;
      background: #C6E63B; box-shadow: 0 0 8px rgba(198,230,59,.8);
    }
    .bottom-fab {
      width: 52px; height: 52px; margin-top: -28px;
      background: linear-gradient(150deg,#C6E63B,#9ECF10);
      clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
      filter: drop-shadow(0 0 16px rgba(158,207,16,.7));
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; color: #10203E; font-weight: 800; border: none; cursor: pointer;
    }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .sidebar-gap { display: none; }
      .main-content { padding-bottom: 80px; }
      .bottom-nav { display: flex; }
    }
  `],
```

Note what changed vs. the original file, selector by selector, so you can sanity-check
your edit against this list before moving on:
- `.nav-item`: `border-radius: 12px` removed, `clip-path` (8px cut) added.
- `.nav-item.active`: `box-shadow: 0 10px 20px -10px rgba(46,107,230,.7)` replaced with
  two stacked `filter: drop-shadow(...)` values (blue shadow + new lime glow) — `filter`
  is required here (not `box-shadow`) because `clip-path` clips `box-shadow` away but
  not `filter`.
- `.xp-widget`: `border-radius: 16px` removed, `border: 1px solid rgba(158,207,16,.5)`
  changed to `box-shadow: inset 0 0 0 1px rgba(158,207,16,.5)` (a `border` on a
  clip-path shape doesn't render along the cut corners; an inset `box-shadow` does —
  same technique `dashboard.component.ts`'s `.bevel` class already uses), `clip-path`
  (10px cut) added.
- `.log-btn`: `border-radius: 14px` removed, `clip-path` (10px cut) added; its two
  `box-shadow` states (default/hover/active) converted to `filter: drop-shadow(...)`
  pairs for the same clip-path reason as `.nav-item.active`.
- `.bottom-nav-item`: `position: relative` added (anchors the new `::after` accent).
- `.bottom-nav-item.active`: unchanged color, plus a new `::after` rule adds the small
  lime glow bar beneath the active icon/label — no template change needed.
- `.bottom-fab`: `border-radius: 16px` removed, `clip-path` (8px cut) added,
  `box-shadow: 0 0 22px rgba(158,207,16,.7)` converted to `filter: drop-shadow(0 0 16px
  rgba(158,207,16,.7))` for the same clip-path reason.
- `.signout-btn`, `.sidebar-gap`, `.main-content`, `.bottom-nav`, `.nav-side`,
  `.xp-label`, `.xp-value`, `.xp-bar`, `.xp-bar-fill`, `:host`, `.logo*`, the
  `@media` block: copied through with no changes.

- [ ] **Step 2: Build the frontend to confirm it compiles**

Run: `cd frontend && npx ng build --configuration development`
Expected: build succeeds with no new errors (pre-existing warnings from unrelated files
being edited by other in-flight work are not this task's concern — only confirm nothing
in `app.component.ts` itself fails to compile).

- [ ] **Step 3: Manual visual verification**

With `dotnet run --project backend/Sport4You.Api` and `ng serve` both running, open
`http://localhost:4200` and check, per the design spec's verification checklist:
- Desktop sidebar: the currently-active nav item (e.g. "HOME" on `/dashboard`) shows a
  beveled (cut-corner) shape, keeps its blue gradient fill, and now has a soft
  lime-green glow layered with the existing blue shadow. Inactive items show the same
  beveled shape at rest, with the existing light-grey hover fill still working on mouse
  hover.
- The XP widget (bottom of sidebar) shows the beveled shape with its existing lime
  gradient/hairline border look preserved (no border regression — the hairline should
  still be visible along the cut corners).
- The "+ LOG ACTIVITY" button shows the beveled shape and its lime glow is still
  clearly visible (not clipped away) — click it to confirm hover/active states still
  animate.
- Resize the browser below 768px width (or use devtools device mode): the sidebar
  hides and the bottom-nav appears. The floating "+" FAB button shows the beveled
  shape. The active bottom-nav item (e.g. "HOME") shows a small lime glow bar beneath
  its icon/label.
- Click through all six nav links (Home, Leaderboard, Badges, Shop, Avatars, Profile)
  on both desktop and mobile width, confirming the active-state styling correctly
  follows the current route each time (no `routerLinkActive` regressions).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "style: redesign nav bar with beveled corners and glow accents"
```
