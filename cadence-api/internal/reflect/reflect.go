// Package reflect powers the Reflect tab's aggregations — weekly rhythm
// (this file), consistency heatmap, streaks list. Each function returns a
// shape the client renders directly; no per-habit drill-down at this layer.
// PRD §5 + §7.
package reflect

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// WeekdayBucket is one row of the rhythm view. Index is 0=Mon..6=Sun to
// match the runner-week convention used elsewhere in Cadence.
type WeekdayBucket struct {
	WeekdayIndex   int
	Label          string
	CompletedLogs  int
	TotalSlots     int
	CompletionRate float64
}

type Rhythm struct {
	WindowDays int
	ByWeekday  [7]WeekdayBucket
	// TotalSlots across all weekdays. Below the PRD §8 sample-size threshold
	// (14 paired days) the client renders an "insufficient data" state.
	TotalSlots     int
	TotalCompleted int
}

// ComputeRhythm aggregates per-weekday completion across all the user's
// active habits over the last `windowDays` days. Slots that fall before
// a habit was created don't count as misses — a habit that's been around
// for 3 days can't have missed the Tuesday two weeks ago.
//
// The math is done in a single SQL pass: a generated date series joined
// with the habit set and an outer join to habit_logs. Postgres
// generate_series + EXTRACT(dow) handles the weekday math; we adapt
// dow (0=Sun..6=Sat) to Mon=0 in Go.
func (r *Repository) ComputeRhythm(
	ctx context.Context,
	userID uuid.UUID,
	windowDays int,
	now time.Time,
) (Rhythm, error) {
	if windowDays <= 0 || windowDays > 365 {
		windowDays = 56 // 8 weeks
	}
	end := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	start := end.AddDate(0, 0, -(windowDays - 1))

	// slot_count: for each (habit, day) where day >= habit.created_at::date
	// and day in [start, end], one slot. Bucketed by weekday.
	// completed_count: completed habit_logs in the same window per weekday.
	rows, err := r.pool.Query(ctx, `
		WITH days AS (
			SELECT generate_series($1::date, $2::date, '1 day')::date AS day
		),
		slots AS (
			SELECT EXTRACT(dow FROM d.day)::int AS dow
			FROM days d
			JOIN habits h ON h.user_id = $3
				AND h.archived_at IS NULL
				AND h.created_at::date <= d.day
		),
		done AS (
			SELECT EXTRACT(dow FROM hl.date)::int AS dow
			FROM habit_logs hl
			JOIN habits h ON h.id = hl.habit_id
			WHERE h.user_id = $3
			  AND h.archived_at IS NULL
			  AND hl.completed = true
			  AND hl.date BETWEEN $1::date AND $2::date
		)
		SELECT dow, slot_count, done_count FROM (
			SELECT
				s.dow,
				COUNT(*) AS slot_count,
				COALESCE((SELECT COUNT(*) FROM done d WHERE d.dow = s.dow), 0) AS done_count
			FROM slots s
			GROUP BY s.dow
		) z
		ORDER BY dow
	`, start, end, userID)
	if err != nil {
		return Rhythm{}, fmt.Errorf("query rhythm: %w", err)
	}
	defer rows.Close()

	labels := [7]string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	out := Rhythm{WindowDays: windowDays}
	for i := range out.ByWeekday {
		out.ByWeekday[i] = WeekdayBucket{WeekdayIndex: i, Label: labels[i]}
	}

	for rows.Next() {
		var dow, slotCount, doneCount int
		if err := rows.Scan(&dow, &slotCount, &doneCount); err != nil {
			return Rhythm{}, err
		}
		// Postgres dow: 0=Sun..6=Sat. Cadence convention: 0=Mon..6=Sun.
		idx := (dow + 6) % 7
		bucket := &out.ByWeekday[idx]
		bucket.TotalSlots = slotCount
		bucket.CompletedLogs = doneCount
		if slotCount > 0 {
			bucket.CompletionRate = float64(doneCount) / float64(slotCount)
		}
		out.TotalSlots += slotCount
		out.TotalCompleted += doneCount
	}
	if err := rows.Err(); err != nil {
		return Rhythm{}, err
	}
	return out, nil
}
