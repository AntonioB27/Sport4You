# Fitness Challenge Application — Design Spec
**Date:** 2026-06-30  
**Project:** NEOGOV Take-Home Assignment  
**Stack:** C# / ASP.NET Core · Angular · SQLite · Entity Framework Core

---

## Overview

A full-stack fitness gamification app. Users register, log physical activities across 6 sport types, and earn normalized points. A global leaderboard ranks all users by total points. A personal dashboard visualizes activity trends and sport breakdowns with charts.

---

## Section 1: Project Structure

```
sport4you/
├── backend/
│   ├── Sport4You.Api/
│   │   ├── Controllers/      # HTTP layer only — delegates to Services
│   │   ├── Services/         # Business logic (scoring, validation)
│   │   ├── Repositories/     # Data access (EF Core queries)
│   │   ├── Models/           # EF Core entities
│   │   ├── DTOs/             # Request/response shapes
│   │   ├── Data/             # DbContext + migrations
│   │   └── Program.cs        # App bootstrap + DI wiring
│   └── Sport4You.Tests/      # xUnit unit tests
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── leaderboard/  # Global leaderboard page
│       │   ├── dashboard/    # Personal dashboard page
│       │   └── shared/       # Services, models, shared components
│       └── environments/
├── CLAUDE.md
└── README.md
```

**Principle:** Controllers are thin — receive HTTP, delegate to Services. Services hold all logic. Repositories handle DB queries. Swap SQLite for Postgres by only touching the Repository layer.

---

## Section 2: Database Schema

### Users
| Column    | Type | Constraints |
|-----------|------|-------------|
| Id        | GUID | PK |
| FirstName | TEXT | NOT NULL |
| LastName  | TEXT | NOT NULL |

Unique constraint on `(FirstName, LastName)`.

### Activities
| Column    | Type    | Constraints |
|-----------|---------|-------------|
| Id        | GUID    | PK |
| UserId    | GUID    | FK → Users.Id |
| DateTime  | TEXT    | ISO 8601 |
| Sport     | TEXT    | running / walking / cycling / gym / swimming / daily_steps |
| Distance  | REAL    | nullable — km |
| Duration  | TEXT    | nullable — "mm:ss" |
| Steps     | INTEGER | nullable |
| Points    | INTEGER | NOT NULL — pre-calculated at write time |

**Key decisions:**
- Points stored at ingestion time — leaderboard queries are simple `SUM GROUP BY`
- Exactly one metric column populated per row — enforced in Service layer
- No separate Leaderboard table — computed on the fly from Activities

---

## Section 3: API Design

### `POST /api/users`
```json
// Request
{ "firstName": "string", "lastName": "string" }

// Response 200
{ "userId": "guid" }

// Response 409
{ "error": "User with this name already exists" }
```

### `POST /api/activities`
```json
// Request
{
  "userId": "guid",
  "datetime": "2026-06-30T10:30:00Z",
  "sport": "running",
  "distance": 5.0
}

// Response 200
{ "activityId": "guid", "points": 500 }

// Response 400
{ "error": "Running requires a distance value" }
```

### `GET /api/leaderboard`
```json
// Response 200
[
  {
    "rank": 1,
    "userId": "guid",
    "firstName": "string",
    "lastName": "string",
    "totalPoints": 1500,
    "rankTrend": 2
  }
]
```
`rankTrend` = current rank minus rank computed using only activities older than 7 days. Positive = moved up.

### `GET /api/users/{userId}/dashboard`
```json
// Response 200
{
  "user": { "firstName": "string", "lastName": "string" },
  "totalPoints": 1500,
  "activities": [...],
  "pointsOverTime": [{ "date": "2026-06-30", "points": 300 }],
  "sportBreakdown": [{ "sport": "running", "points": 900 }]
}
```

---

## Section 4: Scoring Engine

Implemented as a stateless `ScoringService` — no DB dependency, fully unit testable.

### Conversion Rules
| Sport | Formula |
|-------|---------|
| Running | `floor(distance × 100)` |
| Walking | `floor(distance × 50)` |
| Cycling | `floor(distance × 25)` |
| Swimming | `floor(totalMinutes × 15)` |
| Gym | `floor(totalMinutes × 5)` |
| Daily Steps | `floor(steps / 100)` |

### Duration Parsing (`"mm:ss"`)
- Extract minutes, discard seconds entirely
- `"1:55"` → 1 minute
- `"0:59"` → 0 minutes → 0 points

### Validation Rules (→ 400 if violated)
| Sport | Required | Forbidden |
|-------|----------|-----------|
| running / walking / cycling | distance | duration, steps |
| gym / swimming | duration | distance, steps |
| (no sport) + steps present | steps | distance, duration |
| (no sport) + no steps | — | 400: cannot determine activity type |

Note: `steps` without a `sport` field implies daily steps (matching the assignment's API contract). Internally stored as sport = `"daily_steps"`.

---

## Section 5: Frontend Design

**Stack:** Angular 17+ (standalone components) · Angular Material · Chart.js via `ng2-charts`

### App Shell
- Top navbar: app name + "Leaderboard" / "My Dashboard" nav links
- Angular Router: `/leaderboard` and `/dashboard`
- First visit (no `userId` in `localStorage`) → registration modal

### Leaderboard (`/leaderboard`)
- Angular Material table: Rank · Name · Total Points · Trend
- Trend column: colored arrow (green ↑ / red ↓ / grey —) + numeric delta
- Clicking a user's name navigates to their dashboard

### Personal Dashboard (`/dashboard`)
- Hero number: total points
- **Line chart** — points per day over time
- **Donut chart** — points breakdown by sport
- **Activity feed** — scrollable list with date, sport, metric, points
- **Bonus: Streak indicator** — consecutive days with at least one logged activity

### Data Flow
- `ApiService` (shared) — single Angular service wrapping all HTTP calls
- HTTP errors → Material snackbar notification
- `userId` persisted in `localStorage`, read on app init

---

## Section 6: Error Handling & Testing

### Error Response Shape
```json
{ "error": "Human-readable message" }
```

### HTTP Status Codes
| Situation | Code |
|-----------|------|
| Invalid sport/metric combo | 400 |
| Missing required field | 400 |
| Malformed duration string | 400 |
| userId not found | 404 |
| Duplicate user name | 409 |
| Unexpected server error | 500 (generic message, no stack trace) |

Global exception middleware handles the 500 case.

### Testing
- `Sport4You.Tests` — xUnit
- `ScoringService` unit tests: all 6 sports, floor rounding edge cases, zero values, invalid duration strings
- Integration tests per endpoint using `WebApplicationFactory` (real pipeline, no mocks)
- Angular testing out of scope — time better spent on UI polish
