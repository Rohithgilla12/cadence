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
	SourceLink   *SourceLink
	SharedWith   []uuid.UUID
	TrackContext bool
}

const habitColumns = `id, user_id, name, icon, time_of_day, track_context, target, source_link, shared_with, created_at, archived_at`

func (r *Repository) Create(ctx context.Context, in CreateInput) (Habit, error) {
	timeOfDay := in.TimeOfDay
	if timeOfDay == "" {
		timeOfDay = TimeAnytime
	}
	icon := in.Icon
	if icon == "" {
		icon = "sparkles"
	}
	targetJSON, err := marshalNullable(in.Target)
	if err != nil {
		return Habit{}, fmt.Errorf("marshal target: %w", err)
	}
	sourceLinkJSON, err := marshalNullable(in.SourceLink)
	if err != nil {
		return Habit{}, fmt.Errorf("marshal source_link: %w", err)
	}
	shared := in.SharedWith
	if shared == nil {
		shared = []uuid.UUID{}
	}
	row := r.pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, name, icon, time_of_day, track_context, target, source_link, shared_with)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING `+habitColumns,
		in.UserID, in.Name, icon, string(timeOfDay), in.TrackContext, targetJSON, sourceLinkJSON, shared)
	return scanHabit(row)
}

type UpdateInput struct {
	ID         uuid.UUID
	OwnerID    uuid.UUID
	Name       *string
	Icon       *string
	TimeOfDay  *TimeOfDay
	Target     *Target // nil => unchanged. To clear, send UpdateInput.ClearTarget.
	SourceLink *SourceLink
	// Sentinels: when true, the corresponding field is set to NULL regardless
	// of the pointer value. Lets the caller distinguish "leave alone" (nil
	// pointer, sentinel false) from "explicitly clear" (sentinel true).
	ClearTarget     bool
	ClearSourceLink bool
	TrackContext    *bool
	// SharedWith is fully replaced when non-nil — pass nil to leave alone,
	// pass an empty slice to clear all sharing.
	SharedWith *[]uuid.UUID
}

func (r *Repository) Update(ctx context.Context, in UpdateInput) (Habit, error) {
	// Build a dynamic update set so we only touch what the caller specified.
	// Keeping this in one query avoids a read-modify-write race.
	set := []string{}
	args := []any{in.ID, in.OwnerID}
	next := func(expr string, value any) {
		args = append(args, value)
		set = append(set, fmt.Sprintf("%s = $%d", expr, len(args)))
	}
	if in.Name != nil {
		next("name", *in.Name)
	}
	if in.Icon != nil {
		next("icon", *in.Icon)
	}
	if in.TimeOfDay != nil {
		next("time_of_day", string(*in.TimeOfDay))
	}
	if in.TrackContext != nil {
		next("track_context", *in.TrackContext)
	}
	if in.ClearTarget {
		next("target", nil)
	} else if in.Target != nil {
		b, err := marshalNullable(in.Target)
		if err != nil {
			return Habit{}, fmt.Errorf("marshal target: %w", err)
		}
		next("target", b)
	}
	if in.ClearSourceLink {
		next("source_link", nil)
	} else if in.SourceLink != nil {
		b, err := marshalNullable(in.SourceLink)
		if err != nil {
			return Habit{}, fmt.Errorf("marshal source_link: %w", err)
		}
		next("source_link", b)
	}
	if in.SharedWith != nil {
		next("shared_with", *in.SharedWith)
	}
	if len(set) == 0 {
		return r.GetByID(ctx, in.ID, in.OwnerID)
	}
	query := fmt.Sprintf(`
		UPDATE habits SET %s
		WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
		RETURNING %s
	`, joinComma(set), habitColumns)
	row := r.pool.QueryRow(ctx, query, args...)
	h, err := scanHabit(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Habit{}, ErrNotFound
	}
	return h, err
}

func (r *Repository) GetByID(ctx context.Context, id, ownerID uuid.UUID) (Habit, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT `+habitColumns+`
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
		SELECT `+habitColumns+`
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
	var target []byte
	var sourceLink []byte
	if err := s.Scan(&h.ID, &h.UserID, &h.Name, &h.Icon, &timeOfDay, &h.TrackContext, &target, &sourceLink, &h.SharedWith, &h.CreatedAt, &h.ArchivedAt); err != nil {
		return Habit{}, err
	}
	h.TimeOfDay = TimeOfDay(timeOfDay)
	if len(target) > 0 {
		var t Target
		if err := json.Unmarshal(target, &t); err != nil {
			return Habit{}, fmt.Errorf("decode target: %w", err)
		}
		h.Target = &t
	}
	if len(sourceLink) > 0 {
		var sl SourceLink
		if err := json.Unmarshal(sourceLink, &sl); err != nil {
			return Habit{}, fmt.Errorf("decode source_link: %w", err)
		}
		h.SourceLink = &sl
	}
	return h, nil
}

func marshalNullable[T any](value *T) (any, error) {
	if value == nil {
		return nil, nil
	}
	return json.Marshal(value)
}

func joinComma(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	out := parts[0]
	for i := 1; i < len(parts); i++ {
		out += ", " + parts[i]
	}
	return out
}
