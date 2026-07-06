# Sport4You — UI Reference

## Design Identity

**Theme:** "Light Arcade" — a gamified fitness tracker styled as a light-mode **arcade command deck**.
Angular, beveled "HUD" panels (clip-path corners rather than rounded radii), a recurring dark-navy
command bar, glowing lime accents, and the playful Spotry mascot. Every routed page shares one
visual language so navigating between them feels like moving through one console.

### Colours
| Token | Value | Usage |
|-------|-------|-------|
| Navy Dark | `#10203E` | Page text, headings |
| Command Navy | `#0f1e3b` | Dark command bar / HUD panels |
| Blue Primary | `#2E6BE6` | Active nav, CTA buttons, stat values |
| Blue Deep | `#173B92` | Hero / blue-panel gradient end |
| Neon Green | `#C6E63B` | Accent — XP bar, section bars, LOG button, rewards |
| Neon Green Dark | `#9ECF10` | Lime button gradient end, section accent bars |
| Neon Shadow | `#7c9c00` | Lime button 3D press shadow |
| Page BG | `#EEF3FB` | App background |
| Card BG | `#fff` | Beveled cards, sidebar |
| Card Border | `#E6ECF6` | Hairline inset border on bevels |
| Muted Text | `#8592ad` | Labels, secondary info |

### Fonts
| Family | Weights | Usage |
|--------|---------|-------|
| **Chakra Petch** | 400 / 500 / 600 / 700 | All headings, labels, numbers, buttons, nav — the "game" font |
| **Nunito** | 400 / 600 / 700 / 800 / 900 | Body copy, descriptions |

Both loaded from Google Fonts in `index.html`.

---

## Light Arcade Design System

The shared primitives live as **global (unscoped) classes in `src/styles.scss`** so any component
template can drop them in — Angular's emulated encapsulation scopes component styles but lets global
rules through. Prefer these over re-inventing card CSS per component.

### The bevel recipe (angular cards)
`clip-path` cuts the arcade corners but also clips away `box-shadow`, so cards are built as two nodes:

```html
<div class="s4y-fx">            <!-- outer: carries the drop-shadow via filter -->
  <div class="s4y-bevel"> … </div>  <!-- inner: surface + hairline border (INSET shadow) -->
</div>
```

- `.s4y-fx` / `.s4y-fx--blue` / `.s4y-fx--soft` — `filter: drop-shadow(…)` wrappers.
- `.s4y-bevel` — white surface, `clip-path` bevel (16 px), `inset 0 0 0 1px #E6ECF6` hairline border.
  Variants: `.s4y-bevel--sm` (12 px), `.s4y-bevel--dark` (navy HUD), `.s4y-bevel--blue` (blue hero).
- `.s4y-clip-8 / -12 / -16` — standalone corner clips for buttons, chips, media.

> **Why inset borders?** An inset shadow is painted inside the box and survives `clip-path`; a normal
> border/outer shadow would be sliced off at the beveled corners. Active/selected rings therefore use
> `box-shadow: inset 0 0 0 2px <color>` too.

### Dark command bar (page headers)
`.s4y-cbar-fx` > `.s4y-cbar` — the navy, beveled banner at the top of pages (Leaderboard, Avatars) and
the dashboard's player HUD. Inside: `.s4y-cbar-eyebrow` (lime-blue tracked label) + `.s4y-cbar-title`
(white, with a lime `.accent` span). On the dashboard it also holds the avatar conic-ring and the
angular stat chips (STREAK / POINTS / COINS / BOXES).

### Section-header accent
`.s4y-sec-head` > `.s4y-sec-title` ( `.s4y-sec-bar` glowing bar + `.s4y-sec-name` tracked label ) +
optional `.s4y-sec-sub` / `.s4y-sec-link`. Bar colour variants: default lime, `--gold`, `--orange`,
`--blue`. Where a full header markup is overkill, components add the same 3 px glowing bar as a
`::before` on the existing title row.

### Buttons
`.s4y-btn` — lime CTA with `clip-path` corners and a 3D press shadow (`0 4px 0 #7c9c00`, collapsing on
`:active`). Variants: `.s4y-btn--blue`, `.s4y-btn--ghost`. Disabled drops the shadow.

### What stays rounded (deliberate set-pieces)
Collectible/ceremony surfaces keep their crafted circular/rounded treatments so they read as "loot,"
not chrome: the **loot-box "Signal Vault" modal**, the **Log Activity watch dialog**, the
**achievement & shop rarity badge cards** (bronze/silver/gold frames + holo sweep), avatar
**portholes/medallions**, and the GitHub-style **contribution heatmap** squares.

### Mascot — Spotry
A blue water-bottle robot character. File: `frontend/src/assets/sporty_wave.png`.
Appears in two places:
- **Sidebar logo** — small (34 × 40 px), top of the sidebar nav.
- **Dashboard hero card** — large (160 × 190 px), floating with a CSS `floaty` animation (translateY + slight rotate, 4 s loop). A neon-green radial glow shadow sits beneath it.

Sport-specific mascot poses exist for the Log Activity confirmation overlay:
`sporty_running.png`, `sporty_walking.png`, `sporty_bike.png`, `sporty_swimming.png`, `sporty_weigth.png`, `sporty_wave.png` (daily steps fallback).

---

## Layout

### Desktop (> 768 px)
```
┌──────────────┬──────────────────────────────────────────┐
│   SIDEBAR    │                                          │
│   230 px     │           <router-outlet>                │
│   fixed      │           (page content)                 │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```
- Sidebar is `position: fixed`, a 230 px placeholder div pushes page content right.
- Page content starts with 26 px top / 30 px left padding via `.page`.

### Mobile (≤ 768 px)
```
┌──────────────────────────────────────────┐
│              <router-outlet>             │
│              (page content)              │
│                                 80px gap │
├───────┬──────────┬─────┬────────┬───────┤
│ HOME  │   RANK   │  +  │ BADGES │  ME   │
└───────┴──────────┴─────┴────────┴───────┘
```
- Sidebar hidden; bottom tab bar appears.
- Center `+` FAB (neon green, 52 px, `border-radius: 16px`) opens Log Activity.
- Content has 80 px bottom padding to clear the tab bar.

### Sidebar contents (desktop)
1. **Logo row** — Spotry image + "SPORT**4**YOU" wordmark (blue `4`).
2. **Nav items** — 🏠 Home, 🏆 Leaderboard. Active state: blue gradient pill with white text and a glow shadow.
3. **XP Widget** (bottom of nav area) — green-tinted card showing "NEXT LEVEL IN / 550 XP" with a neon progress bar. Currently hardcoded; intended to reflect live data.
4. **LOG ACTIVITY button** — neon green, full width, opens the Log Activity dialog.

---

## Pages

### `/dashboard` — Home ("Light Arcade" command deck)

A dark **command bar** spans the top, then a two-column grid (`1.5fr 1fr`) collapses to one column at
900 px. Level-up/prestige animations (hero glow, LV badge pop, XP flash, expanding ring) are preserved.

**Command bar (dark HUD):** avatar in a lime conic-ring, `PLAYER ONLINE` + `{firstName} // LVL N TITLE`,
and four angular stat chips — STREAK, POINTS, COINS (with a `⚡N` boost tag), and BOXES (pulsing red dot
+ clickable when boxes are pending, opening the Signal Vault modal).

**Left column:**

| Section | Description |
|---------|-------------|
| **Hero — Pilot Deck** | Blue beveled panel with a holo sweep. Avatar sits in a lime conic XP-ring; `{TITLE} CLASS` chip, large total points, segmented XP bar with tick overlay, LV badge, and a PRESTIGE button at max level. |
| **Core stats** | Three beveled tiles: **Global Rank** (blue `#N`), **This Week** (weekly point sum), **Activities** (count). |
| **Daily Missions** | Lime section accent + `N / 3 CLEARED`. Rows carry a left colour stripe by tier (easy lime / medium blue / hard orange); completed rows go lime with a check + "MISSION CLEARED". |
| **Step Core + Signal Vault** | Half-width pair. **Step Core** = white bevel with a lime conic step donut + `+ ADD`. **Signal Vault** = blue bevel with `OPEN VAULT` when boxes are ready, else a muted empty state. |

**Right column:** **Rankings** (top-4, own row lime-highlighted), **Duel** (rival VS card, orange accent),
**Vitals** (weight card — Chakra Petch header, KG/LB toggle, Chart.js line), **Combat Log** (last 6
activities), **Trophies** (recent achievements with tier strips + SEE ALL), and the **LOG ACTIVITY** CTA.

**Level system, streak, XP** are owned by the backend `XpService` and delivered on the dashboard DTO
(`xp.level`, `levelTitle`, `xpPercent`, `prestigeLevel`, …) — the UI never derives them from points.

The **rival/weight/steps cards are the `Duel`/`Vitals`/`Step Core` child components**
(`rival-card`, `weight-card`, `today-steps-card`), all restyled into the bevel language.

---

### `/leaderboard` — Leaderboard

Opens with the dark **command bar** header (`GLOBAL RANKINGS` / `LEADER·BOARD`). Podium, standings
list, "Your Standing" blue card, and Top Climbers are all beveled `s4y-fx` + `clip-path` panels.

**Podium (top 3):**
- Three cards arranged low-high-low (2nd left, 1st centre, 3rd right).
- 1st place: gold gradient card with 👑, taller gold bar beneath.
- 2nd place: silver card, 90 px bar.
- 3rd place: bronze card, 70 px bar.
- Each podium slot is clickable — navigates to that user's dashboard.

**Ranked list:**
- Grid: Rank chip | Athlete | Points | 7-day trend.
- Top-3 rows have a warm `#FDFAF0` background.
- Current user's row: green `#F4FBE3` highlight + "YOU" neon badge.
- Rank chips: gold / silver / bronze / default grey / green (for current user).
- Trend arrows: ↑ green, ↓ red, — grey.
- Clicking any row navigates to that user's dashboard.

**Viewing another user's dashboard:**
Clicking a leaderboard row sets `localStorage.viewingUserId`, redirects to `/dashboard`, which loads that user's data instead of the logged-in user's. `viewingUserId` is cleared immediately after reading.

---

### `/achievements` — Trophy Track

One large beveled **`.panel`** (angular clip-path, inset border) wrapping a dark HUD row (star tile,
`ACHIEVEMENTS` title, level + `N / total unlocked` count), a blue **spotlight** for the latest unlock,
and progression **rails** grouped into sections. Section titles carry the glowing lime accent bar
(added as a `::before`). The bronze/silver/gold **badge cards keep their crafted rarity frames + holo
sweep** — deliberately not beveled, so collectibles read differently from chrome.

### `/shop` — Shop

Same beveled `.panel` + dark HUD (coin balance) + blue featured **spotlight** as Trophy Track, with
lime section accents. Item tiles (`shop-item-card`) reuse the rarity-frame treatment and stay rounded;
the purchase-confirmation modal (`s4y-purchase-dialog`) is a ceremony set-piece and keeps its navy
radial card.

### `/avatars` — Avatars & Borders

Dark **command bar** header (`CUSTOMIZE` / `AVATARS · BORDERS`). Hosts the shared **`avatar-locker`**
(beveled panel, angular equipped-portrait, lime-accented locker rows; avatar portholes/medallions stay
circular) and a **Borders** grid of angular border cards — active = `inset 0 0 0 2px #2E6BE6` ring,
angular blue EQUIP buttons.

### `/profile/:userId` — Public profile

Beveled hero card (avatar, level badge, angular RANK/POINTS/STREAK stat chips, XP bar) plus beveled
sections (each wrapped in `.card-fx`): **Activity** (contribution heatmap), **Achievements** (chips),
and — own profile only — **Records** (`personal-records`, angular record tiles). Section titles use the
lime accent bar; the rival button is an angular blue button.

---

## Log Activity Dialog

Opened from: sidebar button (desktop), mobile FAB, and dashboard LOG ACTIVITY button.

### Appearance
Dark navy modal (540 px wide, `border-radius: 34px`). The Material dialog container is set to transparent via `.s4y-watch-dialog` panel class so the card's own styling shows through.

### Watch Face
A 326 × 326 px circular watch:
- **Bezel**: conic-gradient for a metallic look, inset shadow.
- **Tick ring**: repeating-conic-gradient, masked to show only the outer ring.
- **Strap hints**: rounded rectangles above and below the watch circle.
- **Crown + side button**: right-side decorative elements.
- **Face** (inner circle): two overlay layers (A/B) for transitions. Each layer has a sport-coloured gradient background. When sport videos are provided (`.mp4` files in `assets/videos/`), they play inside the face.

**Sport videos** (add to `assets/videos/` to activate):
| File | Sport |
|------|-------|
| `sporty_rn.mp4` | Running |
| `sporty_wlk.mp4` | Walking |
| `sporty_bk.mp4` | Cycling |
| `sporty_sw.mp4` | Swimming |
| `sporty_wl.mp4` | Gym |

**HUD overlays** (always visible on top of the face):
- Top pill: green dot + sport name in all-caps.
- Bottom: metric value + unit + `+N PTS` in neon green.

### Sport Navigation
`‹ ›` arrow buttons cycle through 6 sports. Dot indicator row below the watch shows current position (active dot is wide and neon green).

**Sports & scoring:**

| Sport | Key | Metric | Unit | Step | Points formula |
|-------|-----|--------|------|------|---------------|
| Running | `running` | Distance | km | 0.5 | floor(km × 100) |
| Walking | `walking` | Distance | km | 0.5 | floor(km × 50) |
| Cycling | `cycling` | Distance | km | 1 | floor(km × 25) |
| Swimming | `swimming` | Duration | min | 5 | floor(min × 15) |
| Gym | `gym` | Duration | min | 5 | floor(min × 5) |
| Daily Steps | `daily_steps` | Steps | steps | 500 | floor(steps / 100) |

Duration sports (swimming, gym) are submitted to the API as `"MM:SS"` format.

### World Morph transitions
Four transition styles exist in code but the picker UI is hidden — **Sweep is always active**. To re-enable the picker, uncomment the `<!-- World Morph picker -->` block in the dialog template.

| Style | Effect |
|-------|--------|
| Sweep | Sliding wipe left-to-right with a light-streak band |
| Iris | Circle clip-path expand from centre |
| Ripple | Blur/saturate dissolve |
| Portal | 3D rotateY flip |

### Amount input
Row with: label (`DISTANCE COMPLETED` etc.), text input (direct entry), unit label, `–` and `+` stepper buttons. The `+` button is blue, `–` is translucent. Input syncs with the HUD live.

### LOG button
Neon green, full-width. Label: `LOG {SPORT} · +{N} PTS`. Submits to `POST /api/activities`. On success triggers dashboard auto-refresh via `ActivityLoggedService`.

### Confirmation overlay
Appears over the card after successful submission:
- Blue gradient background with falling confetti particles (5 animated squares/circles).
- Spotry in sport-specific pose, floating with glow shadow.
- Large `+N` points number.
- Pill showing sport + metric logged.
- **DONE 🎉** button — closes the dialog and returns `{ points: N }` to the opener.

---

## Auto-refresh

`ActivityLoggedService` (RxJS `Subject<void>`) is the broadcast channel. When an activity is logged (from any entry point), it calls `notify()`. The dashboard subscribes in `ngOnInit` and calls `loadData()` on each emission, keeping stats, quests, and the activity feed current without a page reload.

---

## Auth model

No authentication. A user is identified by a GUID stored in `localStorage` under the key `userId`. On first visit (or after storage is cleared), a registration dialog opens automatically (`disableClose: true`). If the API returns 404 for a stored userId, localStorage is cleared and the registration dialog re-opens.
