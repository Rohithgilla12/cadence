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

## Run locally

```bash
cp .env.example .env
make run        # API on :8080
make worker     # one-shot worker (correlation engine, stubbed today)
```

Smoke test:

```bash
curl http://localhost:8080/health
```

## Common tasks

```bash
make build      # binaries to ./bin/
make test       # go test ./...
make lint       # golangci-lint
make fmt        # gofmt -s
make tidy       # go mod tidy
```

## Phase status

- [x] Phase 1: HTTP scaffold, /health, project layout
- [ ] Phase 1: Postgres + migrations
- [ ] Phase 1: Firebase Auth middleware
- [ ] Phase 1: Habit/check-in endpoints
- [ ] Phase 2+: see PRD §17

· · ·
