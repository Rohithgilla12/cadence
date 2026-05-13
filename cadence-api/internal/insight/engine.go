package insight

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AnalysisWindowDays bounds how far back the engine looks. 90 days is enough
// for two-to-three weeks of meaningful pairs even when a habit is new, while
// keeping the work bounded for the nightly cron.
const AnalysisWindowDays = 90

// Engine pulls aggregated daily data for a user and runs the registered
// pattern analyses against each habit, persisting any insight that clears
// PRD §8 thresholds.
type Engine struct {
	pool *pgxpool.Pool
	repo *Repository
}

func NewEngine(pool *pgxpool.Pool, repo *Repository) *Engine {
	return &Engine{pool: pool, repo: repo}
}

// dailyRow is the joined per-day record fed to every analysis. Nullable
// scalars stay nullable so the worker can distinguish "no data" from "zero."
type dailyRow struct {
	date             time.Time
	completed        bool
	sleepHours       *float64
	hrvMs            *int
	restingHeartRate *int
	steps            *int
	activeEnergy     *int
	mood             *int
}

// ComputeForUser is the entry point. Iterates the user's active habits,
// pulls 90 days of paired data per habit, runs each pattern analyser, and
// upserts any insight clearing the surfacing thresholds.
func (e *Engine) ComputeForUser(ctx context.Context, userID uuid.UUID) (int, error) {
	since := time.Now().AddDate(0, 0, -AnalysisWindowDays)
	habits, err := e.fetchHabits(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("fetch habits: %w", err)
	}
	surfaced := 0
	for _, h := range habits {
		rows, err := e.fetchDailyRows(ctx, userID, h.id, since)
		if err != nil {
			return surfaced, fmt.Errorf("fetch daily rows for habit %s: %w", h.id, err)
		}
		if len(rows) < MinSampleSize {
			continue
		}
		for _, analyzer := range registeredAnalyzers {
			result, ok := analyzer.Run(h, rows)
			if !ok {
				continue
			}
			if result.EffectSize < MinEffectSizeMin || result.PValue >= MaxPValue {
				continue
			}
			if result.RenderedText == "" {
				continue
			}
			id := h.id
			if _, err := e.repo.Upsert(ctx, UpsertInput{
				UserID:         userID,
				HabitID:        &id,
				PatternType:    result.PatternType,
				EffectSize:     result.EffectSize,
				PValue:         result.PValue,
				SampleSize:     result.SampleSize,
				TemplateID:     string(result.TemplateID),
				TemplateParams: result.TemplateParams,
				RenderedText:   result.RenderedText,
			}); err != nil {
				return surfaced, fmt.Errorf("upsert insight: %w", err)
			}
			surfaced++
		}
	}
	return surfaced, nil
}

type habitInfo struct {
	id   uuid.UUID
	name string
	icon string
}

func (e *Engine) fetchHabits(ctx context.Context, userID uuid.UUID) ([]habitInfo, error) {
	rows, err := e.pool.Query(ctx, `
		SELECT id, name, icon FROM habits
		WHERE user_id = $1 AND archived_at IS NULL
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []habitInfo
	for rows.Next() {
		var h habitInfo
		if err := rows.Scan(&h.id, &h.name, &h.icon); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

// fetchDailyRows joins habit_logs (per habit) with daily_summaries and
// check_ins for the same user/date. completed=true rows come from
// habit_logs; days without a log get completed=false to avoid sample bias
// (PRD §8: contingency tables should include both states).
//
// We bound to days that have AT LEAST one of: a habit log, a daily summary,
// or a check-in. Days with nothing at all (user wasn't using the app) are
// excluded as not paired.
func (e *Engine) fetchDailyRows(ctx context.Context, userID, habitID uuid.UUID, since time.Time) ([]dailyRow, error) {
	rows, err := e.pool.Query(ctx, `
		WITH all_dates AS (
			SELECT date FROM daily_summaries WHERE user_id = $1 AND date >= $2
			UNION
			SELECT date FROM check_ins       WHERE user_id = $1 AND date >= $2
			UNION
			SELECT date FROM habit_logs hl
			JOIN habits h ON h.id = hl.habit_id
			WHERE h.user_id = $1 AND hl.date >= $2
		)
		SELECT
			d.date,
			COALESCE(hl.completed, false) AS completed,
			ds.sleep_hours,
			ds.hrv_ms,
			ds.resting_heart_rate,
			ds.steps,
			ds.active_energy_kcal,
			ci.mood::int
		FROM all_dates d
		LEFT JOIN habit_logs       hl ON hl.habit_id = $3 AND hl.date = d.date
		LEFT JOIN daily_summaries  ds ON ds.user_id  = $1 AND ds.date = d.date
		LEFT JOIN check_ins        ci ON ci.user_id  = $1 AND ci.date = d.date
		ORDER BY d.date
	`, userID, since, habitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []dailyRow
	for rows.Next() {
		var r dailyRow
		if err := rows.Scan(
			&r.date, &r.completed,
			&r.sleepHours, &r.hrvMs, &r.restingHeartRate,
			&r.steps, &r.activeEnergy, &r.mood,
		); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}
