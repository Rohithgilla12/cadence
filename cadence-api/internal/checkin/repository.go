package checkin

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type UpsertInput struct {
	UserID     uuid.UUID
	Date       time.Time
	Mood       *int16
	SleepHours *float64
	Note       *string
}

func (r *Repository) Get(ctx context.Context, userID uuid.UUID, date time.Time) (*CheckIn, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, user_id, date, mood, sleep_hours, note, created_at
		FROM check_ins
		WHERE user_id = $1 AND date = $2
	`, userID, date)
	var c CheckIn
	if err := row.Scan(&c.ID, &c.UserID, &c.Date, &c.Mood, &c.SleepHours, &c.Note, &c.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("scan check-in: %w", err)
	}
	return &c, nil
}

func (r *Repository) Upsert(ctx context.Context, in UpsertInput) (CheckIn, error) {
	// COALESCE(EXCLUDED.field, check_ins.field) makes this a partial update —
	// passing only mood doesn't clobber an existing sleep_hours. Each tile
	// can write independently (PRD §7 mood/sleep two-tile model).
	row := r.pool.QueryRow(ctx, `
		INSERT INTO check_ins (user_id, date, mood, sleep_hours, note)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, date)
		DO UPDATE SET
			mood = COALESCE(EXCLUDED.mood, check_ins.mood),
			sleep_hours = COALESCE(EXCLUDED.sleep_hours, check_ins.sleep_hours),
			note = COALESCE(EXCLUDED.note, check_ins.note)
		RETURNING id, user_id, date, mood, sleep_hours, note, created_at
	`, in.UserID, in.Date, in.Mood, in.SleepHours, in.Note)
	var c CheckIn
	if err := row.Scan(&c.ID, &c.UserID, &c.Date, &c.Mood, &c.SleepHours, &c.Note, &c.CreatedAt); err != nil {
		return CheckIn{}, fmt.Errorf("scan: %w", err)
	}
	return c, nil
}
