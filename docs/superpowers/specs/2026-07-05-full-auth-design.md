# Full Auth (username + password + JWT) — `feature/auth` branch

**Date:** 2026-07-05
**Status:** Draft for review
**Scope:** Lives exclusively on branch `feature/auth` as a clearly-labeled
bonus. Never merges into `main` — `main` keeps the assignment-mandated
anonymous contracts (see `2026-07-05-login-by-name-design.md`).

## Goal

Real, recoverable accounts: register with username+password, log in from any
device, and stop trusting raw userIds for write operations.

## Backend

### Data model

`User` gains:
- `Username` (string, unique index, lowercase-normalized on write)
- `PasswordHash` (string) — hashed with ASP.NET's `PasswordHasher<User>`
  (PBKDF2; package `Microsoft.Extensions.Identity.Core`)

Dev DB is reset when switching to this branch (delete `sport4you.db`; the
schema comes from `EnsureCreated`). The seeder gives demo users usernames
(`maria`, `luca`, `james`, …) all with password `demo1234` so the
leaderboard stays populated and any demo account is loginable.

### Endpoints

New `AuthController` (`/api/auth`):
- `POST /api/auth/register` — `{ firstName, lastName, username, password }`
  → `200 { token, userId, username, firstName, lastName }`.
  `409` on duplicate username (first/last name uniqueness rule is dropped on
  this branch — username is the identity). `400` on missing fields or
  password shorter than 6 chars.
- `POST /api/auth/login` — `{ username, password }` → `200` same payload,
  `401 { error: "Invalid username or password." }` on failure (same message
  for unknown user vs wrong password — no user enumeration).

JWT: HS256, dev signing key + issuer in `appsettings.json`, 7-day expiry,
claims: `sub` = userId, `name` = username. Package
`Microsoft.AspNetCore.Authentication.JwtBearer`. Auth middleware registered
in `Program.cs`.

Removed on this branch: `POST /api/users` (name-only register) and
`POST /api/users/login` (login-by-name) plus their tests — replaced by the
auth endpoints.

### Authorization policy

- **Writes require auth + ownership.** `[Authorize]` on:
  `POST /api/activities` (body userId must equal token sub → else `403`),
  `PUT /users/{userId}/avatar`, `PUT /users/{userId}/border`,
  `POST /users/{userId}/boxes/open` (route userId must equal token sub →
  else `403`).
- **Reads stay anonymous.** Leaderboard, dashboard, achievements, avatars,
  borders, boxes GETs — the profile page intentionally shows other users'
  public data, and the app's read model is public by design.

## Frontend

- **`/login` page** (new route, standalone component, Spotry-styled like the
  panels elsewhere): login form (username, password) with a toggle to the
  register form (first name, last name, username, password). On success:
  store `token` + `userId` in localStorage, navigate to `/dashboard`.
- **HTTP interceptor** attaches `Authorization: Bearer <token>` to every API
  request; on a `401` response it clears storage and redirects to `/login`.
- **Route guard** on dashboard/badges/profile: no token → redirect `/login`.
  Leaderboard stays viewable logged-out; its "you" highlight simply doesn't
  apply.
- **Logout** button at the bottom of the sidebar nav: clears storage,
  navigates to `/login`.
- The register dialog (and its login-by-name mode) is removed from the app
  boot flow on this branch; `/login` is the entry.

## Testing

- Auth endpoints: register→login round trip, duplicate username 409, bad
  password 401, unknown user 401 (same message), short password 400.
- Authorization: activity POST without token → 401; with token for another
  user's id → 403; with matching token → 200.
- Reads remain anonymous: leaderboard + dashboard GET without token → 200.
- Existing suite adapted: test helpers register via `/api/auth/register` and
  attach the returned bearer token where needed.
- Playwright: register via /login page → log activity → logout → login from
  clean storage → same account.

## Process

Built in a git worktree (`../sport4you-auth`) so the `main` working tree
stays untouched for parallel sessions. Verification servers run on alternate
ports (API 5263, frontend 4201). A final commit on `main` adds a README
pointer: "Bonus: full auth variant on branch `feature/auth`".
