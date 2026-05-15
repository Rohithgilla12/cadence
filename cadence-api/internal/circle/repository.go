package circle

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound      = errors.New("circle not found")
	ErrAlreadyMember = errors.New("already a member")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// generateInviteToken returns a URL-safe ~20-character token (16 random bytes
// → base32 lowercased, padding stripped). base32 over base64 so the token
// survives being typed manually or scanned via QR — no `+` / `/` slashes,
// no `=` padding, no case-sensitivity confusion.
func generateInviteToken() (string, error) {
	bytes := make([]byte, 12) // 12 random bytes → ~20 base32 chars
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("rand: %w", err)
	}
	encoded := strings.ToLower(strings.TrimRight(
		base32.StdEncoding.EncodeToString(bytes), "="))
	return encoded, nil
}

type CreateInput struct {
	CreatorID   uuid.UUID
	Name        string
	Description *string
}

// Create inserts the circle, adds the creator as the creator member, and
// returns the row. Done in a single transaction so a partial create can't
// leave a circle with no members.
func (r *Repository) Create(ctx context.Context, in CreateInput) (Circle, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return Circle{}, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback(ctx)

	token, err := generateInviteToken()
	if err != nil {
		return Circle{}, err
	}

	row := tx.QueryRow(ctx, `
		INSERT INTO circles (name, description, creator_id, invite_token)
		VALUES ($1, $2, $3, $4)
		RETURNING id, name, description, creator_id, invite_token, created_at, archived_at
	`, in.Name, in.Description, in.CreatorID, token)
	var c Circle
	if err := row.Scan(&c.ID, &c.Name, &c.Description, &c.CreatorID, &c.InviteToken, &c.CreatedAt, &c.ArchivedAt); err != nil {
		return Circle{}, fmt.Errorf("scan: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO circle_members (circle_id, user_id, role)
		VALUES ($1, $2, $3)
	`, c.ID, in.CreatorID, RoleCreator); err != nil {
		return Circle{}, fmt.Errorf("insert creator member: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return Circle{}, fmt.Errorf("commit: %w", err)
	}
	return c, nil
}

func (r *Repository) GetByID(ctx context.Context, id uuid.UUID, callerID uuid.UUID) (Circle, error) {
	// Only return the circle if the caller is a member — server-enforced
	// privacy boundary. Non-members can't even confirm a circle exists.
	row := r.pool.QueryRow(ctx, `
		SELECT c.id, c.name, c.description, c.creator_id, c.invite_token, c.created_at, c.archived_at
		FROM circles c
		JOIN circle_members m ON m.circle_id = c.id AND m.user_id = $2
		WHERE c.id = $1 AND c.archived_at IS NULL
	`, id, callerID)
	var c Circle
	if err := row.Scan(&c.ID, &c.Name, &c.Description, &c.CreatorID, &c.InviteToken, &c.CreatedAt, &c.ArchivedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Circle{}, ErrNotFound
		}
		return Circle{}, fmt.Errorf("scan: %w", err)
	}
	return c, nil
}

func (r *Repository) ListForUser(ctx context.Context, userID uuid.UUID) ([]Circle, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.name, c.description, c.creator_id, c.invite_token, c.created_at, c.archived_at
		FROM circles c
		JOIN circle_members m ON m.circle_id = c.id
		WHERE m.user_id = $1 AND c.archived_at IS NULL
		ORDER BY c.created_at DESC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	var out []Circle
	for rows.Next() {
		var c Circle
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.CreatorID, &c.InviteToken, &c.CreatedAt, &c.ArchivedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// JoinByToken looks up a circle by its invite token and inserts the caller
// as a member. Idempotent: re-joining an already-joined circle is a no-op,
// not an error — the link should keep working if shared multiple times.
func (r *Repository) JoinByToken(ctx context.Context, token string, userID uuid.UUID) (Circle, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, name, description, creator_id, invite_token, created_at, archived_at
		FROM circles WHERE invite_token = $1 AND archived_at IS NULL
	`, token)
	var c Circle
	if err := row.Scan(&c.ID, &c.Name, &c.Description, &c.CreatorID, &c.InviteToken, &c.CreatedAt, &c.ArchivedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Circle{}, ErrNotFound
		}
		return Circle{}, fmt.Errorf("scan: %w", err)
	}
	if _, err := r.pool.Exec(ctx, `
		INSERT INTO circle_members (circle_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (circle_id, user_id) DO NOTHING
	`, c.ID, userID, RoleMember); err != nil {
		return Circle{}, fmt.Errorf("insert member: %w", err)
	}
	return c, nil
}

// ListMembers returns the members of a circle joined with user.display_name.
// Caller must be a member — the caller scopes the SELECT so a non-member
// gets an empty list rather than a leak.
func (r *Repository) ListMembers(ctx context.Context, circleID, callerID uuid.UUID) ([]Member, error) {
	// First confirm caller is a member; if not, surface ErrNotFound to avoid
	// confirming the circle exists.
	var ok bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2)
	`, circleID, callerID).Scan(&ok); err != nil {
		return nil, fmt.Errorf("check membership: %w", err)
	}
	if !ok {
		return nil, ErrNotFound
	}
	// COALESCE on display_name — social sign-ins (Apple in particular)
	// can land users with NULL display_name until they save the profile
	// screen. Member.DisplayName is non-nullable string, so scanning
	// NULL into it returns an error and the handler 500s. Empty string
	// is the right UI fallback; the mobile renders the avatar initials.
	rows, err := r.pool.Query(ctx, `
		SELECT m.circle_id, m.user_id, COALESCE(u.display_name, '') AS display_name, m.joined_at, m.role
		FROM circle_members m
		JOIN users u ON u.id = m.user_id
		WHERE m.circle_id = $1
		ORDER BY m.joined_at ASC
	`, circleID)
	if err != nil {
		return nil, fmt.Errorf("query members: %w", err)
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.CircleID, &m.UserID, &m.DisplayName, &m.JoinedAt, &m.Role); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
