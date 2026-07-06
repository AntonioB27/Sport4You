# AI Coach — Natural-Language Activity Logging — Design Spec

**Date:** 2026-07-06
**Status:** Approved (design), ready for spec review → planning
**Branch:** work on `main` (per project preference; no feature branches)

## Problem / Goal

Add a standout "AI Coach" capability: the user describes an activity in plain English
("ran 5k in 25 min", "easy 30 minute swim this morning", "walked 8,000 steps") and the app
parses it into a structured, confirmable activity, then logs it through the existing flow. This
is the demo "magic moment" and demonstrates real LLM integration (Claude API, tool-use) beyond
CRUD.

Scope for **this** spec: **natural-language logging only.** Weekly AI recap and a conversational
coach are explicitly deferred to later increments; the AI Coach surface is built so they can plug
in later.

## Sacred Constraints

- The assignment contracts `POST /api/users` and `POST /api/activities` must not change. AI logging
  **never auto-logs** — it produces a draft the user confirms, and confirming calls the **existing**
  `POST /api/activities` (or, for steps, the existing `POST /api/users/{id}/steps`).
- Daily steps do **not** go through `/api/activities` — sending `sport: "daily_steps"` there is
  rejected. The confirm step must route steps to the steps endpoint.
- Additive only: with no API key the app is unchanged in every existing flow; manual logging always
  works and is never blocked by the AI path.

## Architecture

### Data flow
1. **AI Coach surface** (dashboard card → panel) — always visible. User types free text and submits.
2. Panel calls **`POST /api/activities/parse`** with `{ userId, text }`.
3. Backend resolves an **`IActivityParser`** and calls `ParseAsync(text)`.
4. Backend builds a **draft** and computes a **points preview** by reusing the existing stateless
   `ScoringService`. Returns the draft. **The parse endpoint writes nothing.**
5. Panel renders a **confirmation card** (e.g. "Running · 5.0 km · +500 pts") with
   **Confirm & Log / Edit / Cancel**.
6. On confirm the frontend calls the **existing** endpoint:
   - sports running/walking/cycling/swimming/gym → `POST /api/activities`
   - daily steps → `POST /api/users/{id}/steps`

### Two-tier parser (behind one interface)
```
IActivityParser.ParseAsync(string text) -> ParseResult
```
- **`ClaudeActivityParser`** — used when an Anthropic API key is configured. Calls the Claude
  Messages API server-side (key never leaves the server) using **tool-use**: Claude must respond by
  calling a `log_activity` tool whose schema constrains output to `sport` (enum of the 6) plus the
  relevant metric. On a runtime failure (network/timeout/malformed), it **falls back to the regex
  parser** rather than erroring, so the panel always returns something.
- **`RegexActivityParser`** — the offline fallback, always available. Deterministic keyword/pattern
  parsing of common phrasings. Fully unit-testable.
- **Selection:** if a key is configured → `ClaudeActivityParser` (with regex fallback on failure);
  otherwise → `RegexActivityParser`.

### `ParseResult` (draft shape, identical for both parsers)
```
sport: "running" | "walking" | "cycling" | "swimming" | "gym" | "daily_steps" | null
distanceKm?: number            // running/walking/cycling
durationSeconds?: number       // swimming/gym  (rendered mm:ss)
steps?: number                 // daily_steps
pointsPreview: number          // via ScoringService; 0 when needsClarification
confidence: "high" | "low"
needsClarification: boolean
message: string                // user-facing note or clarifying question
```

### Endpoints (new)
- `POST /api/activities/parse` — body `{ userId, text }` → `ParseResult`. Does not log.
- `GET /api/ai/status` → `{ mode: "ai" | "basic" }` — drives the always-visible AI Coach card and
  its **⚡ basic mode** badge (shown when running on the regex parser).

## Parse behavior & edge cases

- **All 6 sports** with metric routing: distance sports → km; duration sports → mm:ss;
  "8,000 steps" → `daily_steps`, routed to the steps endpoint on confirm.
- **Regex parser recognizes:**
  - sport keywords: ran/run/running→running; walk/walked→walking; cycle/cycling/bike/biked→cycling;
    swim/swam/swimming→swimming; gym/lifted/weights/workout→gym; step(s)→daily_steps
  - distance: `5k`, `5 km`, `5.2km`, `5.2 kilometers`
  - duration: `25 min`, `30 minutes`, `1h 10m`, `90 min` → seconds
  - steps: `8000 steps`, `8,000 steps`
- **Missing metric** ("went for a run") → `needsClarification: true`, `message` asks for the metric
  ("How far did you run?"). No bad guess, no draft to confirm.
- **Ambiguous / non-activity** ("did some cardio", "hello") → `sport: null`,
  `needsClarification: true`, friendly `message`; nothing to log.
- **Multiple activities in one sentence** → v1 parses the first and notes it in `message`; logging
  several at once is out of scope.
- **Datetime** defaults to now. Relative-date parsing ("yesterday") is a later increment.

## Config & graceful degradation

- API key read from configuration (`Anthropic:ApiKey` via user-secrets / environment). Never sent to
  the frontend.
- No key → `GET /api/ai/status` returns `{ mode: "basic" }`; the AI Coach card stays visible and the
  `RegexActivityParser` handles input. `mode: "ai"` when a key is present.
- Model: latest fast Claude model (Haiku 4.5) via the Messages API with tool-use. Exact model id,
  headers, and request/response shape to be confirmed against the **claude-api** skill at
  implementation. Integration via a typed `HttpClient` (IHttpClientFactory) + `System.Text.Json`
  (no third-party SDK dependency).

## Error handling

- Claude call failure/timeout → `ClaudeActivityParser` falls back to regex; if that also yields
  nothing usable, the panel shows a friendly retry state.
- The AI path never blocks manual logging — the normal Log Activity dialog remains fully functional.
- Input length cap on `text` (guard against abuse / runaway tokens).

## Security

- API key is backend-only.
- Prompt-injection risk is low: Claude output is constrained to the `log_activity` tool schema
  (sport enum + numeric metrics), and the user must confirm before anything is logged. Worst case is
  a wrong draft the user rejects.

## Testing

- **`RegexActivityParser`** — unit tests over a table of phrasings covering each sport, distance,
  duration, steps, the missing-metric clarification path, and the non-activity path.
- **Draft/preview mapping** — the deterministic step (parser output → `ParseResult` + `ScoringService`
  points preview + steps routing decision) is unit-tested with a fake `IActivityParser`.
- **Parse endpoint** — test that it returns a draft and **never writes an activity**; test the
  `mode` reported by `GET /api/ai/status` for key-present vs key-absent.
- **`ClaudeActivityParser`** — the Claude HTTP call is isolated behind `IActivityParser` and its own
  HTTP client, mocked in tests; the nondeterministic LLM itself is not asserted on directly.

## Out of scope (future increments)

- Weekly AI recap; conversational AI Coach chat.
- Voice input (Web Speech API).
- Multi-activity logging from one sentence; relative-date parsing.
- Miles→km conversion (km-only for v1).

## Frontend

- New **AI Coach** surface: a dedicated dashboard entry/card opening a panel with a text box
  ("Tell me what you did…"), a **✨ Parse** action, the **⚡ basic mode** badge when applicable, the
  confirmation card, and error/clarification states. Reuses the app's existing game-HUD design
  language (Chakra Petch / Nunito, lime/blue palette, rounded soft-shadow cards).
- Frontend calls `GET /api/ai/status` to render the mode badge; calls `POST /api/activities/parse`;
  on confirm calls the existing activity or steps endpoint and triggers the normal reward/ceremony
  pipeline already in place.
