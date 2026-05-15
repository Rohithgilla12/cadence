# Deploying the Cadence API

> Production deploy via Portainer on the VPS, fronted by a Cloudflare Tunnel. No inbound ports opened on the host. Total resource ceiling: ~2 GB RAM, ~5% CPU sustained.

**Architecture:** see PRD §13 (private). Three services: `postgres`, `cadence-api`, `cloudflared`. Migrations are **embedded in the API binary** and run on startup — no separate init container.

> **VPS architecture note:** the production host (Oracle Ampere) is **aarch64 / arm64**. Build the API image with
> `--platform linux/arm64`. If you ever switch to an x86_64 host, swap to
> `linux/amd64` — the Dockerfile itself is architecture-neutral.

> **Port 8080:** taken on the VPS by qbittorrent's WebUI, but **this is not
> a conflict**. The cadence-api service binds *only* to the internal docker
> network `cadence-internal` — no host port is opened. Cloudflared routes
> traffic to `http://cadence-api:8080` over that internal network. Nothing
> the host listens on matters for our stack.

---

## Prerequisites (one-time)

### 1. VPS
- Docker Engine + Docker Compose v2 installed.
- Portainer reachable on the VPS (any version ≥ 2.20).
- ~5 GB free disk for Postgres data.

### 2. Cloudflare Zero Trust
- Existing Cloudflare tunnel for `gilla.fun` (per PRD §13).
- Create a new public hostname inside the tunnel pointing at `http://cadence-api:8080`. Hostname: `cadence-api.gilla.fun`. **Two-level subdomain matters** — Cloudflare's free Universal SSL covers `gilla.fun` and `*.gilla.fun` but not deeper (`api.cadence.gilla.fun` would need Advanced Certificate Manager at $10/mo, which we declined). When Strava lands, use `cadence-webhooks.gilla.fun` for the same reason.
- Generate a **connector token** for the tunnel (Networks → Tunnels → your tunnel → "Install connector" → "Docker"). Copy the token portion of the printed `docker run` command — the long string after `--token`. **This is `CLOUDFLARED_TUNNEL_TOKEN`.**

### 3. Firebase
- Service-account JSON downloaded (Firebase Console → Project settings → Service accounts → Generate new private key).
- Place it on the VPS at a path of your choosing — `/home/<user>/cadence-secrets/firebase-admin.json` is the convention. Permissions should be `600`. **This path is `FIREBASE_CREDENTIALS_HOST_PATH`.**

### 4. GitHub access (private repo + private GHCR image)

The repository at `github.com/Rohithgilla12/cadence` is private, so its
GHCR images inherit that visibility. Two PATs needed:

**PAT A — for your laptop to push images:**
- Classic or fine-grained token with `write:packages` + `read:packages` scopes
- `docker login ghcr.io -u Rohithgilla12` with this token (one-time on your laptop)

**PAT B — for Portainer to clone the repo + the VPS to pull the image:**
- Fine-grained PAT at https://github.com/settings/personal-access-tokens
- Name: `cadence-portainer-readonly`. Expiration: 90 days.
- Repository access: only `Rohithgilla12/cadence`
- Repository permissions: Contents Read-only, Metadata Read-only
- (For Option A image pull below) Account permissions: leave at None — package read uses the same PAT because the package is associated with the repo.

On the VPS, log into GHCR once with PAT B so Portainer's pulls succeed:

```bash
echo "<PAT B>" | docker login ghcr.io -u Rohithgilla12 --password-stdin
```

Docker stores credentials at `~/.docker/config.json` and Portainer's
docker-compose pulls reuse them automatically.

---

## First deploy (manual build + push)

### 1. Build and push the image from your local machine

```bash
cd cadence-api

# Sanity check before pushing — build + tests should be green
go build ./...
make test-integration

# Build for amd64 (Portainer VPS is almost certainly x86_64; switch to
# arm64 if you're on a Raspberry Pi or Apple-silicon-based VPS).
SHA=$(git rev-parse --short HEAD)
docker buildx build \
  --platform linux/arm64 \
  -t ghcr.io/rohithgilla12/cadence-api:${SHA} \
  -t ghcr.io/rohithgilla12/cadence-api:latest \
  --push \
  .
```

The image is multi-stage and lands at ~38 MB (distroless/static base, both
api + worker binaries baked in).

### 2. Stage the secrets on the VPS

```bash
# On the VPS
mkdir -p ~/cadence-secrets
chmod 700 ~/cadence-secrets

# Upload the Firebase service-account JSON to ~/cadence-secrets/firebase-admin.json
# (scp from your laptop, or paste contents in Portainer's file editor)
chmod 600 ~/cadence-secrets/firebase-admin.json
```

### 3. Create the Portainer stack

In Portainer → Stacks → **Add stack**:

- **Name:** `cadence`
- **Build method:** *Git Repository*
  - **Repository URL:** `https://github.com/Rohithgilla12/cadence.git`
  - **Repository reference:** `refs/heads/main`
  - **Repository authentication:** enabled
    - Username: `Rohithgilla12`
    - Personal access token: paste PAT B (the fine-grained one)
  - **Compose path:** `cadence-api/deploy/docker-compose.prod.yml`
  - **Automatic updates:** optional — enable polling at 5 min to auto-redeploy on every push to `main`
- **Environment variables** (copy values into the Portainer UI form, do NOT commit them):

  | Variable | Value |
  |---|---|
  | `POSTGRES_PASSWORD` | a strong random string (32+ chars) |
  | `CLOUDFLARED_TUNNEL_TOKEN` | from the Cloudflare connector token |
  | `FIREBASE_CREDENTIALS_HOST_PATH` | `/home/<user>/cadence-secrets/firebase-admin.json` |
  | `CADENCE_IMAGE` | `ghcr.io/rohithgilla12/cadence-api:<sha>` (or `:latest`) |
  | `SENTRY_DSN` | optional, leave blank for now |
  | `PUBLIC_BASE_URL` | `https://cadence-api.gilla.fun` — base for Strava OAuth callback + webhook (must match Strava app config) |
  | `STRAVA_CLIENT_ID` | from developers.strava.com → Applications |
  | `STRAVA_CLIENT_SECRET` | same place; treat as a long-lived secret |
  | `STRAVA_TOKEN_ENCRYPTION_KEY` | 32 raw bytes hex-encoded (64 chars). Generate with `openssl rand -hex 32`. Encrypts OAuth tokens at rest |
  | `STRAVA_WEBHOOK_VERIFY_TOKEN` | shared secret used during the one-time webhook subscribe handshake (`openssl rand -hex 16` is plenty) |

  All five Strava variables are required together — missing any one disables the Strava routes (they 503) but the rest of the API still boots. To skip Strava in dev, leave them all unset.

### 4b. Strava one-time setup

1. Register a new app at <https://developers.strava.com/> → **My API Application**.
2. **Authorization Callback Domain** — only the hostname, no scheme, no path: `cadence-api.gilla.fun`. Strava validates the redirect URI prefix against this value.
3. Copy `Client ID` + `Client Secret` into the env vars above.
4. After the API is deployed, subscribe to webhooks via a one-time curl from your laptop:

   ```bash
   curl -X POST https://www.strava.com/api/v3/push_subscriptions \
     -F client_id=$STRAVA_CLIENT_ID \
     -F client_secret=$STRAVA_CLIENT_SECRET \
     -F callback_url=https://cadence-api.gilla.fun/v1/webhooks/strava \
     -F verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN
   ```

   Strava GETs the callback during this call to verify the token; the handler returns the challenge automatically when `verify_token` matches. One subscription per app — repeating this call after success returns `already exists` (idempotent).

- Click **Deploy the stack**.

Portainer pulls all three images (`postgres:17-alpine`, `ghcr.io/rohithgilla12/cadence-api:<sha>`, `cloudflare/cloudflared:latest`) and starts them.

### 4. Verify

```bash
# On the VPS
docker logs cadence-postgres --tail 20      # should end with "database system is ready"
docker logs cadence-api      --tail 20      # should show "migrations applied" then "cadence-api listening"
docker logs cadence-cloudflared --tail 20   # should show "Registered tunnel connection"
```

From your laptop:

```bash
curl -s https://cadence-api.gilla.fun/health | jq
# {"status":"ok","database":"ok","time":"..."}
```

Then point the mobile app at production by editing `cadence-mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://cadence-api.gilla.fun
```

…and rebuild on the simulator.

---

## Subsequent deploys

For now (no CI):

```bash
cd cadence-api
SHA=$(git rev-parse --short HEAD)
docker buildx build --platform linux/arm64 \
  -t ghcr.io/rohithgilla12/cadence-api:${SHA} \
  --push .

# In Portainer: Stacks → cadence → Editor → bump CADENCE_IMAGE to the new sha → Update the stack
```

Migrations apply automatically on startup — no separate step.

**CI/CD via GitHub Actions** lands in a follow-up plan (PRD §14): every push to `main` builds, pushes, then pings a Portainer webhook with the new tag.

---

## Rollback

In Portainer → Stacks → cadence → Editor → set `CADENCE_IMAGE` back to a known-good `:<sha>` tag → Update.

Postgres data is in a named volume (`cadence-pgdata`) and survives. Rolling back the API binary does NOT roll back schema changes — `golang-migrate` only runs forward. If a migration broke things, restore from the previous backup and `migrate -path ... down 1` manually.

---

## Alternative: share the existing cloudflared (optional optimization)

The current stack runs its own `cloudflared` container for full isolation
(~30 MB RAM cost). If you'd rather consolidate onto the existing tunnel
already serving gilla.fun on the VPS:

1. Comment out the `cloudflared:` service block in
   `deploy/docker-compose.prod.yml`.
2. After the stack is up, attach the existing cloudflared to the cadence
   network: `docker network connect cadence-internal cloudflared`.
3. In Cloudflare Zero Trust → your existing tunnel → Public Hostname,
   add `cadence-api.gilla.fun` → `http://cadence-api:8080`.

The default (two cloudflareds, one per concern) is safer for the first
deploy because it doesn't touch your existing tunnel config. Consolidate
later if you ever want to.

---

## Backups (Phase 2 — add before user data starts flowing)

Per PRD §13: nightly `pg_dump | restic snapshot` to Backblaze B2, weekly automated restore test. **Not in this first-deploy stack.** Add a `backup` service to compose and document at the same time as Sentry monitoring lands.

---

## Common operations

```bash
# Tail logs across the stack
docker logs -f cadence-api

# Connect to the production DB (read-only mindset)
docker exec -it cadence-postgres psql -U cadence -d cadence

# Force a restart without redeploying
docker restart cadence-api

# Check disk usage (Postgres + image layers)
docker system df
```

---

## What the user (you, gilla) does on launch day

1. SSH to VPS, place the Firebase JSON.
2. From your laptop: `docker buildx build ... --push .`
3. In Portainer: create the stack with the env vars above, deploy.
4. `curl https://cadence-api.gilla.fun/health` from your laptop.
5. Point the simulator at production, sign in, run through onboarding, watch the row appear in `SELECT * FROM users;`.

That's it. ~30 min the first time, ~3 min for every redeploy after.

· · ·
