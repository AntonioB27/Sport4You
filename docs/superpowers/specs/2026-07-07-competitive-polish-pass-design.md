# Competitive Polish Pass Design

## Problem

A general review of common practices in comparable full-stack fitness/leaderboard
applications surfaced four polish/practice gaps in Sport4You that a senior reviewer opening
the repo would likely notice — none are feature gaps (the game layer here has no comparable
equivalent), just practice signals:

1. Frontend tests exist (12 cases across 3 spec files) but aren't run in CI.
2. Almost no Angular Signals usage (1 file) — notable specifically because Angular is this
   developer's stated weaker side, and signal-based state is the current idiomatic pattern.
3. No structured/request logging.
4. All 201 backend tests are real-DB integration tests; neither this codebase nor its
   test suite demonstrates isolating a unit under test via mocked dependencies.

(A fifth originally-identified gap — no `/api/health` endpoint — turned out to already be
covered: a liveness/DB-connectivity health check already exists in `Program.cs`, added by a
separate commit before this design was written. No action needed there.)

## Goal

Close the four gaps above with small, targeted changes, in priority order
(cheapest/highest-visibility first): CI wiring → Signals adoption → structured logging →
mocked unit tests.

## Constraint that shapes the Signals scope

Most page-level frontend files (`dashboard.component.ts`, `achievements.component.ts`,
`shop.component.ts`, `leaderboard.component.ts`, `profile.component.ts`, and others) are
**currently being edited by a separate, unrelated parallel session** doing a visual redesign.
Touching any of those files risks real collision (lost work, git conflicts, or corrupting a
half-finished redesign). The Signals work in this plan is therefore scoped **only** to files
confirmed clean in `git status` at design time: `user-state.service.ts`, `app.component.ts`,
and `today-steps-card.component.ts`. If, by the time this plan executes, any of those three
have since been touched by the other session, the implementing task should stop and flag it
rather than proceeding — the same caution already applied earlier in this session for
`dashboard.component.ts` and `app.component.ts`.

## Design

### 1. CI: run frontend tests

`frontend/karma-chrome-launcher` (already a devDependency) includes the `ChromeHeadless`
launcher; GitHub's `ubuntu-latest` runners ship Chrome preinstalled, so no new dependency or
browser install step is needed. Add a step to the existing `frontend-build` job in
`.github/workflows/ci.yml`, running before or after the build step:

```yaml
- name: Test
  run: npx ng test --no-watch --no-progress --browsers=ChromeHeadless
```

### 2. Angular Signals (scoped per the constraint above)

**`UserStateService`** — internal state moves from `BehaviorSubject<XpInfo | null>` to
`signal<XpInfo | null>(null)`, exposed as a `Signal<XpInfo | null>` via `.asReadonly()`. The
public `setXp(xp: XpInfo): void` method signature is **unchanged**, so
`dashboard.component.ts`'s existing call site (`this.userState.setXp(data.xp)`) needs no
edit — this is precisely what keeps the risky, actively-redesigned file untouched.

**`app.component.ts`** (the only other consumer, confirmed clean) — its template changes
from `@if (userState.xp$ | async; as xp)` to `@if (userState.xp(); as xp)` (Angular's `@if`
`as`-binding works directly against a signal invocation, no `async` pipe needed once the
underlying value is a signal rather than an Observable).

**`TodayStepsCardComponent`** (confirmed clean) — its two decorator-based I/O bindings
(`@Input() todaySteps`, `@Output() stepsAdded`) convert to the function-based signal APIs
(`input()`, `output()`), and its internal plain-property state (`displaySteps`, `entry`,
`loading`, `errorMsg`) converts to `signal()`s, with template bindings updated to call them
as functions. This is a small, fully self-contained example of a component built the current
idiomatic way, isolated from the redesign-affected files.

### 3. Structured logging (Serilog)

Add the `Serilog.AspNetCore` NuGet package to `Sport4You.Api`. In `Program.cs`, configure
Serilog to write to console, override the noisy `Microsoft.EntityFrameworkCore` and
`Microsoft.AspNetCore` categories to `Warning`, and add `app.UseSerilogRequestLogging()`:

```csharp
builder.Host.UseSerilog((context, configuration) => configuration
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console());
```

```csharp
app.UseSerilogRequestLogging();
```

### 4. Mocked unit tests (Moq)

Add the `Moq` NuGet package to `Sport4You.Tests` (the standard, most widely recognized .NET
mocking library). Add a new
test file, `ActivityServiceMockedTests.cs`, with true isolated unit tests against
`ActivityService.LogDailyStepsAsync` — mocking `IUserRepository`, `IActivityRepository`,
`IScoringService`, `IXpService`, `IAchievementService`, `IAvatarService`, and `ILootBoxService`
(`ActivityService`'s actual constructor dependencies) to verify the method orchestrates
scoring, XP awarding, mission evaluation, and streak-triggered loot-box awarding correctly,
without touching a real database. This is additive — it does not replace or duplicate the
existing real-DB integration tests for the same method; it demonstrates the complementary
"isolate the unit under test" testing style neither this codebase nor its test suite
currently shows.

## Non-Goals

- No signals conversion of any file currently touched by the parallel redesign session —
  if that constraint is violated by the time this executes, stop and flag rather than proceed.
- No wholesale RxJS→Signals migration across the frontend — scoped to the two files/one
  service named above.
- No replacement of existing integration tests with mocks — the new mocked tests are
  additive, covering a different testing style, not replacing coverage.
- No changes to `LeaderboardEntryDto`, any other DTO, or any existing passing test.

## Testing

- **CI wiring**: verified by the workflow itself running frontend tests successfully on push
  (no new test code — this task changes `ci.yml` only).
- **Signals**: this is a state-representation change with no new business logic — verified
  by `ng build` succeeding and a manual check that the sidebar XP widget and the steps card
  still render/update correctly (no new automated test needed beyond the existing ones that
  already exercise these components' behavior).
- **Structured logging**: verified by `dotnet test` still passing (Serilog must not break
  existing test host startup) and a manual check that request logs appear in console output
  when running the app locally.
- **Mocked unit tests**: the new tests themselves are the verification — they must pass, and
  the full existing suite (backend integration tests) must continue passing unchanged.
