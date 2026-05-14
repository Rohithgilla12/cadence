package user

import (
	"context"
	"errors"
	"fmt"

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

type NewUserInput struct {
	FirebaseUID string
	Email       string
	DisplayName string
}

var ErrNotFound = errors.New("user not found")

func (r *Repository) GetByFirebaseUID(ctx context.Context, firebaseUID string) (User, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, firebase_uid, COALESCE(email,''), COALESCE(display_name,''),
		       COALESCE(handle,''), COALESCE(intent,''), pillars, created_at, updated_at
		FROM users
		WHERE firebase_uid = $1 AND deleted_at IS NULL
	`, firebaseUID)
	var u User
	err := row.Scan(&u.ID, &u.FirebaseUID, &u.Email, &u.DisplayName,
		&u.Handle, &u.Intent, &u.Pillars, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("select user: %w", err)
	}
	return u, nil
}

func (r *Repository) GetOrCreateByFirebaseUID(ctx context.Context, input NewUserInput) (User, error) {
	if existing, err := r.GetByFirebaseUID(ctx, input.FirebaseUID); err == nil {
		return existing, nil
	} else if !errors.Is(err, ErrNotFound) {
		return User{}, err
	}

	// ON CONFLICT no-op + RETURNING handles the TOCTOU race when two
	// authenticated requests for an unknown UID arrive simultaneously.
	// DisplayName is set on first insert only — the conflict branch
	// deliberately excludes it from SET to avoid overwriting the original.
	row := r.pool.QueryRow(ctx, `
		INSERT INTO users (firebase_uid, email, display_name)
		VALUES ($1, NULLIF($2,''), NULLIF($3,''))
		ON CONFLICT (firebase_uid) DO UPDATE SET firebase_uid = EXCLUDED.firebase_uid
		RETURNING id, firebase_uid, COALESCE(email,''), COALESCE(display_name,''),
		          COALESCE(handle,''), COALESCE(intent,''), pillars, created_at, updated_at
	`, input.FirebaseUID, input.Email, input.DisplayName)

	var u User
	if err := row.Scan(&u.ID, &u.FirebaseUID, &u.Email, &u.DisplayName,
		&u.Handle, &u.Intent, &u.Pillars, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return User{}, fmt.Errorf("insert user: %w", err)
	}
	return u, nil
}

type UpdateProfileInput struct {
	Intent      *string
	Pillars     *[]string
	DisplayName *string
}

// DeleteByID hard-deletes a user row. All child rows cascade via FK
// constraints — habits, habit_logs, daily_summaries, check_ins, insights,
// circle_members, circle_feed_items, pact_progress, reactions all go.
// Used for the PRD §15 "delete account and all data with one action" flow.
//
// Returns nil if the user didn't exist — the desired state ("user not
// present") is what matters, not whether we did the work this call.
func (r *Repository) DeleteByID(ctx context.Context, id uuid.UUID) error {
	if _, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id); err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	return nil
}

func (r *Repository) UpdateProfile(ctx context.Context, id uuid.UUID, in UpdateProfileInput) (User, error) {
	// Partial update via COALESCE so nil fields preserve existing values.
	row := r.pool.QueryRow(ctx, `
		UPDATE users SET
			intent       = COALESCE($2, intent),
			pillars      = COALESCE($3, pillars),
			display_name = COALESCE($4, display_name),
			updated_at   = now()
		WHERE id = $1 AND deleted_at IS NULL
		RETURNING id, firebase_uid, COALESCE(email,''), COALESCE(display_name,''),
		          COALESCE(handle,''), COALESCE(intent,''), pillars, created_at, updated_at
	`, id, in.Intent, in.Pillars, in.DisplayName)
	var u User
	if err := row.Scan(&u.ID, &u.FirebaseUID, &u.Email, &u.DisplayName,
		&u.Handle, &u.Intent, &u.Pillars, &u.CreatedAt, &u.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, fmt.Errorf("update profile: %w", err)
	}
	return u, nil
}
