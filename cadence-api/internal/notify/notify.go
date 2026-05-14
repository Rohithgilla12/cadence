// Package notify is the push-notification surface for Cadence. It owns the
// device_tokens table and sends through the Expo Push Service.
//
// Why Expo Push (https://exp.host/--/api/v2/push/send) instead of direct
// FCM / APNs: the mobile client uses expo-notifications, which issues
// Expo push tokens ("ExponentPushToken[...]"). Expo's service handles the
// fan-out to APNs + FCM behind the scenes — no Firebase Admin Messaging
// dependency on this side, no APNs HTTP/2 plumbing. Per PRD §17 Phase 6
// FCM is named but the Expo path satisfies the requirement cleanly.
//
// v1 only ships token registration + a test send so we can verify the
// round trip end-to-end. Templated triggers (pact reminders, recovery
// prompts, circle activity) ship in subsequent sessions.
package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
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
// device's Expo push token gets reused after a user switch.
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

func (r *Repository) DeleteForUser(ctx context.Context, token string, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		DELETE FROM device_tokens WHERE token = $1 AND user_id = $2
	`, token, userID)
	if err != nil {
		return fmt.Errorf("delete device token: %w", err)
	}
	return nil
}

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

func (r *Repository) PruneInvalid(ctx context.Context, token string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM device_tokens WHERE token = $1`, token)
	return err
}

// expoPushURL is the Expo Push Service endpoint. Public, no auth required
// — tokens are scoped to a specific Expo project and rate-limited.
const expoPushURL = "https://exp.host/--/api/v2/push/send"

// Sender posts batches to the Expo Push Service. The previous Firebase
// Admin Messaging-backed implementation was incompatible with our static-
// framework iOS build chain; Expo Push avoids the native conflict entirely.
type Sender struct {
	client *http.Client
	repo   *Repository
}

var ErrSenderDisabled = errors.New("push sender not configured")

// NewSender returns a Sender. Always usable — there's no offline-disabled
// state for Expo Push since it's a plain HTTPS endpoint. Kept signature
// compatible with the old constructor.
func NewSender(_ context.Context, repo *Repository, _ string) (*Sender, error) {
	return &Sender{
		client: &http.Client{Timeout: 15 * time.Second},
		repo:   repo,
	}, nil
}

type Payload struct {
	Title string
	Body  string
	Data  map[string]string
}

// expoMessage is one entry in the request body Expo expects. Their batch
// endpoint accepts an array; we send one batch per SendToUser call.
type expoMessage struct {
	To    string            `json:"to"`
	Title string            `json:"title,omitempty"`
	Body  string            `json:"body,omitempty"`
	Data  map[string]string `json:"data,omitempty"`
	Sound string            `json:"sound,omitempty"`
}

// expoTicket maps to one element in the response data[] array. We only
// care about the status + the token-invalidation signal.
type expoTicket struct {
	Status  string         `json:"status"`
	Message string         `json:"message,omitempty"`
	Details map[string]any `json:"details,omitempty"`
}

type expoResponse struct {
	Data []expoTicket `json:"data"`
}

// SendToUser fans the payload out to every token registered for userID.
// Tokens that Expo reports as DeviceNotRegistered are pruned from the
// table so the next send doesn't waste a round trip on them. Other
// per-token errors are counted but don't abort the batch.
func (s *Sender) SendToUser(ctx context.Context, userID uuid.UUID, payload Payload) (sent int, pruned int, err error) {
	tokens, err := s.repo.ListForUser(ctx, userID)
	if err != nil {
		return 0, 0, err
	}
	if len(tokens) == 0 {
		return 0, 0, nil
	}

	messages := make([]expoMessage, 0, len(tokens))
	for _, t := range tokens {
		messages = append(messages, expoMessage{
			To:    t.Token,
			Title: payload.Title,
			Body:  payload.Body,
			Data:  payload.Data,
		})
	}
	body, err := json.Marshal(messages)
	if err != nil {
		return 0, 0, fmt.Errorf("marshal payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoPushURL, bytes.NewReader(body))
	if err != nil {
		return 0, 0, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-Encoding", "gzip, deflate")
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("post expo push: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return 0, 0, fmt.Errorf("expo push http %d", resp.StatusCode)
	}

	var decoded expoResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return 0, 0, fmt.Errorf("decode expo response: %w", err)
	}

	// The data[] order matches the request order, so we can map ticket → token
	// by index.
	for i, ticket := range decoded.Data {
		if i >= len(tokens) {
			break
		}
		if ticket.Status == "ok" {
			sent++
			continue
		}
		// Common error code: "DeviceNotRegistered" → token is dead, prune it.
		if errCode, _ := ticket.Details["error"].(string); errCode == "DeviceNotRegistered" {
			_ = s.repo.PruneInvalid(ctx, tokens[i].Token)
			pruned++
		}
	}
	return sent, pruned, nil
}
