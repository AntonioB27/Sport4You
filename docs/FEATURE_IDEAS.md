# Feature Idea Backlog

Brainstormed 2026-07-05. Working down this list one feature at a time —
each gets its own brainstorm → spec → plan cycle before implementation.
Check items off as they land; feel free to reorder or drop ones that stop
making sense.

## Status

- [ ] Rivals — **up next**
- [ ] Contribution heatmap
- [ ] Prestige
- [ ] Loot box pity timer
- [ ] Personal records page
- [ ] Seasonal leaderboard resets
- [ ] Limited-time events
- [ ] Streak freeze item
- [ ] Comeback bonus
- [ ] Guilds / squads
- [ ] Weekly duels
- [ ] Reduced-motion toggle

## Social & Competitive

- **Rivals** — pick one user to track head-to-head; get a subtle "Maria
  passed you by 40 pts" nudge. Cheap to build, strong retention hook.
- **Guilds/squads** — small teams with a combined leaderboard. Bigger scope,
  but fits the "social competition" spirit the assignment names as the goal.
- **Weekly duels** — challenge a specific user to a 7-day points race with
  its own mini reward.

## Progression Depth

- **Prestige** — hit max level, reset to Level 1 with a permanent cosmetic
  flair (border tier, name badge) and slightly boosted future gains.
- **Loot box pity timer** — guarantee a rare+ every N common pulls. Small
  change, meaningfully improves the loot-box feel.
- **Personal records page** — longest run, biggest single-day haul, longest
  streak — separate from achievements, purely "your own history vs. yourself."

## Content & Seasons

- **Seasonal leaderboard resets** (monthly) with a season-exclusive
  avatar/border — gives latecomers a reason to compete, not just the
  all-time top 3.
- **Limited-time events** — "Marathon Month," double-XP weekends, a themed
  loot box.

## Retention Mechanics

- **Streak freeze item** — earned or bought with points, saves a broken
  streak once. Low-effort, high perceived value.
- **Comeback bonus** — bonus XP for logging again after 5+ days away,
  instead of just losing the streak.

## Quality-of-Life / Polish

- **Activity contribution heatmap** (GitHub-style calendar) on the profile —
  cheap chart, very "creative visualization," which the assignment
  explicitly gives bonus points for.
- **Reduced-motion toggle** — an accessibility setting given how much
  animation the game layer already has.

## Notes

- None of these should touch the assignment's core `POST /api/users` /
  `POST /api/activities` contracts — same rule as everything else on `main`.
- Order isn't fixed — picked "max wow per hour of work, no contract risk"
  as the initial sort: Rivals → heatmap → prestige were the top pick, then
  the rest roughly by effort/impact.
