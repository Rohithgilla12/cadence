package strava

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// refreshSkew gives the service a window to refresh proactively so an
// in-flight request doesn't trip a 401 from Strava. Strava tokens last
// 6h; refreshing 5 minutes early is a comfortable margin.
const refreshSkew = 5 * time.Minute

// stateTTL bounds how long an OAuth flow stays valid. Long enough for
// a user to read the consent screen, short enough that a leaked state
// is not interesting.
const stateTTL = 10 * time.Minute

// AutodetectFunc is the callback fired when a Strava activity is
// ingested. It receives the resolved Cadence user and the persisted
// activity. The service does not own habit auto-detection logic —
// that lives in the habit package — so this is wired by main.go.
type AutodetectFunc func(ctx context.Context, userID uuid.UUID, activity *DetailedActivity)

// Service owns the OAuth lifecycle and webhook ingest for Strava.
// Holds in-memory state for the short-lived CSRF nonces; everything
// long-lived lives in the repository.
type Service struct {
	client     *Client
	repo       *Repository
	publicURL  string
	autodetect AutodetectFunc

	stateMu sync.Mutex
	states  map[string]stateRecord
}

type stateRecord struct {
	UserID    uuid.UUID
	CreatedAt time.Time
}

func NewService(client *Client, repo *Repository, publicURL string) *Service {
	return &Service{
		client:    client,
		repo:      repo,
		publicURL: publicURL,
		states:    make(map[string]stateRecord),
	}
}

// SetAutodetect wires the habit-side callback. Optional — if unset,
// activities are still persisted but no habit logs fire.
func (s *Service) SetAutodetect(fn AutodetectFunc) {
	s.autodetect = fn
}

// Repo exposes the underlying repository so HTTP handlers can read
// connection status without going through a setter on the service.
// The repository is the natural surface for read-only lookups; the
// service owns write paths that include OAuth + ingest side effects.
func (s *Service) Repo() *Repository {
	return s.repo
}

// BeginAuthorize returns the URL we redirect the user's browser to.
// The state token is opaque to Strava and verified on callback —
// without it, an attacker could swap their own auth code into our
// callback and silently link their Strava to our victim's Cadence.
func (s *Service) BeginAuthorize(userID uuid.UUID) (string, error) {
	state, err := randomState()
	if err != nil {
		return "", fmt.Errorf("generate state: %w", err)
	}
	s.stateMu.Lock()
	s.states[state] = stateRecord{UserID: userID, CreatedAt: time.Now()}
	s.gcStatesLocked()
	s.stateMu.Unlock()
	return s.client.AuthorizeURL(s.callbackURL(), state), nil
}

// FinishAuthorize is the second leg of the OAuth dance — called by the
// callback handler. Validates state, exchanges code, persists the
// connection. Returns the user we resolved from state so the handler
// can build a deep-link with the correct user context if needed.
func (s *Service) FinishAuthorize(ctx context.Context, code, state string) (uuid.UUID, error) {
	s.stateMu.Lock()
	rec, ok := s.states[state]
	if ok {
		delete(s.states, state)
	}
	s.stateMu.Unlock()
	if !ok {
		return uuid.Nil, errors.New("strava: unknown or expired state")
	}
	if time.Since(rec.CreatedAt) > stateTTL {
		return uuid.Nil, errors.New("strava: state expired")
	}
	tok, err := s.client.ExchangeCode(ctx, code)
	if err != nil {
		return uuid.Nil, fmt.Errorf("exchange code: %w", err)
	}
	if _, err := s.repo.UpsertConnection(ctx, rec.UserID, tok); err != nil {
		return uuid.Nil, fmt.Errorf("upsert connection: %w", err)
	}
	return rec.UserID, nil
}

// Disconnect tears down the user's Strava connection per PRD §9. The
// repository delete is the durable step; the deauthorize call is
// best-effort (Strava may already have invalidated the token, in
// which case the call returns 4xx and we shrug).
func (s *Service) Disconnect(ctx context.Context, userID uuid.UUID) error {
	conn, err := s.repo.GetByUser(ctx, userID)
	if err != nil {
		if errors.Is(err, ErrConnectionNotFound) {
			return nil // already disconnected — idempotent
		}
		return err
	}
	if delErr := s.repo.Delete(ctx, userID); delErr != nil {
		return delErr
	}
	// Fire-and-forget on the deauth — local row is already gone, so
	// the user is "disconnected" from Cadence's perspective even if
	// Strava's side fails. Worst case the user has to revoke from
	// Strava settings, which they could do at any time anyway.
	deauthCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	_ = s.client.DeauthorizeAthlete(deauthCtx, conn.AccessToken)
	return nil
}

// ensureFreshToken returns an access token guaranteed not to expire in
// the next refreshSkew. On refresh, the new tokens are persisted so
// the next call doesn't re-refresh.
func (s *Service) ensureFreshToken(ctx context.Context, conn Connection) (string, error) {
	if time.Until(conn.ExpiresAt) > refreshSkew {
		return conn.AccessToken, nil
	}
	tok, err := s.client.RefreshToken(ctx, conn.RefreshToken)
	if err != nil {
		return "", fmt.Errorf("refresh token: %w", err)
	}
	if _, err := s.repo.UpsertConnection(ctx, conn.UserID, tok); err != nil {
		return "", fmt.Errorf("persist refreshed token: %w", err)
	}
	return tok.AccessToken, nil
}

// HandleWebhookEvent is the entry point from the webhook HTTP handler.
// Validates the aspect/object combination, resolves athlete → user,
// fetches the full activity, persists, and fires the autodetect
// callback. Idempotent on event_id so a Strava retry is safe.
type WebhookEvent struct {
	AspectType     string         `json:"aspect_type"` // create | update | delete
	EventTime      int64          `json:"event_time"`
	ObjectID       int64          `json:"object_id"`
	ObjectType     string         `json:"object_type"` // activity | athlete
	OwnerID        int64          `json:"owner_id"`
	UpdatesMap     map[string]any `json:"updates"`
	SubscriptionID int64          `json:"subscription_id"`
}

func (s *Service) HandleWebhookEvent(ctx context.Context, ev WebhookEvent) error {
	// We only care about activity create / update. Delete + athlete
	// scope events arrive but Cadence has no use for them yet — log-
	// silent-skip rather than reject.
	if ev.ObjectType != "activity" {
		return nil
	}
	if ev.AspectType != "create" && ev.AspectType != "update" {
		return nil
	}
	conn, err := s.repo.GetByAthleteID(ctx, ev.OwnerID)
	if err != nil {
		if errors.Is(err, ErrConnectionNotFound) {
			// Strava can fire events for athletes whose connection we've
			// already deleted (race between disconnect + in-flight event).
			// Drop silently.
			return nil
		}
		return fmt.Errorf("resolve athlete: %w", err)
	}
	access, err := s.ensureFreshToken(ctx, conn)
	if err != nil {
		return err
	}
	activity, err := s.client.FetchActivity(ctx, access, ev.ObjectID)
	if err != nil {
		// One retry on expired token — the refresh window is generous
		// but clock skew between us and Strava can still bite.
		if errors.Is(err, ErrTokenExpired) {
			fresh, refreshErr := s.client.RefreshToken(ctx, conn.RefreshToken)
			if refreshErr != nil {
				return fmt.Errorf("refresh after 401: %w", refreshErr)
			}
			if _, persistErr := s.repo.UpsertConnection(ctx, conn.UserID, fresh); persistErr != nil {
				return persistErr
			}
			activity, err = s.client.FetchActivity(ctx, fresh.AccessToken, ev.ObjectID)
			if err != nil {
				return fmt.Errorf("fetch after refresh: %w", err)
			}
		} else {
			return err
		}
	}
	evID := ev.SubscriptionID // best-available identifier per event
	if err := s.repo.UpsertActivity(ctx, conn.UserID, activity, &evID); err != nil {
		return fmt.Errorf("persist activity: %w", err)
	}
	if s.autodetect != nil {
		// Fire-and-forget from the HTTP request's perspective — the
		// callback runs synchronously here so errors surface in the
		// caller's log, but the HTTP response to Strava is already on
		// its way back by the time the worker pool picks this up.
		s.autodetect(ctx, conn.UserID, activity)
	}
	return nil
}

func (s *Service) callbackURL() string {
	return s.publicURL + "/v1/strava/callback"
}

// gcStatesLocked drops state entries older than the TTL. Caller must
// hold stateMu. Called from BeginAuthorize so the map size is bounded
// by the rate at which users initiate flows.
func (s *Service) gcStatesLocked() {
	cutoff := time.Now().Add(-stateTTL)
	for k, v := range s.states {
		if v.CreatedAt.Before(cutoff) {
			delete(s.states, k)
		}
	}
}

func randomState() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
