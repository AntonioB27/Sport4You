# Login by Name — Account Recovery Flow

**Date:** 2026-07-05
**Status:** Approved
**Scope:** Small additive feature. The assignment-mandated `POST /api/users`
contract (register with `{firstName, lastName}`, return userId, reject
duplicate names) stays byte-for-byte unchanged.

## Problem

The userId GUID in localStorage is the user's entire identity. Clearing
browser storage (or switching devices) orphans the account forever, even
though it still exists in the database. The assignment guarantees
firstName+lastName uniqueness, which means a name already IS a recoverable
identity — we just have no endpoint or UI to use it.

## Design

### Backend

One new endpoint on the existing `UsersController`:

- `POST /api/users/login` — body `{ firstName: string, lastName: string }`
  (same `RegisterUserRequest` shape).
  - Match found (case-insensitive, same comparison RegisterAsync uses):
    `200 { userId, firstName, lastName }`
  - No match: `404 { error: "No user found with that name." }`
  - Missing/blank fields: `400` (same validation as register)

`IUserService` gains `Task<User?> FindByNameAsync(string firstName, string
lastName)`. POST (not GET) keeps names out of URLs/logs and mirrors the
register request shape. No schema changes; no changes to any existing
endpoint.

### Frontend

The register dialog becomes a two-mode dialog (`register` | `login`):

1. **Register mode** (default, current look unchanged): name fields + JOIN
   button, plus a small link underneath: "Already have an account? Log back
   in".
2. **Login mode**: the same two name fields, button reads `WELCOME BACK`;
   calls the new login endpoint, stores `userId` in localStorage, closes the
   dialog and reloads data exactly like registration does today. 404 shows
   "No user found with that name." inline.
3. **Conflict rescue**: when register returns `409`, in addition to the
   current error message show a one-click "That's me — log back in" action
   that switches to login mode with the fields prefilled and submits.

No other UI changes. Logout (clearing localStorage) stays implicit —
out of scope.

## Out of scope

- Passwords, tokens, endpoint authorization of any kind (assignment
  contracts must remain anonymous). A full username+password+JWT variant
  will be built separately on branch `feature/auth` with its own spec, as a
  clearly-labeled bonus that never merges into the spec-compliant `main`.
- Showing the account id as a copyable recovery code (redundant once names
  are loginable).
- Rate limiting / abuse concerns — the app is intentionally auth-free per
  the assignment.

## Testing

Backend (xunit, existing patterns in `UsersControllerTests`):
- login with existing name returns 200 + the registered userId
- login is case-insensitive (matches register's comparison)
- login with unknown name returns 404
- login with missing fields returns 400
- register endpoint behavior unchanged (existing tests keep passing)

Frontend: Playwright — register a user, clear localStorage, reload, use
"Log back in" with the same name, confirm the dashboard loads the same
account (points/level intact); duplicate-register path shows the rescue
action and it works.
