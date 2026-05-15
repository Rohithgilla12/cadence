package strava

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// API base URLs. Strava splits OAuth (cookie domain) from the API host,
// so we keep both as constants rather than synthesising paths off a
// single base.
const (
	authBaseURL = "https://www.strava.com"
	apiBaseURL  = "https://www.strava.com/api/v3"
)

// Scope requested at OAuth time. PRD §9: read-only on activities. We
// never request write or detailed scopes; if Strava deprecates the
// granular form Cadence stays read-only.
const oauthScope = "activity:read"

// httpDoer narrows the dependency so tests can swap a fake without
// constructing a full http.Client. *http.Client satisfies it.
type httpDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

// Client wraps the Strava REST API for the OAuth + activity flows
// Cadence needs. One client is shared across all users; per-call token
// is passed in (we don't keep a token on the struct).
type Client struct {
	clientID     string
	clientSecret string
	http         httpDoer
}

// NewClient returns a Client wired to a 15s-timeout HTTP client. The
// timeout is long enough for the slowest token-refresh round-trip we've
// observed (~3s) but short enough that a stuck Strava endpoint doesn't
// stall the request goroutine forever.
func NewClient(clientID, clientSecret string) *Client {
	return &Client{
		clientID:     clientID,
		clientSecret: clientSecret,
		http:         &http.Client{Timeout: 15 * time.Second},
	}
}

// AuthorizeURL builds the URL we redirect the user to so they can grant
// Cadence permission. The state is opaque to Strava; we verify it on
// callback to prevent CSRF.
func (c *Client) AuthorizeURL(redirectURI, state string) string {
	q := url.Values{}
	q.Set("client_id", c.clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("approval_prompt", "auto")
	q.Set("scope", oauthScope)
	q.Set("state", state)
	return authBaseURL + "/oauth/authorize?" + q.Encode()
}

// TokenResponse is the shape Strava returns from both the initial code
// exchange and refresh-token grant. Athlete summary is only present on
// the initial exchange — we keep it nullable so refresh paths work.
type TokenResponse struct {
	TokenType    string   `json:"token_type"`
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	ExpiresAt    int64    `json:"expires_at"` // unix seconds
	ExpiresIn    int64    `json:"expires_in"` // seconds-from-now
	Athlete      *Athlete `json:"athlete,omitempty"`
}

// Athlete is the subset of the Strava athlete object we persist for
// display. We do not store anything granular (city, gender, weight) —
// PRD §15 privacy stance.
type Athlete struct {
	ID        int64  `json:"id"`
	Firstname string `json:"firstname"`
	Lastname  string `json:"lastname"`
	Profile   string `json:"profile"`
}

// ExchangeCode trades the temporary auth code for an access + refresh
// token pair. Called once per user, on the callback handler.
func (c *Client) ExchangeCode(ctx context.Context, code string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("client_id", c.clientID)
	form.Set("client_secret", c.clientSecret)
	form.Set("code", code)
	form.Set("grant_type", "authorization_code")
	return c.postForm(ctx, authBaseURL+"/api/v3/oauth/token", form)
}

// RefreshToken trades a refresh token for a fresh access token (and
// usually a fresh refresh token too — Strava rotates them on a sliding
// window). Always replace both fields in storage.
func (c *Client) RefreshToken(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("client_id", c.clientID)
	form.Set("client_secret", c.clientSecret)
	form.Set("refresh_token", refreshToken)
	form.Set("grant_type", "refresh_token")
	return c.postForm(ctx, authBaseURL+"/api/v3/oauth/token", form)
}

func (c *Client) postForm(ctx context.Context, target string, form url.Values) (*TokenResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("build token req: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("strava token: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("strava token http %d: %s", resp.StatusCode, truncate(string(body), 200))
	}
	var out TokenResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}
	if out.AccessToken == "" || out.RefreshToken == "" {
		return nil, errors.New("strava token response missing tokens")
	}
	return &out, nil
}

// DetailedActivity is the subset of Strava's activity payload Cadence
// stores. Field names mirror the API; we keep the JSON tags so the
// HTTP-level Marshal in tests is straightforward.
type DetailedActivity struct {
	ID        int64 `json:"id"`
	AthleteID int64 `json:"-"` // set after Athlete unmarshal
	Athlete   struct {
		ID int64 `json:"id"`
	} `json:"athlete"`
	Name               string    `json:"name"`
	Type               string    `json:"type"` // "Run", "Ride", "Walk", …
	StartDate          time.Time `json:"start_date"`
	ElapsedTime        int       `json:"elapsed_time"` // seconds
	MovingTime         int       `json:"moving_time"`
	Distance           float64   `json:"distance"` // meters
	TotalElevationGain float64   `json:"total_elevation_gain"`
	AverageHeartrate   float64   `json:"average_heartrate"`
	MaxHeartrate       float64   `json:"max_heartrate"`
	Map                struct {
		SummaryPolyline string `json:"summary_polyline"`
	} `json:"map"`
}

// FetchActivity GETs the full activity by ID. Strava's webhook event
// only carries the id + owner_id; we always fetch detail before
// persisting so we have distance/duration for the auto-detect engine.
func (c *Client) FetchActivity(ctx context.Context, accessToken string, id int64) (*DetailedActivity, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		fmt.Sprintf("%s/activities/%d", apiBaseURL, id), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch activity: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusUnauthorized {
		return nil, ErrTokenExpired
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("strava activity http %d: %s", resp.StatusCode, truncate(string(body), 200))
	}
	var a DetailedActivity
	if err := json.Unmarshal(body, &a); err != nil {
		return nil, fmt.Errorf("decode activity: %w", err)
	}
	a.AthleteID = a.Athlete.ID
	return &a, nil
}

// SubscribeWebhook is a one-time admin call to register Cadence as a
// webhook target. Strava only accepts one subscription per API app, so
// the service layer treats AlreadyExists as success.
type Subscription struct {
	ID            int64  `json:"id"`
	CallbackURL   string `json:"callback_url"`
	CreatedAt     string `json:"created_at,omitempty"`
	ResourceState int    `json:"resource_state,omitempty"`
}

func (c *Client) SubscribeWebhook(ctx context.Context, callbackURL, verifyToken string) (*Subscription, error) {
	form := url.Values{}
	form.Set("client_id", c.clientID)
	form.Set("client_secret", c.clientSecret)
	form.Set("callback_url", callbackURL)
	form.Set("verify_token", verifyToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		apiBaseURL+"/push_subscriptions", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("strava subscribe: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	// Strava returns 400 with "already exists" when a subscription is
	// already active for this client_id. That's idempotent success for us.
	if resp.StatusCode == 400 && bytes.Contains(body, []byte("already exists")) {
		return nil, ErrSubscriptionExists
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("strava subscribe http %d: %s", resp.StatusCode, truncate(string(body), 200))
	}
	var out Subscription
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("decode subscription: %w", err)
	}
	return &out, nil
}

// DeauthorizeAthlete revokes the Strava-side grant. Called by the
// disconnect handler in addition to deleting the row locally. PRD §9:
// "revoke server-side tokens within 30 seconds."
func (c *Client) DeauthorizeAthlete(ctx context.Context, accessToken string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		authBaseURL+"/oauth/deauthorize", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("strava deauth: %w", err)
	}
	defer resp.Body.Close()
	// Strava returns 200 even when the token is already revoked, so we
	// only error on 5xx — 4xx is treated as already-gone.
	if resp.StatusCode >= 500 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("strava deauth http %d: %s", resp.StatusCode, truncate(string(body), 200))
	}
	return nil
}

// Sentinel errors callers branch on. ErrTokenExpired lets the service
// trigger a refresh-then-retry without reading the raw response.
var (
	ErrTokenExpired       = errors.New("strava: access token expired")
	ErrSubscriptionExists = errors.New("strava: webhook subscription already exists for this app")
)

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
