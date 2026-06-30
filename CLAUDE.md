# Sport4You — Project Context

## What This Is
A NEOGOV take-home assignment: a full-stack Fitness Challenge application.
Users register, log physical activities, and earn normalized points across 6 sport types.
The app features a global leaderboard and a personal dashboard with charts.

## Tech Stack
- **Backend:** C# / ASP.NET Core Web API · Entity Framework Core · SQLite
- **Frontend:** Angular 17+ (standalone components) · Angular Material · Chart.js (ng2-charts)
- **Structure:** Monorepo — `backend/` and `frontend/` side by side

## Key Design Decisions
- **Layered architecture:** Controllers → Services → Repositories → EF Core
- **Points stored at write time** (not recalculated on read) for fast leaderboard queries
- **No authentication** — userId (GUID) acts as the user's token, stored in localStorage
- **Rank trend** computed by comparing current points vs. points from activities older than 7 days
- **ScoringService** is stateless and pure — no DB dependency, fully unit testable

## Sport → Metric Mapping
| Sport | Metric | Points Formula |
|-------|--------|---------------|
| Running | distance (km) | floor(km × 100) |
| Walking | distance (km) | floor(km × 50) |
| Cycling | distance (km) | floor(km × 25) |
| Swimming | duration (mm:ss) | floor(minutes × 15) |
| Gym | duration (mm:ss) | floor(minutes × 5) |
| Daily Steps | steps (integer) | floor(steps / 100) |

## API Endpoints
- `POST /api/users` — register user, returns userId
- `POST /api/activities` — log activity, returns points earned
- `GET /api/leaderboard` — ranked list with trend arrows
- `GET /api/users/{userId}/dashboard` — full dashboard data in one call

## Frontend Pages
- `/leaderboard` — ranked table with trend indicators
- `/dashboard` — hero points + line chart + donut chart + activity feed + streak indicator

## Design Spec
Full design doc at: `docs/superpowers/specs/2026-06-30-fitness-challenge-design.md`

## Developer Context
- Antonio is comfortable with C# backend; Angular is the weaker side
- Prefer clear, well-established patterns over clever solutions
- No hard deadline — build it right
