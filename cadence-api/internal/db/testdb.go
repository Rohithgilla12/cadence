//go:build test || integration

package db

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("DATABASE_TEST_URL")
	if url == "" {
		t.Skip("DATABASE_TEST_URL not set — skipping integration test")
	}

	// Apply the embedded migrations every time the test pool is requested.
	// migrate.Up is a no-op after the first call (schema_migrations tracks
	// applied versions). This removes the dependency on the migrate CLI for
	// CI runs — tests are now self-contained.
	if err := ApplyMigrations(url); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := NewPool(ctx, url)
	if err != nil {
		t.Fatalf("test pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func Truncate(t *testing.T, pool *pgxpool.Pool, tables ...string) {
	t.Helper()
	for _, table := range tables {
		_, err := pool.Exec(context.Background(),
			"TRUNCATE TABLE "+table+" RESTART IDENTITY CASCADE")
		if err != nil {
			t.Fatalf("truncate %s: %v", table, err)
		}
	}
}
