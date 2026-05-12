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
}

func Load() (Config, error) {
	cfg := Config{
		Port:                getEnvInt("PORT", 8080),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		DatabaseTestURL:     os.Getenv("DATABASE_TEST_URL"),
		FirebaseCredentials: os.Getenv("FIREBASE_CREDENTIALS"),
		Environment:         getEnv("CADENCE_ENV", "development"),
	}
	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL is required")
	}
	return cfg, nil
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
