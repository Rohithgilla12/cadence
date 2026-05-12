package habit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("habit not found")

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type CreateInput struct {
	UserID       uuid.UUID
	Name         string
	Icon         string
	TimeOfDay    TimeOfDay
	Target       *Target
	TrackContext bool
}

func (r *Repository) Create(ctx context.Context, in CreateInput) (Habit, error) {
	timeOfDay := in.TimeOfDay
	if timeOfDay == "" {
		timeOfDay = TimeAnytime
	}
	icon := in.Icon
	if icon == "" {
		icon = "sparkles"
	}
	// Target is stashed in source_link JSONB (the column already exists per
	// PRD §11 — repurposing rather than adding a column).
	var sourceLink any
	if in.Target != nil {
		b, err := json.Marshal(map[string]any{"target": in.Target})
		if err != nil {
			return Habit{}, fmt.Errorf("marshal target: %w", err)
		}
		sourceLink = b
	}
	row := r.pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, name, icon, time_of_day, track_context, source_link)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, name, icon, time_of_day, track_context, source_link, shared_with, created_at, archived_at
	`, in.UserID, in.Name, icon, string(timeOfDay), in.TrackContext, sourceLink)
	return scanHabit(row)
}

func (r *Repository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (Habit, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, user_id, name, icon, time_of_day, track_context, source_link, shared_with, created_at, archived_at
		FROM habits
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
	`, id, ownerID)
	h, err := scanHabit(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Habit{}, ErrNotFound
	}
	return h, err
}

func (r *Repository) ListForUser(ctx context.Context, ownerID uuid.UUID) ([]Habit, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, name, icon, time_of_day, track_context, source_link, shared_with, created_at, archived_at
		FROM habits
		WHERE user_id = $1 AND archived_at IS NULL
		ORDER BY created_at ASC
	`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var out []Habit
	for rows.Next() {
		h, err := scanHabit(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (r *Repository) Archive(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE habits SET archived_at = now() WHERE id = $1 AND archived_at IS NULL
	`, id)
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanHabit(s rowScanner) (Habit, error) {
	var h Habit
	var timeOfDay string
	var sourceLink []byte
	if err := s.Scan(&h.ID, &h.UserID, &h.Name, &h.Icon, &timeOfDay, &h.TrackContext, &sourceLink, &h.SharedWith, &h.CreatedAt, &h.ArchivedAt); err != nil {
		return Habit{}, err
	}
	h.TimeOfDay = TimeOfDay(timeOfDay)
	if len(sourceLink) > 0 {
		var wrapper struct {
			Target *Target `json:"target"`
		}
		if err := json.Unmarshal(sourceLink, &wrapper); err == nil {
			h.Target = wrapper.Target
		}
	}
	return h, nil
}
