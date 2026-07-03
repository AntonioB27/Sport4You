# User Profile Screen — Design Spec
**Date:** 2026-07-03
**Phase:** 4b

---

## Overview

A `/profile/:userId` page that serves as both a public profile viewer and (for the logged-in user) a personal hub with avatar management. Replaces the leaderboard-click-to-dashboard flow and consolidates the standalone avatars page.

---

## Section 1: Navigation Changes

- The **AVATARS** nav link (sidebar + bottom nav) is replaced by **PROFILE**.
- PROFILE always navigates to `/profile/{myUserId}` (own profile).
- The `/avatars` route and `AvatarsComponent` are deleted. The avatar grid moves into the profile's AVATARS tab.
- The leaderboard's `viewDashboard()` method is renamed `viewProfile()` and navigates to `/profile/:userId` instead of setting `viewingUserId` in localStorage and pushing to `/dashboard`.
- The dashboard's `viewingUserId` localStorage read is removed — the dashboard is now only used for the logged-in user's own data view. (The dashboard route `/dashboard` remains; it always shows the logged-in user.)

---

## Section 2: Route

```
/profile/:userId
```

- Angular route with URL param `userId` (string / GUID).
- Loaded lazily from `ProfileComponent`.
- If `userId` matches `localStorage.getItem('userId')`, it is the own-profile view (tabbed). Otherwise it is the public view (OVERVIEW tab only).

---

## Section 3: Backend Changes — Add `rank` and `currentStreak` to Dashboard

`DashboardDto` gains two new fields:

```csharp
public int Rank { get; set; }
public int CurrentStreak { get; set; }
```

`DashboardService`:
- Injects `ILeaderboardService`. After building the dashboard, calls `GetLeaderboardAsync()` and finds the user's entry by `UserId` to populate `Rank`. If the user has no activities yet (not on the leaderboard), `Rank` is 0 (displayed as "—" on the frontend).
- Computes `CurrentStreak` using the existing `ActivityStreakHelper.ComputeCurrentStreak(activities.Select(a => a.DateTime))` — the activity list is already fetched at this point.

Frontend `DashboardData` interface gains `rank: number` and `currentStreak: number`.

---

## Section 4: ProfileComponent

**File:** `frontend/src/app/profile/profile.component.ts`

### Data loading

On `ngOnInit`, read `userId` from the route param. Call `GET /api/users/{userId}/dashboard` — this returns avatar, XP, points, streak, achievements, and rank in one request.

The AVATARS tab is lazy: call `GET /api/users/{userId}/avatars` only when the AVATARS tab is first selected (guarded by a `avatarsLoaded` flag).

### Own-profile detection

```typescript
get isOwnProfile(): boolean {
  return this.userId === localStorage.getItem('userId');
}
```

### Tabs

Two tab options rendered conditionally:

| Tab | Shown when |
|---|---|
| OVERVIEW | Always |
| AVATARS | `isOwnProfile` only |

Tab state: `activeTab: 'overview' | 'avatars' = 'overview'`.

---

## Section 5: OVERVIEW Tab Content

Layout — vertical stack, single column, max-width 640px centered:

### Hero card

- Active avatar image: 120px circle, border `3px solid #2E6BE6`, shadow glow. Fallback: first-initial badge (same style as leaderboard).
- Name: `FirstName LastName` — Chakra Petch, 28px, bold.
- Level badge: pill showing `Lv. {level} · {levelTitle}` — brand blue background.
- Stats row (3 chips side by side):
  - **Rank** — `#{rank}` or `—` if rank is 0
  - **Points** — formatted with commas
  - **Streak** — `{n} day streak` (from `data.currentStreak`)

### XP bar

Thin progress bar below the hero card showing `xpInLevel / xpForNextLevel`. Same style as the dashboard hero XP bar.

### Achievements showcase

- Section heading: "ACHIEVEMENTS"
- Display up to 6 earned achievements as icon chips (image + name). Uses the existing `achievementIconPath()` utility.
- If no achievements: subtle empty state ("No achievements yet").
- No "view all" link — the `/achievements` page remains for the full list.

### Earned avatars row (public view only)

Shown only when `!isOwnProfile`. A horizontal scroll row of unlocked avatar thumbnails (48px circles) — read-only, no equip buttons, no locked placeholders. If none unlocked: hidden.

---

## Section 6: AVATARS Tab (own profile only)

Full avatar grid — identical to the deleted `AvatarsComponent`:
- `GET /api/users/{userId}/avatars` loaded once on first tab open.
- Unlocked-first sort (by `unlockedAt` desc), then locked.
- Unlocked cards: full color, EQUIP button (disabled if already active, blue ring if active).
- Locked cards: greyed out (opacity 0.45, grayscale 0.7), no button.
- Equip action: `PUT /api/users/{userId}/avatar` — updates local state on success.

The stats pill (`N / 20 unlocked`) moves from the old avatars page header into the tab label: `AVATARS (N/20)`.

---

## Section 7: Error States

- Unknown `userId` (dashboard returns 404): show a simple "User not found" message, back button to leaderboard.
- Network error: snackbar "Failed to load profile. Please try again."

---

## Section 8: Files Changed

| Action | File |
|---|---|
| Create | `frontend/src/app/profile/profile.component.ts` |
| Delete | `frontend/src/app/avatars/avatars.component.ts` |
| Modify | `frontend/src/app/app.routes.ts` — add `/profile/:userId`, remove `/avatars` |
| Modify | `frontend/src/app/app.component.ts` — replace AVATARS nav with PROFILE |
| Modify | `frontend/src/app/leaderboard/leaderboard.component.ts` — `viewProfile()` navigates to `/profile/:userId` |
| Modify | `frontend/src/app/dashboard/dashboard.component.ts` — remove `viewingUserId` localStorage read |
| Modify | `frontend/src/app/shared/models/dashboard.model.ts` — add `rank: number` to `DashboardData` |
| Modify | `backend/Sport4You.Api/DTOs/DashboardDto.cs` — add `int Rank`, `int CurrentStreak` |
| Modify | `backend/Sport4You.Api/Services/DashboardService.cs` — inject `ILeaderboardService`, populate `Rank` and `CurrentStreak` |
| Test | `backend/Sport4You.Tests/DashboardControllerTests.cs` — verify `rank` field is returned |
