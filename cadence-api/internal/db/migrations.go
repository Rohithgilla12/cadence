package db

import (
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// Migrations are embedded into the binary at compile time so production
// deploys never need a separate init container or mounted migrations dir.
// The Makefile's migrate-up target points at the same directory so local
// dev keeps working through the migrate CLI for fast iteration.
//
//go:embed migrations/*.sql
var migrationsFS embed.FS

// ApplyMigrations brings the schema up to date. Called once from main on
// startup. Returns nil on no-change. Any other error is fatal — the API
// will refuse to start.
func ApplyMigrations(databaseURL string) error {
	source, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("migrations source: %w", err)
	}

	// migrate's pgx/v5 driver expects the pgx5:// scheme.
	migrateURL := strings.Replace(databaseURL, "postgres://", "pgx5://", 1)
	migrateURL = strings.Replace(migrateURL, "postgresql://", "pgx5://", 1)

	m, err := migrate.NewWithSourceInstance("iofs", source, migrateURL)
	if err != nil {
		return fmt.Errorf("migrate new: %w", err)
	}
	defer func() {
		// migrate.Close returns both source and database errors as a tuple.
		// We log them but don't fail startup — the schema is already applied.
		if srcErr, dbErr := m.Close(); srcErr != nil || dbErr != nil {
			slog.Warn("migrate close", "srcErr", srcErr, "dbErr", dbErr)
		}
	}()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate up: %w", err)
	}
	return nil
}
