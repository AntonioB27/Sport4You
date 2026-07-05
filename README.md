# Sport4You — Fitness Challenge Application

A full-stack fitness gamification app where users log physical activities, earn normalized points, and compete on a global leaderboard — wrapped in a full game layer: XP levels, daily quests, achievement badges, collectible avatars, loot boxes, and cosmetic profile borders.

## Tech Stack

- **Backend:** C# / ASP.NET Core 8 Web API · Entity Framework Core · SQLite
- **Frontend:** Angular 17 · Angular Material · Chart.js

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) and npm

## Running Locally

### 1. Start the backend

```bash
cd backend
dotnet run --project Sport4You.Api
```

The API will be available at `http://localhost:5262` (see `launchSettings.json`).

### 2. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
ng serve
```

Open `http://localhost:4200` in your browser.

### Running backend tests

```bash
cd backend
dotnet test
```

## Project Structure

```
sport4you/
├── backend/          # ASP.NET Core Web API
│   ├── Sport4You.Api/
│   └── Sport4You.Tests/
└── frontend/         # Angular SPA
```

## Features

**Core (per the assignment)**
- Register with first + last name, log activities across 6 sports, normalized points scoring
- Global leaderboard with rank trends
- Personal dashboard with activity history, points-over-time and sport-breakdown charts

**Game layer**
- **XP & levels** — every activity grants XP; level titles from Rookie upward, with level-up celebration animations
- **Daily quests** — three rotating missions per day (easy/medium/hard) with XP rewards and a completion sweep bonus
- **Achievements** — 33 badges across distance, duration, steps, streak, level, leaderboard, and one-time feats; browsable on a "Trophy Track" page with bronze→silver→gold progression rails, live progress, and rarity stats
- **Collectible avatars** — 20 unlockable Spotry skins (level/streak/badge/activity unlocks) equipped from a locker-room picker; the equipped avatar shows on the dashboard hero, leaderboard, and profile
- **Loot boxes** — earned on level-ups and completed missions; a video-driven "Signal Vault" opening ceremony with rarity-teased reveals (13 exclusive avatars + 6 profile borders, duplicates convert to XP)
- **Profile borders** — cosmetic rings from loot boxes, rendered around your avatar everywhere it appears
- **Daily steps** — dedicated per-day accumulating steps endpoint with a dashboard widget
- **Unlock ceremonies** — full-bleed animated splash screens for activity confirmation (sport video backgrounds), achievement unlocks, and avatar unlocks
- **Account recovery** — names are unique, so "log back in" by re-entering your name restores an account after clearing browser storage
- **Public profiles** — view any user's level, stats, badges, and earned avatars from the leaderboard

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users` | Register a new user |
| POST | `/api/users/login` | Recover an account by name |
| POST | `/api/activities` | Log a fitness activity |
| POST | `/api/users/{id}/steps` | Add steps to today's accumulating total |
| GET | `/api/leaderboard` | Get ranked leaderboard (with avatars, borders, trends) |
| GET | `/api/users/{id}/dashboard` | Get personal dashboard data |
| GET | `/api/users/{id}/achievements` | Achievement statuses with progress + XP summary |
| GET | `/api/users/{id}/avatars` | Avatar collection with unlock state |
| PUT | `/api/users/{id}/avatar` | Equip an avatar |
| GET | `/api/users/{id}/boxes` | Pending loot box count |
| POST | `/api/users/{id}/boxes/open` | Open a loot box |
| GET | `/api/users/{id}/borders` | Border collection |
| PUT | `/api/users/{id}/border` | Equip a profile border |

## Scoring System

| Sport | Metric | Formula |
|-------|--------|---------|
| Running | km | floor(km × 100) |
| Walking | km | floor(km × 50) |
| Cycling | km | floor(km × 25) |
| Swimming | mm:ss | floor(minutes × 15) |
| Gym | mm:ss | floor(minutes × 5) |
| Daily Steps | count | floor(steps ÷ 100) |

## Bonus: Full Auth Variant

`main` intentionally keeps the assignment's anonymous API contracts
(name-only registration, unauthenticated ingestion). A full
username/password/JWT variant — register/login pages, bearer-protected
write endpoints, logout — lives on branch
[`feature/auth`](../../tree/feature/auth). It changes the registration
contract, which is why it is kept out of `main` by design. When running
that branch for the first time, delete `backend/Sport4You.Api/sport4you.db`
so the new schema seeds (demo accounts: `maria` / `demo1234`).
