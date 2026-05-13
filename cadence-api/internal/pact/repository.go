package pact

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound  = errors.New("pact not found")
	ErrForbidden = errors.New("not a member of this circle")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type CreateInput struct {
	CircleID            uuid.UUID
	CreatorID           uuid.UUID
	Text                string
	StartDate           time.Time
	EndDate             time.Time
	LinkedHabitTemplate []byte // raw JSON or nil
}

// Create inserts a new pact and seeds pact_progress rows for every current
// circle member (completed=false). Done in one transaction so the pact's
// progress view is consistent the instant the row exists — members see "X
// of N" right away without waiting for a per-member upsert.
//
// Caller must already be a member; the SQL guards by joining circle_members
// in the EXISTS check, so a non-member create fails with ErrForbidden.
func (r *Repository) Create(ctx context.Context, in CreateInput) (Pact, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Pact{}, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx)

	// Membership gate. Cheap row-existence check rather than relying on FK
	// constraints + ambiguous error mapping.
	var isMember bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM circle_members
			WHERE circle_id = $1 AND user_id = $2
		)
	`, in.CircleID, in.CreatorID).Scan(&isMember); err != nil {
		return Pact{}, fmt.Errorf("check membership: %w", err)
	}
	if !isMember {
		return Pact{}, ErrForbidden
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO pacts (circle_id, text, start_date, end_date, linked_habit_template, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, circle_id, text, start_date, end_date, linked_habit_template, created_by, created_at
	`, in.CircleID, in.Text, in.StartDate, in.EndDate, in.LinkedHabitTemplate, in.CreatorID)
	var p Pact
	var linked []byte
	if err := row.Scan(&p.ID, &p.CircleID, &p.Text, &p.StartDate, &p.EndDate, &linked, &p.CreatedBy, &p.CreatedAt); err != nil {
		return Pact{}, fmt.Errorf("scan: %w", err)
	}
	if len(linked) > 0 {
		p.LinkedHabitTemplate = &linked
	}

	// Seed progress rows for every current member, including the creator.
	// completed defaults to false; CompleteForUser flips it later.
	if _, err := tx.Exec(ctx, `
		INSERT INTO pact_progress (pact_id, user_id)
		SELECT $1, user_id FROM circle_members WHERE circle_id = $2
	`, p.ID, in.CircleID); err != nil {
		return Pact{}, fmt.Errorf("seed progress: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Pact{}, fmt.Errorf("commit: %w", err)
	}
	return p, nil
}

// ListForCircleWithProgress returns the most recent N pacts for a circle,
// each with the per-member progress view. Caller must be a member.
// "Current" pacts (end_date >= today) are returned first; recently-ended
// pacts follow so members can still see what just wrapped.
func (r *Repository) ListForCircleWithProgress(
	ctx context.Context,
	circleID, callerID uuid.UUID,
	limit int,
) ([]WithProgress, error) {
	// Membership gate — same shape as elsewhere.
	var isMember bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2
		)
	`, circleID, callerID).Scan(&isMember); err != nil {
		return nil, fmt.Errorf("check membership: %w", err)
	}
	if !isMember {
		return nil, ErrForbidden
	}
	if limit <= 0 {
		limit = 10
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, circle_id, text, start_date, end_date, linked_habit_template,
		       created_by, created_at
		FROM pacts
		WHERE circle_id = $1
		ORDER BY end_date DESC, created_at DESC
		LIMIT $2
	`, circleID, limit)
	if err != nil {
		return nil, fmt.Errorf("query pacts: %w", err)
	}
	defer rows.Close()

	var pacts []Pact
	for rows.Next() {
		var p Pact
		var linked []byte
		if err := rows.Scan(&p.ID, &p.CircleID, &p.Text, &p.StartDate, &p.EndDate, &linked, &p.CreatedBy, &p.CreatedAt); err != nil {
			return nil, err
		}
		if len(linked) > 0 {
			p.LinkedHabitTemplate = &linked
		}
		pacts = append(pacts, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(pacts) == 0 {
		return nil, nil
	}

	// Fetch progress for all those pacts in a single query, then index in Go
	// to keep the response shape simple.
	ids := make([]uuid.UUID, len(pacts))
	for i, p := range pacts {
		ids[i] = p.ID
	}
	progressRows, err := r.pool.Query(ctx, `
		SELECT pp.pact_id, pp.user_id, u.display_name, pp.completed, pp.completed_at
		FROM pact_progress pp
		JOIN users u ON u.id = pp.user_id
		WHERE pp.pact_id = ANY($1)
		ORDER BY u.display_name
	`, ids)
	if err != nil {
		return nil, fmt.Errorf("query progress: %w", err)
	}
	defer progressRows.Close()
	progressByPact := make(map[uuid.UUID][]Progress, len(pacts))
	for progressRows.Next() {
		var pactID uuid.UUID
		var prog Progress
		if err := progressRows.Scan(&pactID, &prog.UserID, &prog.DisplayName, &prog.Completed, &prog.CompletedAt); err != nil {
			return nil, err
		}
		progressByPact[pactID] = append(progressByPact[pactID], prog)
	}
	if err := progressRows.Err(); err != nil {
		return nil, err
	}

	out := make([]WithProgress, 0, len(pacts))
	for _, p := range pacts {
		out = append(out, WithProgress{Pact: p, Progress: progressByPact[p.ID]})
	}
	return out, nil
}

// CompleteForUser marks the caller's progress row as completed=true. The row
// must already exist (seeded on pact creation). Idempotent — re-completing
// is a no-op, not an error.
func (r *Repository) CompleteForUser(ctx context.Context, pactID, userID uuid.UUID) error {
	res, err := r.pool.Exec(ctx, `
		UPDATE pact_progress
		SET completed = true, completed_at = COALESCE(completed_at, now())
		WHERE pact_id = $1 AND user_id = $2
	`, pactID, userID)
	if err != nil {
		return fmt.Errorf("update progress: %w", err)
	}
	if res.RowsAffected() == 0 {
		// Either no such pact, or caller wasn't seeded — which in turn means
		// they weren't a member at pact creation. Surface as not-found so
		// existing-member privacy isn't leaked.
		return ErrNotFound
	}
	return nil
}

// ResolvePactForMember loads a pact and the caller's progress row in one
// shot; returns ErrNotFound if the pact doesn't exist or the caller isn't
// a member of its circle. Used by the complete handler to authorize.
func (r *Repository) ResolvePactForMember(ctx context.Context, pactID, callerID uuid.UUID) (Pact, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT p.id, p.circle_id, p.text, p.start_date, p.end_date,
		       p.linked_habit_template, p.created_by, p.created_at
		FROM pacts p
		JOIN circle_members m ON m.circle_id = p.circle_id AND m.user_id = $2
		WHERE p.id = $1
	`, pactID, callerID)
	var p Pact
	var linked []byte
	if err := row.Scan(&p.ID, &p.CircleID, &p.Text, &p.StartDate, &p.EndDate, &linked, &p.CreatedBy, &p.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Pact{}, ErrNotFound
		}
		return Pact{}, fmt.Errorf("scan: %w", err)
	}
	if len(linked) > 0 {
		p.LinkedHabitTemplate = &linked
	}
	return p, nil
}
