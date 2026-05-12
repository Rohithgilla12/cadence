# cadence-api

Go service for [Cadence](../README.md). REST + WebSockets, Postgres, single binary deploy.

See [`docs/PRD.md`](../docs/PRD.md) §12 (stack), §13 (infra), §14 (CI/CD).

## Layout

```
cmd/
  api/        # HTTP server entry
  worker/     # Cron worker entry (correlation engine, Phase 3)
internal/
  auth/       # Firebase token verification middleware
  checkin/    # Check-in domain (mood, sleep)
  circle/     # Circles domain
  config/     # Env config loader
  db/         # Postgres queries
  habit/      # Habit domain (definitions + logs + streak)
  health/     # Apple Health / Strava adapters
  http/       # Routing, handlers, middleware
  insight/    # Correlation engine, templates
migrations/   # golang-migrate SQL files
deploy/       # docker-compose, Portainer, cloudflared config
```

## Local runbook

One-time setup:

```bash
cp .env.example .env
# place the Firebase Admin SDK JSON at ./firebase-admin.local.json (gitignored)
make db-up
make db-create-test
make migrate-up
make migrate-test-up
```

Run the API:

```bash
set -a; source .env; set +a
make run
curl -s localhost:8080/health | jq      # status + database
curl -s -H "Authorization: Bearer <firebase-id-token>" localhost:8080/v1/me | jq
```

Tests:

```bash
make test                 # unit tests
make test-integration     # real Postgres
```

## Endpoints (Phase 1)

| Method | Path                          | Notes |
|--------|-------------------------------|-------|
| GET    | /health                       | Public; reports DB status |
| GET    | /v1/me                        | Returns the current user |
| GET    | /v1/habits                    | Live habits with `doneToday` + `streak` |
| POST   | /v1/habits                    | `{name, icon, timeOfDay, target?, trackContext}` |
| POST   | /v1/habits/:id/toggle         | Flips today's log, returns updated DTO |
| DELETE | /v1/habits/:id                | Soft archive (sets `archived_at`) |
| GET    | /v1/check-ins/:date           | `YYYY-MM-DD`; `{checkIn: null}` if absent |
| PUT    | /v1/check-ins/:date           | Partial upsert — null fields preserved |
| PATCH  | /v1/me                        | Partial update of intent, pillars, displayName |

## Phase status

- [x] Phase 1: HTTP scaffold, /health
- [x] Phase 1: Postgres dev infra + Phase 1 schema migration
- [x] Phase 1: Firebase Admin SDK + RequireAuth middleware
- [x] Phase 1: Implicit user creation + /v1/me
- [x] Phase 1: Habit + check-in CRUD endpoints
- [x] Phase 1: Onboarding write-side (PATCH /v1/me + onboardingCompleted flag)
- [ ] Phase 1: Onboarding UI
- [ ] Phase 1: Mobile wires real data
- [ ] Phase 2+: see PRD §17
