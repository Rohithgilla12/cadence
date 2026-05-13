package dailysum

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
	UserID           uuid.UUID
	Date             time.Time
	SleepHours       *float64
	SleepDeepMinutes *int
	SleepRemMinutes  *int
	SleepCoreMinutes *int
	Steps            *int
	DistanceMeters   *int
	ActiveEnergyKcal *int
	RestingHeartRate *int
	HrvMs            *int
	Source           string
}

// Upsert is partial-update: any nil field is left untouched on conflict, so
// the client can re-upload the same day later (e.g. when HRV finally
// computes) without clobbering the earlier sleep numbers. COALESCE pattern
// matches checkin.Upsert.
func (r *Repository) Upsert(ctx context.Context, in UpsertInput) (DailySummary, error) {
	source := in.Source
	if source == "" {
		source = "apple_health"
	}
	row := r.pool.QueryRow(ctx, `
		INSERT INTO daily_summaries (
			user_id, date,
			sleep_hours, sleep_deep_minutes, sleep_rem_minutes, sleep_core_minutes,
			steps, distance_meters, active_energy_kcal,
			resting_heart_rate, hrv_ms, source
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (user_id, date) DO UPDATE SET
			sleep_hours        = COALESCE(EXCLUDED.sleep_hours,        daily_summaries.sleep_hours),
			sleep_deep_minutes = COALESCE(EXCLUDED.sleep_deep_minutes, daily_summaries.sleep_deep_minutes),
			sleep_rem_minutes  = COALESCE(EXCLUDED.sleep_rem_minutes,  daily_summaries.sleep_rem_minutes),
			sleep_core_minutes = COALESCE(EXCLUDED.sleep_core_minutes, daily_summaries.sleep_core_minutes),
			steps              = COALESCE(EXCLUDED.steps,              daily_summaries.steps),
			distance_meters    = COALESCE(EXCLUDED.distance_meters,    daily_summaries.distance_meters),
			active_energy_kcal = COALESCE(EXCLUDED.active_energy_kcal, daily_summaries.active_energy_kcal),
			resting_heart_rate = COALESCE(EXCLUDED.resting_heart_rate, daily_summaries.resting_heart_rate),
			hrv_ms             = COALESCE(EXCLUDED.hrv_ms,             daily_summaries.hrv_ms),
			source             = EXCLUDED.source,
			updated_at         = now()
		RETURNING
			user_id, date,
			sleep_hours, sleep_deep_minutes, sleep_rem_minutes, sleep_core_minutes,
			steps, distance_meters, active_energy_kcal,
			resting_heart_rate, hrv_ms, source, updated_at
	`,
		in.UserID, in.Date,
		in.SleepHours, in.SleepDeepMinutes, in.SleepRemMinutes, in.SleepCoreMinutes,
		in.Steps, in.DistanceMeters, in.ActiveEnergyKcal,
		in.RestingHeartRate, in.HrvMs, source,
	)
	return scan(row)
}

func (r *Repository) Get(ctx context.Context, userID uuid.UUID, date time.Time) (*DailySummary, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT
			user_id, date,
			sleep_hours, sleep_deep_minutes, sleep_rem_minutes, sleep_core_minutes,
			steps, distance_meters, active_energy_kcal,
			resting_heart_rate, hrv_ms, source, updated_at
		FROM daily_summaries
		WHERE user_id = $1 AND date = $2
	`, userID, date)
	s, err := scan(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scan(s rowScanner) (DailySummary, error) {
	var ds DailySummary
	if err := s.Scan(
		&ds.UserID, &ds.Date,
		&ds.SleepHours, &ds.SleepDeepMinutes, &ds.SleepRemMinutes, &ds.SleepCoreMinutes,
		&ds.Steps, &ds.DistanceMeters, &ds.ActiveEnergyKcal,
		&ds.RestingHeartRate, &ds.HrvMs, &ds.Source, &ds.UpdatedAt,
	); err != nil {
		return DailySummary{}, fmt.Errorf("scan daily summary: %w", err)
	}
	return ds, nil
}
