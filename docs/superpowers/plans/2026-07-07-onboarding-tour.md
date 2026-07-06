# Onboarding Spotlight Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quick, one-time guided spotlight tour that orients new users to the app's navigation and ends by nudging them to log their first activity.

**Architecture:** A DOM-free `TourService` (signals) owns step data + navigation + the one-shot trigger flag. A `TourOverlayComponent` renders the dim/spotlight/callout by measuring targets via `getBoundingClientRect()`. The registration dialog sets a `localStorage` flag on new sign-ups; `AppComponent` consumes it on the next load to auto-start the tour, and hosts a "?" replay button.

**Tech Stack:** Angular 17 standalone components, signals, Angular Material dialog (existing). No new dependencies.

## Global Constraints

- Frontend lives in `frontend/`; all paths below are relative to `frontend/src/app/` unless stated.
- Angular 17 standalone components only (no NgModules). Use signals (`signal`, `computed`, `effect`).
- Trigger flag key is exactly `s4y.tourPending` (matches the existing `userId` localStorage convention).
- Tour fires for **new registrations only** — never on login/recovery or for existing accounts.
- Do NOT change any backend code or the assignment's API contracts.
- **Test runner note:** this repo's frontend unit tests use Karma + Chrome (`ng test`), which cannot run in the sandbox (no Chrome). In the sandbox, the runnable gate is `npm run build` (compile/type check); the Jasmine spec in Task 1 is written to run in CI/local `ng test`. Visual behaviour is verified manually in the running Docker app.

---

### Task 1: TourService (state + step data + one-shot flag)

**Files:**
- Create: `frontend/src/app/shared/tour/tour.service.ts`
- Test: `frontend/src/app/shared/tour/tour.service.spec.ts`

**Interfaces:**
- Produces:
  - `export const TOUR_PENDING_KEY = 's4y.tourPending'`
  - `export interface TourStep { selectors: string[]; title: string; body: string; nextLabel?: string; }`
  - `export interface ActiveStep { step: TourStep; index: number; total: number; isFirst: boolean; isLast: boolean; }`
  - `class TourService` with: `readonly activeStep: Signal<ActiveStep | null>`, `start(onComplete?: () => void): void`, `next(): void`, `back(): void`, `skip(): void`, `end(): void`, `consumePending(): boolean`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/shared/tour/tour.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { TourService, TOUR_PENDING_KEY } from './tour.service';

describe('TourService', () => {
  let svc: TourService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    svc = TestBed.inject(TourService);
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it('is inactive until started', () => {
    expect(svc.activeStep()).toBeNull();
  });

  it('start() activates the first step', () => {
    svc.start();
    const a = svc.activeStep();
    expect(a?.index).toBe(0);
    expect(a?.isFirst).toBeTrue();
    expect(a!.total).toBeGreaterThan(1);
  });

  it('next() advances through steps', () => {
    svc.start();
    svc.next();
    expect(svc.activeStep()?.index).toBe(1);
  });

  it('back() is a no-op on the first step', () => {
    svc.start();
    svc.back();
    expect(svc.activeStep()?.index).toBe(0);
  });

  it('next() on the last step runs onComplete and ends the tour', () => {
    const spy = jasmine.createSpy('onComplete');
    svc.start(spy);
    const total = svc.activeStep()!.total;
    for (let i = 0; i < total - 1; i++) svc.next(); // reach last step
    expect(svc.activeStep()?.isLast).toBeTrue();
    svc.next(); // advance past last
    expect(svc.activeStep()).toBeNull();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('skip() ends the tour without calling onComplete', () => {
    const spy = jasmine.createSpy('onComplete');
    svc.start(spy);
    svc.skip();
    expect(svc.activeStep()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('consumePending() returns true once and clears the flag', () => {
    localStorage.setItem(TOUR_PENDING_KEY, '1');
    expect(svc.consumePending()).toBeTrue();
    expect(svc.consumePending()).toBeFalse();
    expect(localStorage.getItem(TOUR_PENDING_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx ng test --watch=false --browsers=ChromeHeadless` (CI/local only).
Expected: FAIL — `Cannot find module './tour.service'`.
Sandbox fallback: skip running; proceed (the service does not yet exist, so it cannot compile).

- [ ] **Step 3: Write the service**

Create `frontend/src/app/shared/tour/tour.service.ts`:

```ts
import { Injectable, Signal, computed, signal } from '@angular/core';

/** localStorage flag set by the register dialog on a new sign-up; consumed once on next load. */
export const TOUR_PENDING_KEY = 's4y.tourPending';

export interface TourStep {
  /** Candidate CSS selectors, ordered; the overlay spotlights the first VISIBLE match. */
  selectors: string[];
  title: string;
  body: string;
  /** Label for the advance button (defaults to 'Next'). */
  nextLabel?: string;
}

export interface ActiveStep {
  step: TourStep;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
}

@Injectable({ providedIn: 'root' })
export class TourService {
  // Shell-only tour: orientation building to the log-activity call-to-action.
  // Each nav step lists the desktop sidebar selector first, then the mobile bottom-nav.
  private readonly steps: TourStep[] = [
    {
      selectors: ['a.nav-item[href="/leaderboard"]', 'a.bottom-nav-item[href="/leaderboard"]'],
      title: 'Global leaderboard',
      body: 'See how you rank against everyone. Points from every sport are normalized so all activities compete fairly.',
    },
    {
      selectors: ['a.nav-item[href="/dashboard"]', 'a.bottom-nav-item[href="/dashboard"]'],
      title: 'Your dashboard',
      body: 'Your personal home: daily quests, stats, and charts of your activity over time.',
    },
    {
      selectors: ['a.nav-item[href="/achievements"]', 'a.bottom-nav-item[href="/achievements"]'],
      title: 'Badges, shop & avatars',
      body: 'Earn achievements, spend coins in the shop, and collect avatars to show off on the leaderboard.',
    },
    {
      selectors: ['a.nav-item[href^="/profile/"]', 'a.bottom-nav-item[href^="/profile/"]'],
      title: 'Your profile',
      body: 'Your public profile and personal records — visible to other players from the leaderboard.',
    },
    {
      selectors: ['.log-btn', '.bottom-fab'],
      title: 'Log your first activity',
      body: 'Everything here is powered by logging activities. Let’s do your first one!',
      nextLabel: 'Log an activity',
    },
  ];

  private readonly index = signal(-1);
  private onComplete?: () => void;

  readonly activeStep: Signal<ActiveStep | null> = computed(() => {
    const i = this.index();
    if (i < 0 || i >= this.steps.length) return null;
    return {
      step: this.steps[i],
      index: i,
      total: this.steps.length,
      isFirst: i === 0,
      isLast: i === this.steps.length - 1,
    };
  });

  /** Begins the tour at step 0. `onComplete` runs only if the user finishes the last step. */
  start(onComplete?: () => void): void {
    this.onComplete = onComplete;
    this.index.set(0);
  }

  next(): void {
    const i = this.index();
    if (i < 0) return;
    if (i >= this.steps.length - 1) {
      const done = this.onComplete;
      this.end();
      done?.();
    } else {
      this.index.set(i + 1);
    }
  }

  back(): void {
    const i = this.index();
    if (i > 0) this.index.set(i - 1);
  }

  skip(): void {
    this.end();
  }

  end(): void {
    this.index.set(-1);
    this.onComplete = undefined;
  }

  /** True exactly once if a new-registration flag is pending; clears it. */
  consumePending(): boolean {
    if (localStorage.getItem(TOUR_PENDING_KEY)) {
      localStorage.removeItem(TOUR_PENDING_KEY);
      return true;
    }
    return false;
  }
}
```

- [ ] **Step 4: Verify it compiles (sandbox gate) / passes (CI)**

Run: `cd frontend && npm run build`
Expected: `Application bundle generation complete.` with no errors.
CI: `npx ng test --watch=false --browsers=ChromeHeadless` → all `TourService` specs PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/shared/tour/tour.service.ts frontend/src/app/shared/tour/tour.service.spec.ts
git commit -m "feat: TourService — onboarding tour state, steps, and one-shot trigger flag"
```

---

### Task 2: TourOverlayComponent (dim + spotlight + callout)

**Files:**
- Create: `frontend/src/app/shared/tour/tour-overlay.component.ts`

**Interfaces:**
- Consumes: `TourService` (`activeStep`, `next`, `back`, `skip`), `TourStep`/`ActiveStep` from Task 1.
- Produces: `class TourOverlayComponent` with selector `app-tour-overlay` (used by Task 3).

- [ ] **Step 1: Write the component**

Create `frontend/src/app/shared/tour/tour-overlay.component.ts`:

```ts
import { Component, HostListener, signal } from '@angular/core';
import { TourService } from './tour.service';

@Component({
  selector: 'app-tour-overlay',
  standalone: true,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 2000; pointer-events: none; font-family: 'Nunito', system-ui, sans-serif; }

    /* Transparent full-screen catcher blocks page interaction; tour advances via buttons. */
    .catcher { position: fixed; inset: 0; pointer-events: auto; }

    /* The lit "hole": its huge box-shadow dims everything around the target. */
    .spotlight {
      position: fixed; border-radius: 14px; pointer-events: none;
      box-shadow: 0 0 0 9999px rgba(8,16,34,.72);
      transition: top .2s ease, left .2s ease, width .2s ease, height .2s ease;
    }

    .callout {
      position: fixed; width: 280px; max-width: 90vw; pointer-events: auto;
      background: #fff; color: #10203E; padding: 18px 18px 14px;
      clip-path: polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);
      box-shadow: 0 30px 60px rgba(8,16,34,.5);
    }
    .callout h3 { margin: 0 0 6px; font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 16px; }
    .callout p { margin: 0 0 14px; font-size: 13.5px; color: #5c6881; line-height: 1.5; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .count { font-size: 12px; color: #9aa6bd; font-weight: 700; letter-spacing: .05em; }
    .btns { display: flex; gap: 8px; }
    button { font-family: 'Chakra Petch', sans-serif; font-weight: 700; font-size: 12.5px; cursor: pointer; border: none; padding: 8px 12px;
      clip-path: polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px); }
    .skip { background: transparent; color: #9aa6bd; }
    .back { background: #EEF3FB; color: #5c6881; }
    .next { background: linear-gradient(150deg,#2E6BE6,#1B47AE); color: #fff; }
  `],
  template: `
    @if (tour.activeStep(); as active) {
      <div class="catcher"></div>
      @if (rect(); as r) {
        <div class="spotlight"
             [style.top.px]="r.top - 6" [style.left.px]="r.left - 6"
             [style.width.px]="r.width + 12" [style.height.px]="r.height + 12"></div>
      }
      <div class="callout" [style.top.px]="calloutTop()" [style.left.px]="calloutLeft()">
        <h3>{{ active.step.title }}</h3>
        <p>{{ active.step.body }}</p>
        <div class="row">
          <span class="count">{{ active.index + 1 }} / {{ active.total }}</span>
          <div class="btns">
            <button class="skip" (click)="tour.skip()">Skip</button>
            @if (!active.isFirst) { <button class="back" (click)="tour.back()">Back</button> }
            <button class="next" (click)="tour.next()">{{ active.step.nextLabel ?? 'Next' }}</button>
          </div>
        </div>
      }
    }
  `,
})
export class TourOverlayComponent {
  /** Bounding rect of the current step's target, or null when off-screen. */
  readonly rect = signal<DOMRect | null>(null);
  private lastStepIndex = -1;

  constructor(public tour: TourService) {}

  ngDoCheck(): void {
    // Re-measure whenever the active step changes (cheap; runs with change detection).
    const active = this.tour.activeStep();
    const idx = active ? active.index : -1;
    if (idx !== this.lastStepIndex) {
      this.lastStepIndex = idx;
      if (active) {
        requestAnimationFrame(() => this.rect.set(this.measure(active.step.selectors)));
      } else {
        this.rect.set(null);
      }
    }
  }

  private measure(selectors: string[]): DOMRect | null {
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && el.offsetParent !== null) return el.getBoundingClientRect();
    }
    return null;
  }

  calloutTop(): number {
    const r = this.rect();
    if (!r) return Math.max(12, window.innerHeight / 2 - 90);
    const below = r.bottom + 14;
    return below + 170 < window.innerHeight ? below : Math.max(12, r.top - 184);
  }

  calloutLeft(): number {
    const r = this.rect();
    if (!r) return Math.max(12, window.innerWidth / 2 - 140);
    return Math.min(Math.max(12, r.left), window.innerWidth - 292);
  }

  @HostListener('window:resize')
  onResize(): void {
    const active = this.tour.activeStep();
    this.rect.set(active ? this.measure(active.step.selectors) : null);
  }

  @HostListener('window:keydown.escape')
  onEsc(): void {
    if (this.tour.activeStep()) this.tour.skip();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/shared/tour/tour-overlay.component.ts
git commit -m "feat: TourOverlayComponent — spotlight dim + callout for the onboarding tour"
```

---

### Task 3: Wire it up (trigger flag + auto-start + overlay + replay button)

**Files:**
- Modify: `frontend/src/app/shared/components/register-dialog/register-dialog.component.ts` (the `finish` method, ~line 174)
- Modify: `frontend/src/app/app.component.ts` (imports, template, class)

**Interfaces:**
- Consumes: `TourService.start/consumePending` (Task 1), `TourOverlayComponent` selector `app-tour-overlay` (Task 2), `TOUR_PENDING_KEY` (Task 1).

- [ ] **Step 1: Set the flag on a new registration**

In `register-dialog.component.ts`, add the import at the top (with the other imports):

```ts
import { TOUR_PENDING_KEY } from '../../tour/tour.service';
```

Replace the `finish` method:

```ts
  private finish(userId: string) {
    localStorage.setItem('userId', userId);
    this.dialogRef.close(userId);
  }
```

with (sets the tour flag only for a genuine new sign-up, not login/recovery):

```ts
  private finish(userId: string) {
    localStorage.setItem('userId', userId);
    if (this.mode === 'register') localStorage.setItem(TOUR_PENDING_KEY, '1');
    this.dialogRef.close(userId);
  }
```

- [ ] **Step 2: Import the overlay + TourService in AppComponent**

In `app.component.ts`, add imports near the other imports at the top of the file:

```ts
import { TourOverlayComponent } from './shared/tour/tour-overlay.component';
import { TourService } from './shared/tour/tour.service';
```

Add `TourOverlayComponent` to the component `imports` array:

```ts
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, AsyncPipe, IconComponent, TourOverlayComponent],
```

- [ ] **Step 3: Render the overlay + add the replay button in the template**

In `app.component.ts` template, replace the sidebar sign-out line:

```html
      <button class="signout-btn" (click)="signOut()">⏻ SIGN OUT / RESET</button>
```

with (adds a replay button above it):

```html
      <button class="help-btn" (click)="startTour()">? TUTORIAL</button>
      <button class="signout-btn" (click)="signOut()">⏻ SIGN OUT / RESET</button>
```

Add the `.help-btn` style next to the existing `.signout-btn` rule in the `styles` block:

```css
    .help-btn {
      margin-top: 12px; width: 100%; background: transparent; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px;
      color: #8592ad; border: 1px solid #E3EAF5; font-family: 'Chakra Petch', sans-serif;
      font-weight: 700; font-size: 11px; letter-spacing: .08em; transition: color .15s, border-color .15s;
      clip-path: polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px);
    }
    .help-btn:hover { color: #2E6BE6; border-color: #2E6BE6; }
```

At the very end of the template, after the closing `</nav>` of the bottom nav (before the closing backtick), add:

```html
    <app-tour-overlay />
```

- [ ] **Step 4: Inject TourService and wire start/auto-start in the class**

In `app.component.ts`, add `TourService` to the constructor:

```ts
  constructor(
    private dialog: MatDialog,
    public userState: UserStateService,
    private tour: TourService,
  ) {}
```

Replace the `ngOnInit` method:

```ts
  ngOnInit() {
    if (!localStorage.getItem('userId')) {
      this.dialog.open(RegisterDialogComponent, { disableClose: true, width: '400px', panelClass: 's4y-welcome-dialog' })
        .afterClosed().subscribe(userId => {
          // reload so every view picks up the new/recovered account
          if (userId) window.location.reload();
        });
    }
  }
```

with (auto-starts the tour once when a new-registration flag is pending):

```ts
  ngOnInit() {
    if (!localStorage.getItem('userId')) {
      this.dialog.open(RegisterDialogComponent, { disableClose: true, width: '400px', panelClass: 's4y-welcome-dialog' })
        .afterClosed().subscribe(userId => {
          // reload so every view picks up the new/recovered account
          if (userId) window.location.reload();
        });
      return;
    }
    if (this.tour.consumePending()) {
      this.startTour();
    }
  }

  startTour() {
    this.tour.start(() => this.openLogActivity());
  }
```

- [ ] **Step 5: Verify it compiles**

Run: `cd frontend && npm run build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/shared/components/register-dialog/register-dialog.component.ts frontend/src/app/app.component.ts
git commit -m "feat: trigger onboarding tour on new registration + '? Tutorial' replay button"
```

- [ ] **Step 7: Manual verification in the running app**

```bash
cd /Users/antoniobecic/repo/neogov/sport4you
docker compose up -d --build frontend
```

Then, in a browser:
1. Open an incognito window at `http://localhost:8080`, register a **new** name.
2. After reload, the tour auto-starts: shell dims, spotlight lands on the **Leaderboard** nav, callout shows "1 / 5".
3. Click **Next** through all 5 steps; verify the spotlight re-anchors to Dashboard → Badges → Profile → `+ LOG ACTIVITY`. The last step's button reads **"Log an activity"**.
4. Click it → the tour closes and the **Log Activity dialog** opens.
5. Reload the page → the tour does **not** re-appear (flag consumed).
6. Click **? TUTORIAL** in the sidebar → the tour replays.
7. Press **Esc** or **Skip** mid-tour → it closes immediately.
8. Recovery check: SIGN OUT, then register with the **same** name (triggers login/recovery) → the tour does **not** appear.
9. Narrow the window to mobile width → spotlight anchors to the bottom-nav items and the `+` FAB instead.

---

## Self-Review

**Spec coverage:**
- Trigger (new registrations only) → Task 3 Step 1 (flag set only when `mode === 'register'`) + Task 1 `consumePending`. ✓
- One-shot consumption → Task 1 `consumePending` + test; Task 3 Step 4 auto-start. ✓
- TourService (state, steps, start/next/back/skip/end) → Task 1. ✓
- TourOverlayComponent (dim, spotlight, callout, counter, Skip/Back/Next) → Task 2. ✓
- Responsive target picking (visible match) → Task 2 `measure` (`offsetParent !== null`), selectors list desktop + mobile. ✓
- Spotlight box-shadow technique + resize handling → Task 2. ✓
- 5 steps, log button once at the end, opens Log Activity → Task 1 steps array + Task 3 `startTour` `onComplete`. ✓
- Skip / Esc → Task 2 `onEsc` + Skip button. ✓
- "?" replay button in sidebar → Task 3 Step 3. ✓
- Testing (unit for service, visual for overlay) → Task 1 spec + Task 3 Step 7. ✓

**Placeholder scan:** none — all steps contain complete code/commands.

**Type consistency:** `activeStep`/`TourStep`/`ActiveStep`/`TOUR_PENDING_KEY`/`consumePending`/`start(onComplete)`/`nextLabel` are defined in Task 1 and used consistently in Tasks 2–3. `startTour()`/`openLogActivity()` referenced in Task 3 both exist (openLogActivity is pre-existing in AppComponent). Selectors reference real DOM: `.log-btn`, `.bottom-fab`, `a.nav-item[href=...]`, `a.bottom-nav-item[href=...]` match the current template.
