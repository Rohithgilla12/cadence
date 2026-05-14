package feed

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrForbidden = errors.New("not a member of this circle")
	ErrNotFound  = errors.New("feed item not found")
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type EmitInput struct {
	CircleID uuid.UUID
	UserID   uuid.UUID
	Kind     string
	Payload  map[string]any // serialised into the payload jsonb column
	Note     *string
}

// Emit inserts a feed item AFTER confirming the user is a member of the
// circle. Non-member callers see ErrForbidden — keeps a buggy client (or a
// future bug in the auto-emit code) from leaking items into circles the user
// isn't in.
func (r *Repository) Emit(ctx context.Context, in EmitInput) (Item, error) {
	var isMember bool
	if err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2
		)
	`, in.CircleID, in.UserID).Scan(&isMember); err != nil {
		return Item{}, fmt.Errorf("check membership: %w", err)
	}
	if !isMember {
		return Item{}, ErrForbidden
	}

	var payloadBytes []byte
	if len(in.Payload) > 0 {
		b, err := json.Marshal(in.Payload)
		if err != nil {
			return Item{}, fmt.Errorf("marshal payload: %w", err)
		}
		payloadBytes = b
	}

	row := r.pool.QueryRow(ctx, `
		INSERT INTO circle_feed_items (circle_id, user_id, kind, payload, note)
		VALUES ($1, $2, $3, COALESCE($4, '{}'::jsonb), $5)
		RETURNING id, circle_id, user_id, kind, payload, note, created_at
	`, in.CircleID, in.UserID, in.Kind, payloadBytes, in.Note)
	var item Item
	if err := row.Scan(&item.ID, &item.CircleID, &item.UserID, &item.Kind, &item.Payload, &item.Note, &item.CreatedAt); err != nil {
		return Item{}, fmt.Errorf("scan: %w", err)
	}
	return item, nil
}

// ListForCircle returns the most recent items in a circle (callerID must be
// a member) joined with author display name and the caller's flower-reaction
// state. Limited to `limit` items, newest first.
func (r *Repository) ListForCircle(
	ctx context.Context,
	circleID, callerID uuid.UUID,
	limit int,
) ([]ItemWithReactions, error) {
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
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := r.pool.Query(ctx, `
		SELECT
			i.id, i.circle_id, i.user_id, u.display_name, i.kind, i.payload,
			i.note, i.created_at,
			COALESCE(r.cnt, 0) AS reaction_count,
			COALESCE(vr.viewer_reacted, false) AS viewer_reacted
		FROM circle_feed_items i
		JOIN users u ON u.id = i.user_id
		LEFT JOIN (
			SELECT feed_item_id, COUNT(*) AS cnt
			FROM reactions
			WHERE kind = $3
			GROUP BY feed_item_id
		) r ON r.feed_item_id = i.id
		LEFT JOIN (
			SELECT feed_item_id, true AS viewer_reacted
			FROM reactions
			WHERE user_id = $2 AND kind = $3
		) vr ON vr.feed_item_id = i.id
		WHERE i.circle_id = $1
		ORDER BY i.created_at DESC
		LIMIT $4
	`, circleID, callerID, ReactionKindFlower, limit)
	if err != nil {
		return nil, fmt.Errorf("query feed: %w", err)
	}
	defer rows.Close()
	var out []ItemWithReactions
	for rows.Next() {
		var item ItemWithReactions
		if err := rows.Scan(
			&item.ID, &item.CircleID, &item.UserID, &item.DisplayName,
			&item.Kind, &item.Payload, &item.Note, &item.CreatedAt,
			&item.ReactionCount, &item.ViewerReacted,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

// ToggleReaction flips the caller's flower reaction on a feed item.
// Returns the post-toggle (count, viewerReacted) pair so the client can
// update without a refetch. Requires membership in the item's circle —
// non-members see ErrNotFound.
func (r *Repository) ToggleReaction(
	ctx context.Context,
	itemID, callerID uuid.UUID,
) (count int, viewerReacted bool, err error) {
	// Authorize by joining members in a single query.
	var itemCircleID uuid.UUID
	if err := r.pool.QueryRow(ctx, `
		SELECT i.circle_id
		FROM circle_feed_items i
		JOIN circle_members m ON m.circle_id = i.circle_id AND m.user_id = $2
		WHERE i.id = $1
	`, itemID, callerID).Scan(&itemCircleID); err != nil {
		return 0, false, ErrNotFound
	}

	// Toggle: delete first; if nothing was deleted, insert. Cheap and avoids
	// a separate SELECT.
	res, err := r.pool.Exec(ctx, `
		DELETE FROM reactions
		WHERE feed_item_id = $1 AND user_id = $2 AND kind = $3
	`, itemID, callerID, ReactionKindFlower)
	if err != nil {
		return 0, false, fmt.Errorf("delete reaction: %w", err)
	}
	if res.RowsAffected() == 0 {
		if _, err := r.pool.Exec(ctx, `
			INSERT INTO reactions (feed_item_id, user_id, kind)
			VALUES ($1, $2, $3)
			ON CONFLICT (feed_item_id, user_id, kind) DO NOTHING
		`, itemID, callerID, ReactionKindFlower); err != nil {
			return 0, false, fmt.Errorf("insert reaction: %w", err)
		}
		viewerReacted = true
	}

	// Read back the count once. ANY($1) avoids two roundtrips on the rare
	// edge where the same client double-taps.
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM reactions
		WHERE feed_item_id = $1 AND kind = $2
	`, itemID, ReactionKindFlower).Scan(&count); err != nil {
		return 0, false, fmt.Errorf("count reactions: %w", err)
	}
	return count, viewerReacted, nil
}
