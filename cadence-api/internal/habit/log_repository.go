package habit

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LogRepository struct {
	pool *pgxpool.Pool
}

func NewLogRepository(pool *pgxpool.Pool) *LogRepository {
	return &LogRepository{pool: pool}
}

type UpsertLogInput struct {
	HabitID   uuid.UUID
	Date      time.Time
	Completed bool
	Value     *float64
	Source    LogSource
}

func (r *LogRepository) Upsert(ctx context.Context, in UpsertLogInput) (Log, error) {
	src := in.Source
	if src == "" {
		src = SourceManual
	}
	row := r.pool.QueryRow(ctx, `
		INSERT INTO habit_logs (habit_id, date, completed, value, source)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (habit_id, date)
		DO UPDATE SET completed = EXCLUDED.completed, value = EXCLUDED.value, source = EXCLUDED.source, logged_at = now()
		RETURNING id, habit_id, date, completed, value, source, logged_at, skip_reason
	`, in.HabitID, in.Date, in.Completed, in.Value, string(src))
	var l Log
	var srcStr string
	if err := row.Scan(&l.ID, &l.HabitID, &l.Date, &l.Completed, &l.Value, &srcStr, &l.LoggedAt, &l.SkipReason); err != nil {
		return Log{}, fmt.Errorf("scan log: %w", err)
	}
	l.Source = LogSource(srcStr)
	return l, nil
}

func (r *LogRepository) Delete(ctx context.Context, habitID uuid.UUID, date time.Time) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM habit_logs WHERE habit_id = $1 AND date = $2`, habitID, date)
	return err
}

// RecentCompletedDates returns up to `limit` most-recent completed dates for a habit,
// sorted descending. Used by streak computation and the Today screen.
func (r *LogRepository) RecentCompletedDates(ctx context.Context, habitID uuid.UUID, today time.Time, limit int) ([]time.Time, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT date FROM habit_logs
		WHERE habit_id = $1 AND completed = true AND date <= $2
		ORDER BY date DESC
		LIMIT $3
	`, habitID, today, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []time.Time
	for rows.Next() {
		var d time.Time
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// DoneByDate returns a map of habitID -> completed for the given date, scoped to the
// provided habit IDs. Used to enrich the habit list response.
func (r *LogRepository) DoneByDate(ctx context.Context, habitIDs []uuid.UUID, date time.Time) (map[uuid.UUID]bool, error) {
	out := make(map[uuid.UUID]bool, len(habitIDs))
	if len(habitIDs) == 0 {
		return out, nil
	}
	rows, err := r.pool.Query(ctx, `
		SELECT habit_id, completed
		FROM habit_logs
		WHERE habit_id = ANY($1) AND date = $2
	`, habitIDs, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id uuid.UUID
		var completed bool
		if err := rows.Scan(&id, &completed); err != nil {
			return nil, err
		}
		out[id] = completed
	}
	return out, rows.Err()
}
