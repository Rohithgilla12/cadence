# cadence-mobile

Expo + React Native + TypeScript app for [Cadence](../README.md).

PRD is private (held by the maintainer). [`docs/DESIGN_SYSTEM.md`](../docs/DESIGN_SYSTEM.md) is the public visual language.

## Stack

- **Expo 54** with the new architecture
- **expo-router** (file-based, typed routes)
- **NativeWind v4** (Tailwind for RN)
- **Reanimated 3** for UI-thread animations
- **Tabler icons** (1.5px stroke, our single icon library)

## Layout

```
app/                      # expo-router routes
  _layout.tsx             # Root layout (Stack + safe area + status bar)
  (tabs)/
    _layout.tsx           # Bottom tab bar — Today, Reflect, Circles, You
    index.tsx             # Today
    reflect.tsx
    circles.tsx
    you.tsx
src/
  components/             # Primitives, habit, insight, layout (DS §11)
    primitives/           # Button, Card, Pill, Avatar
    layout/               # Screen, SectionLabel
    habit/                # HabitRow, StreakPill
    insight/              # InsightCard
    today/                # WeekStrip
  theme/
    tokens.ts             # TS mirror of tailwind.config.js
tailwind.config.js        # Design tokens — source of truth alongside DS §11
```

Path alias: `@/*` → `src/*`.

## Run locally

```bash
bun install
bun run ios       # or: bun run android, bun run web
bun run typecheck # tsc --noEmit
```

> Always ask before running the dev server — likely already running elsewhere.

## Phase status

- [x] Phase 1: Tooling (Expo + NativeWind + Tabler icons + Reanimated)
- [x] Phase 1: Design tokens wired into Tailwind + TS
- [x] Phase 1: Primitives + Today screen (mock data)
- [ ] Phase 1: Onboarding flow
- [ ] Phase 1: API client + Firebase Auth
- [ ] Phase 1: Local Drizzle DB
- [ ] Phase 2+: see PRD §17

· · ·
