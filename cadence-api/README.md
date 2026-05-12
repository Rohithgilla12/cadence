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
  circle/     # Circles domain
  config/     # Env config loader
  db/         # Postgres queries
  habit/      # Habit domain
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

## Phase status

- [x] Phase 1: HTTP scaffold, /health
- [x] Phase 1: Postgres dev infra + Phase 1 schema migration
- [x] Phase 1: Firebase Admin SDK + RequireAuth middleware
- [x] Phase 1: Implicit user creation + /v1/me
- [ ] Phase 1: Habit / check-in CRUD endpoints
- [ ] Phase 2+: see PRD §17
