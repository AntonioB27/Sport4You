# Sport4You — UI Reference

## Design Identity

**Theme:** "Playful Pro" — gamified fitness tracker with a dark-navy + neon-green palette and a playful mascot (Spotry).

### Colours
| Token | Value | Usage |
|-------|-------|-------|
| Navy Dark | `#10203E` | Page text, headings |
| Navy Card | `#12213f → #0e1a34` | Watch dialog background |
| Blue Primary | `#2E6BE6` | Active nav, CTA buttons, stat values |
| Blue Deep | `#173B92` | Hero card gradient end |
| Neon Green | `#C6E63B` | Accent — XP bar, active dots, LOG button, quest rewards |
| Neon Green Dark | `#9ECF10` | LOG button gradient end |
| Neon Shadow | `#7c9c00` | LOG button 3D press shadow |
| Page BG | `#EEF3FB` | App background |
| Card BG | `#fff` | Dashboard cards, sidebar |
| Border | `#E3EAF5` | Sidebar border, card dividers |
| Muted Text | `#8592ad` | Labels, secondary info |

### Fonts
| Family | Weights | Usage |
|--------|---------|-------|
| **Chakra Petch** | 400 / 500 / 600 / 700 | All headings, labels, numbers, buttons, nav — the "game" font |
| **Nunito** | 400 / 600 / 700 / 800 / 900 | Body copy, descriptions |

Both loaded from Google Fonts in `index.html`.

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

### `/dashboard` — Home

Two-column grid (`1.55fr 1fr`), collapses to single column at 900 px.

**Left column:**

| Section | Description |
|---------|-------------|
| **Top bar** | "WELCOME BACK" + "Hi, {firstName} 👋". Right side shows 🔥 streak badge (hidden when streak = 0) and 🪙 total points badge. |
| **Hero card** | Blue gradient card. Level badge (`⚡ LEVEL N · TITLE`), total points (large), "TOTAL POINTS" label, XP progress bar (`0 XP → next level`). Spotry mascot floats in the top-right corner. |
| **Stat tiles** | Three tiles: **Global Rank** (blue `#N`), **This Week** (weekly point sum), **Activities** (total activity count). |
| **Today's Quests** | Three quests with progress bars. Quest 1: logged activity today. Quest 2: streak alive. Quest 3: 5,000 steps today. Completed quests show a green checkmark icon and "COMPLETE" label. |

**Right column:**

| Section | Description |
|---------|-------------|
| **Leaderboard preview** | Top 4 global users. User's own row has a green `#F4FBE3` highlight and a "YOU" badge. |
| **Recent Activity** | Last 6 activities. Each row: sport emoji + coloured icon, sport name + metric, date, `+N` points in blue. Empty state: "No activities yet — start logging!" |
| **LOG ACTIVITY** | Neon green button at bottom; opens Log Activity dialog. On confirm, dashboard refreshes automatically. |

**Level system** (derived from `totalPoints`):

| Level | Title | Points required |
|-------|-------|----------------|
| 1 | ROOKIE | 0 |
| 2 | JOGGER | 500 |
| 3 | ATHLETE | 1 500 |
| 4 | ELITE | 3 500 |
| 5 | CHAMPION | 7 500 |
| 6 | LEGEND | 15 000 |

**Streak** — counted by checking consecutive calendar days with at least one activity (today counts if there's an activity today, yesterday continues the chain).

---

### `/leaderboard` — Leaderboard

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
