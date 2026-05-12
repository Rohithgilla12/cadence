package user

import (
	"context"
	"errors"
	"fmt"

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
