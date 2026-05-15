-- Strava integration (PRD §9). Two tables:
--
--   strava_connections — one row per user once they've completed the OAuth
--     flow. Access + refresh tokens are stored encrypted (AES-GCM, key from
--     STRAVA_TOKEN_ENCRYPTION_KEY env). expires_at lets the service refresh
--     before expiry instead of waiting for a 401.
--
--   strava_activities — every activity ingested via webhook event or initial
--     backfill. Mirrors the subset of fields auto-detect + run views read:
--     distance, duration, start time, type. Polyline lives separately under
--     map_polyline so route rendering on Run detail can pull it lazily.
--
-- PRD §9 disconnect contract: rows in strava_connections are HARD-deleted on
-- disconnect (no soft-delete) so encrypted tokens never linger on disk.
-- Ingested activities stay unless the user explicitly clears them — that's
-- the "keep already-imported data unless user also clicks delete" rule.

CREATE TABLE strava_connections (
  user_id              uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  athlete_id           bigint NOT NULL,
  -- Tokens are base64(<12-byte nonce> || <ciphertext>). Encryption key is
  -- not stored in the DB — see internal/strava/encryption.go.
  access_token_enc     text NOT NULL,
  refresh_token_enc    text NOT NULL,
  expires_at           timestamptz NOT NULL,
  scope                text NOT NULL DEFAULT 'activity:read',
  -- Athlete summary captured at connect time. Read-only display fields;
  -- we don't sync these on every refresh. Source of truth is Strava.
  athlete_firstname    text,
  athlete_lastname     text,
  athlete_profile_url  text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  refreshed_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_strava_connections_athlete_id ON strava_connections (athlete_id);

CREATE TABLE strava_activities (
  -- Strava's activity id is bigint; we use it directly so re-ingest is
  -- idempotent and we don't generate our own surrogate key.
  id                 bigint PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Lowercased Strava activity type. PRD §9 / auto-detect uses 'run',
  -- 'walk', 'ride', 'swim', 'yoga' etc. — kept verbatim to match
  -- SourceLink.activity slugs already in the codebase.
  type               text NOT NULL,
  name               text,
  started_at         timestamptz NOT NULL,
  elapsed_seconds    int NOT NULL,
  moving_seconds     int,
  distance_meters    int,
  total_elevation_m  int,
  average_heartrate  int,
  max_heartrate      int,
  -- Encoded polyline from Strava (map.summary_polyline). Nullable —
  -- some indoor activities have no GPS trace. The Run detail screen
  -- decodes this lazily.
  map_polyline       text,
  -- Anti-fabrication trail: which webhook event ingested this, so we
  -- can replay if the ingest worker had a bug.
  ingested_at        timestamptz NOT NULL DEFAULT now(),
  webhook_event_id   bigint
);
CREATE INDEX idx_strava_activities_user_started ON strava_activities (user_id, started_at DESC);
CREATE INDEX idx_strava_activities_user_type    ON strava_activities (user_id, type);
