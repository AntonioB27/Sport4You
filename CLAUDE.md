# Sport4You — Project Context

## What This Is
A NEOGOV take-home assignment: a full-stack Fitness Challenge application.
Users register, log physical activities, and earn normalized points across 6 sport types,
competing on a global leaderboard. On top of the required core sits a full game layer:
XP levels, daily quests, achievements, collectible avatars, loot boxes, and profile borders.

**The assignment's API contracts are sacred on `main`**: `POST /api/users` (register with
firstName/lastName, unique names) and `POST /api/activities` (unauthenticated, userId in body)
must keep their exact shapes — the assignment PDF lives at
`../NEOGOV Take-Home Assignment.pdf`. Anything that would break those contracts goes on a
separate branch (see `feature/auth` below).

## Tech Stack
- **Backend:** C# / ASP.NET Core 8 Web API · Entity Framework Core · SQLite
- **Frontend:** Angular 17+ (standalone components) · Angular Material · Chart.js (ng2-charts)
- **Structure:** Monorepo — `backend/` and `frontend/` side by side

## Key Design Decisions
- **Layered architecture:** Controllers → Services → Repositories → EF Core
- **Points stored at write time** (not recalculated on read) for fast leaderboard queries
- **No authentication on `main`** — userId (GUID) acts as the user's token, stored in
  localStorage; account recovery works by re-entering the (unique) name via
  `POST /api/users/login`
- **Rank trend** computed by comparing current points vs. points from activities older than 7 days
- **ScoringService** is stateless and pure — no DB dependency, fully unit testable
- **Rewards evaluated on write:** logging an activity evaluates XP, missions, achievements,
  avatars, and loot-box grants in one pipeline; the response carries everything newly unlocked
  so the frontend can play its ceremony queue
- **Daily steps** go through their own accumulating endpoint (`POST /users/{id}/steps`), NOT
  `/api/activities` — sending `sport: "daily_steps"` there is rejected

## Sport → Metric Mapping
| Sport | Metric | Points Formula |
|-------|--------|---------------|
| Running | distance (km) | floor(km × 100) |
| Walking | distance (km) | floor(km × 50) |
| Cycling | distance (km) | floor(km × 25) |
| Swimming | duration (mm:ss) | floor(minutes × 15) |
| Gym | duration (mm:ss) | floor(minutes × 5) |
| Daily Steps | steps (integer) | floor(steps / 100) |

## Game Layer
- **XP & levels** — `XpService` owns XP grants, level thresholds/titles, mission state, and
  loot-box awards (level-ups and completed missions each grant a box)
- **Daily quests** — 3 seeded missions/day (easy/medium/hard) + sweep bonus
- **Achievements** — 33 seeded badges; `GET /users/{id}/achievements` returns an envelope
  `{ xp, achievements }` where each achievement carries `progress`, `requirementValue`, and
  `ownedByPercent`; the frontend "Trophy Track" page renders bronze→silver→gold rails
- **Avatars** — 20 unlock-path Spotry skins + 13 loot-box exclusives
  (`assets/avatars/`, `assets/avatars/loot-box/`); picker is the "Locker Select" in the
  profile's AVATARS tab; equipped avatar renders on dashboard hero, leaderboard, profile
- **Loot boxes** — "Signal Vault" modal (`loot-box/loot-box-modal.component.ts`): idle crate
  video loops, the rarity burst video is chosen after the API responds, and the cut happens on
  the idle loop boundary (all clips share a keyframe — `design/lootbox-keyframe.png` is the
  master reference for regenerating them). Rarity chrome stays neutral until the roll is known
- **Borders** — cosmetic rings (CSS border strings stored per border); equipped ring is served
  as `activeBorderCss` on leaderboard entries and the dashboard DTO
- **Ceremony splashes** — activity confirmation (sport video background), achievement, and
  avatar unlock splashes share the full-bleed splash language (see `UnlockSplashComponent`)

## API Endpoints
- `POST /api/users` — register (assignment contract), `POST /api/users/login` — recover by name
- `POST /api/activities` — log activity (assignment contract), `POST /api/users/{id}/steps` — daily steps
- `GET /api/leaderboard` — ranked list with trends, avatar thumbs, border CSS
- `GET /api/users/{id}/dashboard` — everything the dashboard needs in one call
- `GET /users/{id}/achievements` · `GET/PUT avatars|avatar` · `GET boxes` ·
  `POST boxes/open` · `GET borders` · `PUT border`

## Frontend Pages
- `/leaderboard` — podium + ranked table (public)
- `/dashboard` — hero card, quests, steps widget, leaderboard snippet, feeds
- `/achievements` — Trophy Track badge page
- `/profile/:userId` — public profile; own profile adds AVATARS (locker) and borders

## Branches & Worktrees
- `main` — spec-compliant, always deployable
- `feature/auth` — bonus username/password/JWT variant (checked out in the
  `../sport4you-auth` worktree); intentionally never merged; delete `sport4you.db` on first
  run there (demo login `maria`/`demo1234`)

## Process Conventions
- Design specs in `docs/superpowers/specs/`, implementation plans in `docs/superpowers/plans/`
  (dated files); SDD progress ledger at `.superpowers/sdd/progress.md`
- Visual designs come from the Claude Design project (`f176e8f8-…`) — variants referenced by
  badge ("2a") and implemented against real data
- Multiple Claude sessions often work this repo in parallel — check `git status`/branch before
  assuming tree state, and expect the ledger and briefs in `.superpowers/sdd/` to be shared

## Gotchas
- The Angular dev server does NOT pick up newly created asset folders/files — restart
  `ng serve` after adding anything under `src/assets/`
- Asset images: avatars/achievements are 512×512; keep new ones at that size (4K generator
  output must be downscaled — `sips -Z 512`)
- Seeder only runs on empty tables — changing seed data requires deleting the affected rows
  (or `sport4you.db`) before restart
- When committing image renames under `assets/`, make sure the binaries are actually staged —
  a seeder/DB rename without the files 404s every reveal

## Developer Context
- Antonio is comfortable with C# backend; Angular is the weaker side
- Prefer clear, well-established patterns over clever solutions
- No hard deadline — build it right
