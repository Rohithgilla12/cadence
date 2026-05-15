package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port                int
	DatabaseURL         string
	DatabaseTestURL     string
	FirebaseCredentials string
	Environment         string

	// PublicBaseURL is where Strava's OAuth callback and webhook events
	// land. Must match the redirect URI registered on the Strava API app
	// (developers.strava.com → Applications). Example:
	// https://cadence-api.gilla.fun
	PublicBaseURL string

	// Strava OAuth + webhook. All four are required only when Strava is
	// being served; the HTTP handlers no-op (503) when missing, so the
	// rest of the API still boots in dev without Strava credentials.
	StravaClientID           string
	StravaClientSecret       string
	StravaTokenEncryptionKey string // 32 raw bytes, hex-encoded (64 chars)
	StravaWebhookVerifyToken string // shared secret for the subscribe handshake
}

func Load() (Config, error) {
	cfg := Config{
		Port:                     getEnvInt("PORT", 8080),
		DatabaseURL:              os.Getenv("DATABASE_URL"),
		DatabaseTestURL:          os.Getenv("DATABASE_TEST_URL"),
		FirebaseCredentials:      os.Getenv("FIREBASE_CREDENTIALS"),
		Environment:              getEnv("CADENCE_ENV", "development"),
		PublicBaseURL:            os.Getenv("PUBLIC_BASE_URL"),
		StravaClientID:           os.Getenv("STRAVA_CLIENT_ID"),
		StravaClientSecret:       os.Getenv("STRAVA_CLIENT_SECRET"),
		StravaTokenEncryptionKey: os.Getenv("STRAVA_TOKEN_ENCRYPTION_KEY"),
		StravaWebhookVerifyToken: os.Getenv("STRAVA_WEBHOOK_VERIFY_TOKEN"),
	}
	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL is required")
	}
	return cfg, nil
}

// StravaConfigured reports whether all five env vars required to serve
// Strava are present. The HTTP layer gates Strava routes behind this so
// a missing env var degrades gracefully to a 503 instead of a runtime
// panic on first request.
func (c Config) StravaConfigured() bool {
	return c.StravaClientID != "" &&
		c.StravaClientSecret != "" &&
		c.StravaTokenEncryptionKey != "" &&
		c.StravaWebhookVerifyToken != "" &&
		c.PublicBaseURL != ""
}

func MustLoad() Config {
	cfg, err := Load()
	if err != nil {
		panic(fmt.Errorf("config: %w", err))
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			return parsed
		}
	}
	return fallback
}
