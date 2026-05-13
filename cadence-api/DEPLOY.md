# Deploying the Cadence API

> Production deploy via Portainer on the VPS, fronted by a Cloudflare Tunnel. No inbound ports opened on the host. Total resource ceiling: ~2 GB RAM, ~5% CPU sustained.

**Architecture:** see [`docs/PRD.md`](../docs/PRD.md) §13. Three services: `postgres`, `cadence-api`, `cloudflared`. Migrations are **embedded in the API binary** and run on startup — no separate init container.

---

## Prerequisites (one-time)

### 1. VPS
- Docker Engine + Docker Compose v2 installed.
- Portainer reachable on the VPS (any version ≥ 2.20).
- ~5 GB free disk for Postgres data.

### 2. Cloudflare Zero Trust
- Existing Cloudflare tunnel for `gilla.fun` (per PRD §13).
- Create a new public hostname inside the tunnel pointing at `http://cadence-api:8080`. Suggested hostname: `api.cadence.gilla.fun`. (Repeat for `webhooks.cadence.gilla.fun` when Strava lands.)
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
  --platform linux/amd64 \
  -t ghcr.io/rohithgilla12/cadence-api:${SHA} \
  -t ghcr.io/rohithgilla12/cadence-api:latest \
  --push \
  .
```

The image is multi-stage and lands at ~15 MB (distroless/static base).

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
curl -s https://api.cadence.gilla.fun/health | jq
# {"status":"ok","database":"ok","time":"..."}
```

Then point the mobile app at production by editing `cadence-mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.cadence.gilla.fun
```

…and rebuild on the simulator.

---

## Subsequent deploys

For now (no CI):

```bash
cd cadence-api
SHA=$(git rev-parse --short HEAD)
docker buildx build --platform linux/amd64 \
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
4. `curl https://api.cadence.gilla.fun/health` from your laptop.
5. Point the simulator at production, sign in, run through onboarding, watch the row appear in `SELECT * FROM users;`.

That's it. ~30 min the first time, ~3 min for every redeploy after.

· · ·
