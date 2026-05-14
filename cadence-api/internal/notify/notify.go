// Package notify is the push-notification surface for Cadence. It owns the
// device_tokens table (one row per FCM token registered by a user's
// device) and wraps Firebase Cloud Messaging for outbound sends.
//
// Per PRD §6 push notifications are opt-in via quiet hours and per-category
// preferences. v1 only ships the plumbing — token registration + a test
// send — so we can verify the round trip end-to-end before adding
// templated triggers (pact reminders, circle activity, recovery prompts).
package notify

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/api/option"
)

type Platform string

const (
	PlatformIOS     Platform = "ios"
	PlatformAndroid Platform = "android"
)

type DeviceToken struct {
	Token      string
	UserID     uuid.UUID
	Platform   Platform
	CreatedAt  time.Time
	LastSeenAt time.Time
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Upsert idempotently registers a token. The token is the primary key, so
// re-registering refreshes last_seen_at and reclaims ownership when a
// device's FCM token gets reused after a user switch (rare but happens
// on shared simulators).
func (r *Repository) Upsert(ctx context.Context, token string, userID uuid.UUID, platform Platform) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return errors.New("empty token")
	}
	if platform != PlatformIOS && platform != PlatformAndroid {
		return fmt.Errorf("invalid platform %q", platform)
	}
	_, err := r.pool.Exec(ctx, `
		INSERT INTO device_tokens (token, user_id, platform)
		VALUES ($1, $2, $3)
		ON CONFLICT (token) DO UPDATE SET
			user_id      = EXCLUDED.user_id,
			platform     = EXCLUDED.platform,
			last_seen_at = now()
	`, token, userID, string(platform))
	if err != nil {
		return fmt.Errorf("upsert device token: %w", err)
	}
	return nil
}

// DeleteForUser drops a single (user, token) row. Used on explicit
// unregister (the device opens the app, user toggles notifications off)
// and on sign-out. Returns nil even when the row didn't exist — the
// caller wants the absence, not a confirmation we did the work.
func (r *Repository) DeleteForUser(ctx context.Context, token string, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM device_tokens WHERE token = $1 AND user_id = $2
	`, token, userID)
	if err != nil {
		return fmt.Errorf("delete device token: %w", err)
	}
	return nil
}

// ListForUser returns every token currently registered to a user. The
// sender fans the message out across all of them so a user with phone +
// iPad gets the notification on both.
func (r *Repository) ListForUser(ctx context.Context, userID uuid.UUID) ([]DeviceToken, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT token, user_id, platform, created_at, last_seen_at
		FROM device_tokens
		WHERE user_id = $1
		ORDER BY last_seen_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list device tokens: %w", err)
	}
	defer rows.Close()
	var out []DeviceToken
	for rows.Next() {
		var t DeviceToken
		var platform string
		if err := rows.Scan(&t.Token, &t.UserID, &platform, &t.CreatedAt, &t.LastSeenAt); err != nil {
			return nil, err
		}
		t.Platform = Platform(platform)
		out = append(out, t)
	}
	return out, rows.Err()
}

// PruneInvalid drops a token that the FCM API reports as unregistered or
// invalid. Called by the sender when it gets back a NOT_FOUND or
// UNREGISTERED error per message — keeps the table clean over time.
func (r *Repository) PruneInvalid(ctx context.Context, token string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM device_tokens WHERE token = $1`, token)
	return err
}

// Sender wraps firebase.Messaging. Nil-safe — when not configured (local
// dev without a Firebase credentials file), Send returns ErrSenderDisabled
// so the HTTP layer can return a graceful 503 instead of a panic.
type Sender struct {
	client *messaging.Client
	repo   *Repository
}

var ErrSenderDisabled = errors.New("push sender not configured")

func NewSender(ctx context.Context, repo *Repository, credentialsPath string) (*Sender, error) {
	if credentialsPath == "" {
		return &Sender{repo: repo}, nil // disabled but usable for token registration only
	}
	app, err := firebase.NewApp(ctx, nil, option.WithCredentialsFile(credentialsPath))
	if err != nil {
		return nil, fmt.Errorf("firebase app: %w", err)
	}
	client, err := app.Messaging(ctx)
	if err != nil {
		return nil, fmt.Errorf("firebase messaging client: %w", err)
	}
	return &Sender{client: client, repo: repo}, nil
}

type Payload struct {
	Title string
	Body  string
	// Data fields ride alongside the user-visible payload. Kept flat
	// (string → string) per FCM's contract.
	Data map[string]string
}

// SendToUser fans the payload out to every token registered for userID.
// Tokens that the FCM API reports as invalid are pruned from the table
// so the next send doesn't waste a round-trip. Successful and pruned
// counts are returned so callers can log a single line.
func (s *Sender) SendToUser(ctx context.Context, userID uuid.UUID, payload Payload) (sent int, pruned int, err error) {
	if s.client == nil {
		return 0, 0, ErrSenderDisabled
	}
	tokens, err := s.repo.ListForUser(ctx, userID)
	if err != nil {
		return 0, 0, err
	}
	for _, t := range tokens {
		msg := &messaging.Message{
			Token: t.Token,
			Notification: &messaging.Notification{
				Title: payload.Title,
				Body:  payload.Body,
			},
			Data: payload.Data,
		}
		if _, err := s.client.Send(ctx, msg); err != nil {
			if messaging.IsUnregistered(err) || messaging.IsInvalidArgument(err) {
				_ = s.repo.PruneInvalid(ctx, t.Token)
				pruned++
				continue
			}
			// A single token failure isn't fatal — log via the caller's
			// error log if it cares, keep fanning out.
			continue
		}
		sent++
	}
	return sent, pruned, nil
}

// Ensure unused imports don't trip the linter on disabled builds.
var _ = pgx.ErrNoRows
