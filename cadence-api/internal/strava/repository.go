package strava

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Connection mirrors strava_connections. Tokens are decrypted into
// AccessToken / RefreshToken before the service layer sees them — DB
// row decoders use ScanConnection with a Cipher.
type Connection struct {
	UserID            uuid.UUID
	AthleteID         int64
	AccessToken       string
	RefreshToken      string
	ExpiresAt         time.Time
	Scope             string
	AthleteFirstname  *string
	AthleteLastname   *string
	AthleteProfileURL *string
	CreatedAt         time.Time
	RefreshedAt       time.Time
}

// Activity mirrors strava_activities. Used by the auto-detect engine
// and the Run-detail screen.
type Activity struct {
	ID               int64
	UserID           uuid.UUID
	Type             string
	Name             *string
	StartedAt        time.Time
	ElapsedSeconds   int
	MovingSeconds    *int
	DistanceMeters   *int
	TotalElevationM  *int
	AverageHeartrate *int
	MaxHeartrate     *int
	MapPolyline      *string
	IngestedAt       time.Time
	WebhookEventID   *int64
}

// ErrConnectionNotFound is returned by GetByUser / GetByAthleteID when
// no row matches. Distinct from a real query error so callers can
// branch without checking pgx.ErrNoRows directly.
var ErrConnectionNotFound = errors.New("strava: connection not found")

type Repository struct {
	pool   *pgxpool.Pool
	cipher *Cipher
}

func NewRepository(pool *pgxpool.Pool, cipher *Cipher) *Repository {
	return &Repository{pool: pool, cipher: cipher}
}

// UpsertConnection writes a fresh row from a token-exchange or
// refresh-token response. On conflict (a re-connect by the same user)
// the existing row is overwritten — Strava considers each grant fresh,
// and the previous tokens are immediately invalid.
func (r *Repository) UpsertConnection(ctx context.Context, userID uuid.UUID, tok *TokenResponse) (Connection, error) {
	accessEnc, err := r.cipher.Encrypt(tok.AccessToken)
	if err != nil {
		return Connection{}, fmt.Errorf("encrypt access token: %w", err)
	}
	refreshEnc, err := r.cipher.Encrypt(tok.RefreshToken)
	if err != nil {
		return Connection{}, fmt.Errorf("encrypt refresh token: %w", err)
	}
	expiresAt := time.Unix(tok.ExpiresAt, 0).UTC()

	var (
		athleteID                    int64
		firstname, lastname, profile *string
	)
	if tok.Athlete != nil {
		athleteID = tok.Athlete.ID
		if tok.Athlete.Firstname != "" {
			s := tok.Athlete.Firstname
			firstname = &s
		}
		if tok.Athlete.Lastname != "" {
			s := tok.Athlete.Lastname
			lastname = &s
		}
		if tok.Athlete.Profile != "" {
			s := tok.Athlete.Profile
			profile = &s
		}
	}

	// On refresh-only flows the athlete summary is absent. Keep the
	// existing athlete_id + names rather than nulling them out.
	row := r.pool.QueryRow(ctx, `
		INSERT INTO strava_connections (
			user_id, athlete_id,
			access_token_enc, refresh_token_enc, expires_at, scope,
			athlete_firstname, athlete_lastname, athlete_profile_url,
			refreshed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
		ON CONFLICT (user_id) DO UPDATE SET
			athlete_id          = COALESCE(NULLIF(EXCLUDED.athlete_id, 0), strava_connections.athlete_id),
			access_token_enc    = EXCLUDED.access_token_enc,
			refresh_token_enc   = EXCLUDED.refresh_token_enc,
			expires_at          = EXCLUDED.expires_at,
			scope               = EXCLUDED.scope,
			athlete_firstname   = COALESCE(EXCLUDED.athlete_firstname,   strava_connections.athlete_firstname),
			athlete_lastname    = COALESCE(EXCLUDED.athlete_lastname,    strava_connections.athlete_lastname),
			athlete_profile_url = COALESCE(EXCLUDED.athlete_profile_url, strava_connections.athlete_profile_url),
			refreshed_at        = now()
		RETURNING user_id, athlete_id, access_token_enc, refresh_token_enc,
			expires_at, scope, athlete_firstname, athlete_lastname,
			athlete_profile_url, created_at, refreshed_at
	`, userID, athleteID, accessEnc, refreshEnc, expiresAt, oauthScope,
		firstname, lastname, profile)
	return r.scanConnection(row)
}

// GetByUser returns the connection for the given user, with tokens
// already decrypted. Caller is responsible for forgetting the
// plaintext after use.
func (r *Repository) GetByUser(ctx context.Context, userID uuid.UUID) (Connection, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT user_id, athlete_id, access_token_enc, refresh_token_enc,
			expires_at, scope, athlete_firstname, athlete_lastname,
			athlete_profile_url, created_at, refreshed_at
		FROM strava_connections WHERE user_id = $1
	`, userID)
	c, err := r.scanConnection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Connection{}, ErrConnectionNotFound
	}
	return c, err
}

// GetByAthleteID is the lookup path for webhook events — Strava only
// sends owner_id (the athlete) so we resolve back to the Cadence user.
func (r *Repository) GetByAthleteID(ctx context.Context, athleteID int64) (Connection, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT user_id, athlete_id, access_token_enc, refresh_token_enc,
			expires_at, scope, athlete_firstname, athlete_lastname,
			athlete_profile_url, created_at, refreshed_at
		FROM strava_connections WHERE athlete_id = $1
	`, athleteID)
	c, err := r.scanConnection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Connection{}, ErrConnectionNotFound
	}
	return c, err
}

// Delete removes the connection row entirely. PRD §9 disconnect
// contract: encrypted tokens never linger on disk.
func (r *Repository) Delete(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM strava_connections WHERE user_id = $1`, userID)
	return err
}

func (r *Repository) scanConnection(s pgx.Row) (Connection, error) {
	var (
		c          Connection
		accessEnc  string
		refreshEnc string
	)
	err := s.Scan(
		&c.UserID, &c.AthleteID, &accessEnc, &refreshEnc,
		&c.ExpiresAt, &c.Scope,
		&c.AthleteFirstname, &c.AthleteLastname, &c.AthleteProfileURL,
		&c.CreatedAt, &c.RefreshedAt,
	)
	if err != nil {
		return Connection{}, err
	}
	c.AccessToken, err = r.cipher.Decrypt(accessEnc)
	if err != nil {
		return Connection{}, fmt.Errorf("decrypt access token: %w", err)
	}
	c.RefreshToken, err = r.cipher.Decrypt(refreshEnc)
	if err != nil {
		return Connection{}, fmt.Errorf("decrypt refresh token: %w", err)
	}
	return c, nil
}

// UpsertActivity persists a Strava activity. Idempotent on the
// activity id (Strava's PK), so a duplicate webhook event is a no-op
// data-wise.
func (r *Repository) UpsertActivity(ctx context.Context, userID uuid.UUID, a *DetailedActivity, webhookEventID *int64) error {
	var name *string
	if a.Name != "" {
		s := a.Name
		name = &s
	}
	var moving *int
	if a.MovingTime > 0 {
		v := a.MovingTime
		moving = &v
	}
	var distance *int
	if a.Distance > 0 {
		v := int(a.Distance)
		distance = &v
	}
	var elevation *int
	if a.TotalElevationGain > 0 {
		v := int(a.TotalElevationGain)
		elevation = &v
	}
	var avgHR *int
	if a.AverageHeartrate > 0 {
		v := int(a.AverageHeartrate)
		avgHR = &v
	}
	var maxHR *int
	if a.MaxHeartrate > 0 {
		v := int(a.MaxHeartrate)
		maxHR = &v
	}
	var polyline *string
	if a.Map.SummaryPolyline != "" {
		s := a.Map.SummaryPolyline
		polyline = &s
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO strava_activities (
			id, user_id, type, name, started_at, elapsed_seconds,
			moving_seconds, distance_meters, total_elevation_m,
			average_heartrate, max_heartrate, map_polyline,
			ingested_at, webhook_event_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13)
		ON CONFLICT (id) DO UPDATE SET
			type              = EXCLUDED.type,
			name              = EXCLUDED.name,
			started_at        = EXCLUDED.started_at,
			elapsed_seconds   = EXCLUDED.elapsed_seconds,
			moving_seconds    = EXCLUDED.moving_seconds,
			distance_meters   = EXCLUDED.distance_meters,
			total_elevation_m = EXCLUDED.total_elevation_m,
			average_heartrate = EXCLUDED.average_heartrate,
			max_heartrate     = EXCLUDED.max_heartrate,
			map_polyline      = EXCLUDED.map_polyline,
			ingested_at       = now(),
			webhook_event_id  = EXCLUDED.webhook_event_id
	`,
		a.ID, userID, normaliseType(a.Type), name, a.StartDate.UTC(),
		a.ElapsedTime, moving, distance, elevation, avgHR, maxHR, polyline,
		webhookEventID)
	return err
}

// normaliseType lower-cases Strava's PascalCase activity type so it
// matches the SourceLink.activity slugs ('run', 'ride', etc.) that the
// auto-detect engine already uses.
func normaliseType(t string) string {
	// Strava sometimes returns subtypes ("TrailRun", "VirtualRun"). For
	// matching purposes we collapse to the base type — a TrailRun is
	// still a "run" for the user's "Morning run" practice.
	switch t {
	case "TrailRun", "VirtualRun":
		return "run"
	case "VirtualRide", "EBikeRide":
		return "ride"
	}
	// Lower-case in place without importing strings.ToLower — Strava
	// activity types are ASCII single-word.
	b := make([]byte, len(t))
	for i := 0; i < len(t); i++ {
		c := t[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}
