# Sport4You — Fitness Challenge Application

A full-stack fitness gamification app where users log physical activities, earn normalized points, and compete on a global leaderboard.

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

The API will be available at `http://localhost:5000`.

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

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users` | Register a new user |
| POST | `/api/activities` | Log a fitness activity |
| GET | `/api/leaderboard` | Get ranked leaderboard |
| GET | `/api/users/{id}/dashboard` | Get personal dashboard data |

## Scoring System

| Sport | Metric | Formula |
|-------|--------|---------|
| Running | km | floor(km × 100) |
| Walking | km | floor(km × 50) |
| Cycling | km | floor(km × 25) |
| Swimming | mm:ss | floor(minutes × 15) |
| Gym | mm:ss | floor(minutes × 5) |
| Daily Steps | count | floor(steps ÷ 100) |
