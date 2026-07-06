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
