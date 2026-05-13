package insight

import (
	"context"
	"encoding/json"
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
	UserID         uuid.UUID
	HabitID        *uuid.UUID
	PatternType    string
	EffectSize     float64
	PValue         float64
	SampleSize     int
	TemplateID     string
	TemplateParams map[string]any
	RenderedText   string
}

// Upsert writes one insight row keyed on (user_id, habit_id, pattern_type),
// matching the unique constraint added in migration 0004. NULL habit_id
// participates in uniqueness via NULLS NOT DISTINCT so cross-habit insights
// also get one row per pattern.
func (r *Repository) Upsert(ctx context.Context, in UpsertInput) (Insight, error) {
	params, err := json.Marshal(in.TemplateParams)
	if err != nil {
		return Insight{}, fmt.Errorf("marshal template_params: %w", err)
	}
	row := r.pool.QueryRow(ctx, `
		INSERT INTO insights (
			user_id, habit_id, pattern_type,
			effect_size, p_value, sample_size,
			template_id, template_params, rendered_text
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT ON CONSTRAINT insights_user_habit_pattern_key DO UPDATE SET
			effect_size     = EXCLUDED.effect_size,
			p_value         = EXCLUDED.p_value,
			sample_size     = EXCLUDED.sample_size,
			template_id     = EXCLUDED.template_id,
			template_params = EXCLUDED.template_params,
			rendered_text   = EXCLUDED.rendered_text,
			computed_at     = now()
		RETURNING id, user_id, habit_id, pattern_type, effect_size, p_value,
			sample_size, template_id, template_params, rendered_text,
			computed_at, shown_at
	`,
		in.UserID, in.HabitID, in.PatternType,
		in.EffectSize, in.PValue, in.SampleSize,
		in.TemplateID, params, in.RenderedText,
	)
	return scan(row)
}

// ListEligibleForRotation returns above-threshold insights for the user that
// haven't been shown in the last `cooldown` (PRD §8: 7 days), ordered by
// effect size descending. The caller picks the top one for Today's surface.
func (r *Repository) ListEligibleForRotation(ctx context.Context, userID uuid.UUID, cooldown time.Duration) ([]Insight, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, habit_id, pattern_type, effect_size, p_value,
			sample_size, template_id, template_params, rendered_text,
			computed_at, shown_at
		FROM insights
		WHERE user_id = $1
		  AND sample_size >= $2
		  AND p_value     <  $3
		  AND effect_size >= $4
		  AND (shown_at IS NULL OR shown_at < $5)
		ORDER BY effect_size DESC
	`, userID, MinSampleSize, MaxPValue, MinEffectSizeMin, time.Now().Add(-cooldown))
	if err != nil {
		return nil, fmt.Errorf("query insights: %w", err)
	}
	defer rows.Close()
	var out []Insight
	for rows.Next() {
		ins, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, ins)
	}
	return out, rows.Err()
}

// MarkShown stamps shown_at so the rotation can dedupe against it.
func (r *Repository) MarkShown(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `UPDATE insights SET shown_at = now() WHERE id = $1`, id)
	return err
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scan(s rowScanner) (Insight, error) {
	var ins Insight
	var paramsBytes []byte
	err := s.Scan(
		&ins.ID, &ins.UserID, &ins.HabitID, &ins.PatternType,
		&ins.EffectSize, &ins.PValue, &ins.SampleSize,
		&ins.TemplateID, &paramsBytes, &ins.RenderedText,
		&ins.ComputedAt, &ins.ShownAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Insight{}, err
	}
	if err != nil {
		return Insight{}, fmt.Errorf("scan insight: %w", err)
	}
	if len(paramsBytes) > 0 {
		if err := json.Unmarshal(paramsBytes, &ins.TemplateParams); err != nil {
			return Insight{}, fmt.Errorf("decode template_params: %w", err)
		}
	}
	return ins, nil
}
