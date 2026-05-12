# CLAUDE.md — Cadence

This file is read by Claude Code on every session in this repository. It is the connective tissue between the PRD, the design system, and the code.

**Read these first, in order:**

1. `docs/PRD.md` — what we're building and why
2. `docs/DESIGN_SYSTEM.md` — visual language, components, tokens
3. This file — coding conventions and how to work in this repo

---

## What is Cadence

A habit tracker with context-aware analytics. Built first for a small group of runner friends. Twenty-week solo build, evenings and weekends. iOS via Expo first, Android nearly free.

The wedge: **Cadence correlates what you do with how you slept and how you feel, and tells you which lever actually moves your rhythm.** Every feature decision is in service of that wedge.

## Repository layout

This is a monorepo plan, though the v1 build splits into two repos:

- **`cadence-mobile`** — Expo + React Native + TypeScript
- **`cadence-api`** — Go service + Postgres on the VPS

If you are working in one repo, the other repo's CLAUDE.md may differ slightly. The PRD is the source of truth across both.

### Mobile structure (`cadence-mobile`)

```
src/
  components/     # Per design system: primitives, habit, circle, insight, etc.
  screens/        # One folder per screen; index.tsx + sub-components
  hooks/          # Custom React hooks
  lib/            # API client, auth, storage, utils
  db/             # Drizzle schema, queries, migrations
  types/          # Shared TypeScript types (generated from OpenAPI when possible)
  theme/          # Tailwind config, design tokens as TS constants
app/              # Expo Router routes
docs/             # PRD.md, DESIGN_SYSTEM.md, this file
```

### Backend structure (`cadence-api`)

```
cmd/
  api/            # API server entry
  worker/         # Cron worker entry (correlation engine)
internal/
  habit/          # Habit domain
  insight/        # Correlation engine, templates
  circle/         # Circles domain
  health/         # Health integration adapters (Apple, Strava)
  auth/           # Firebase token verification
  db/             # Postgres queries, migrations
  http/           # Handlers, middleware, routing
pkg/              # Code intended for external use (none yet)
migrations/       # golang-migrate SQL files
deploy/           # docker-compose, Portainer stack, cloudflared config
docs/             # PRD.md, DESIGN_SYSTEM.md, this file (symlinked)
```

---

## Always do these things

### Before writing code

- **Read the PRD section that covers what you're building.** If you're working on Circles, read section 10. If on analytics, section 8. Don't ask me to summarize — go read it.
- **Check the design system before reaching for a color, spacing value, or icon.** If it's not in `DESIGN_SYSTEM.md`, it doesn't exist yet. Adding new tokens requires updating that file first.
- **Check existing components before creating new ones.** Cadence has a small component vocabulary. A new "card variant" is almost certainly an existing card with a prop you missed.

### When writing code

- **TypeScript on the client. Go on the server.** No exceptions.
- **No abbreviations in identifiers.** `habitCompletionRate` not `hcRate`. `circleMember` not `cm`. Cadence is a long-running solo project; readability over keystrokes.
- **Match the voice.** UI strings follow the voice guide in PRD section 20. "Quiet day" not "failure." "Coming back" not "rebuilding streak." When in doubt, gentler.
- **Functional components and hooks only.** No class components in the React code. No global state managers — TanStack Query for server state, useState/useReducer for local.
- **Keep files under 300 lines.** If a component grows past that, split it. The exception is screens, which can be 400-500 lines because they orchestrate.

### When committing

- **Conventional commits.** `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`. Scope optional but encouraged: `feat(circles): add pact creation flow`.
- **Small commits.** Each commit should leave the codebase in a working state. No "WIP" commits in main.
- **Mention the PRD phase or section.** "Phase 3 milestone" or "PRD §8 thresholds" in the commit body helps later.

---

## Never do these things

### Product

- **Never add gamification.** No XP, badges, levels, daily challenges, streak-breaking shame, leaderboards. The PRD lists this as an explicit non-goal.
- **Never make Circles public-feed-like.** No discoverability, no algorithmic feeds, no comment threads, no @mentions.
- **Never write fabricated insights.** If the analytics engine has no qualifying pattern, the UI says "Cadence is listening." We do not invent insights to perform value.
- **Never punish missed days.** Streaks survive a missed day if the user comes back. The recovery moment is gentle. Read PRD §3 principle 2 if you're unsure.

### Visual

- **Never introduce a new color** without adding it to `DESIGN_SYSTEM.md` first.
- **Never use red.** Warnings are sand. "Over-zone" is clay. Errors are muted.
- **Never use a font outside the stack.** Iowan Old Style (serif) and system-ui (sans). Mono is JetBrains Mono.
- **Never use a non-Tabler icon.** Single icon library. Single stroke width.
- **Never add dark mode in v1.** Splash screen is the only dark surface.
- **Never use shadows for "importance."** Hairline borders and spacing do the work.

### Technical

- **Never store secrets in code.** Use environment variables, Docker secrets, or Portainer's secrets management.
- **Never share user health data with Circles.** Habits can be shared per the user's explicit per-habit toggle. Sleep, mood, and health-integration data are never shared, period.
- **Never auto-uncheck a manually-logged habit** based on missing health detection. The user's manual log is canonical.
- **Never compute correlations on too-small samples.** Minimum 14 days of paired data. Below that, the relationship is stored but not surfaced.
- **Never deploy a destructive migration without manual approval.** `DROP COLUMN`, `DROP TABLE`, etc. must pause the CI pipeline.

---

## How to think about decisions

When you encounter a choice not covered by the PRD or design system:

1. **Does the choice serve the wedge?** The wedge is context-aware analytics surfaced as plain-English insights. Anything that strengthens that wins.
2. **Does the choice make the app quieter or louder?** Cadence is calm. Choose the quieter option.
3. **Does the choice make the user feel observed or supported?** Cadence supports. Surveillance framing is wrong every time.
4. **Does the choice match the voice?** Read it aloud. If it sounds like an athletic-bro app, fix it.
5. **Does the choice make solo maintenance easier or harder over 20 weeks?** Solo means we cannot afford complexity that compounds.

When two principles conflict, the order of priority is:

1. Privacy and user data ownership (PRD §15)
2. Honest behavior (no fake insights, no shame, no dark patterns)
3. The wedge (context-aware analytics)
4. The visual language (the calm aesthetic)
5. Developer velocity

---

## Working with me (the human)

- **Push back.** If a decision in the PRD or this file looks wrong given new context, say so. The PRD is a living document.
- **Show your work.** When you implement something non-obvious, drop a comment explaining the why, not just the what.
- **Suggest, don't ask.** "Here are three options, I recommend B because..." beats "Which would you prefer?" Solo dev time is precious.
- **Run things end-to-end before declaring done.** A component without a story or a test or a working integration is not done.
- **Stop when you don't know.** If a decision needs the PRD updated or my input, pause and ask. Don't guess.

---

## Specific patterns and gotchas

### Auth flow

- The client signs in via `@react-native-firebase/auth` and receives an ID token.
- Every API request includes `Authorization: Bearer <id-token>`.
- The Go server verifies the token with the Firebase Admin SDK (`firebase.google.com/go/v4`) on every request via middleware.
- After verification, the middleware looks up the user by `firebase_uid` in Postgres. If no user row exists yet, it creates one (this is the implicit signup path).
- User-related queries use the Postgres `users.id` (UUID), not the `firebase_uid`. The UID is a foreign-key column only.

### Health data sync

- Apple Health and Health Connect samples are read on-device.
- For each habit with `track_context: true`, the client computes daily summaries (sleep hours, mood, did-the-habit-happen) locally.
- The client uploads only the daily summaries to the server, not the raw samples. This keeps health data on the device.
- The server's correlation engine works against these summaries plus the habit logs and Strava data (which is server-side).

### Correlation engine guardrails

When implementing or modifying the engine (PRD §8):

- All three thresholds must hold for surfacing: 14+ days, p < 0.05, effect size meeting the bar.
- Insight templates are deterministic, not LLM-generated.
- Negative findings ("mood does not predict this") are valid insights and should be available in habit detail screens.
- Never present correlation as causation. The phrase is always "you do X more often when Y" — observational.

### Circles privacy

When implementing anything circle-related:

- Habits are shared per-habit via the `habits.shared_with` array.
- A circle member CAN see: shared habits, pact participation, display name, avatar.
- A circle member CANNOT see: other habits, mood, sleep, health data, run details (only "ran X km" if running is shared).
- Run details (pace, route, HR) are NEVER shared with Circles. Only the high-level distance.

### Auto-detection rules

For each habit linked to a health source:

- Run detection on every health data sync.
- A detected session pre-checks the habit as done. The user can untick.
- Never auto-uncheck a manually-logged habit if detection fails to find a match.
- Show a small icon on the habit row indicating it was auto-detected ("auto-detected from Apple Health" or similar).

---

## When in doubt

Open `docs/PRD.md`. The answer is probably there.

If not there, the design system. If not there, ask.

You have everything you need. Build with care.

· · ·
