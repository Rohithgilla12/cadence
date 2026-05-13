//go:build integration

package insight_test

import (
	"context"
	"testing"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
	"github.com/google/uuid"
)

// TestEngine_SleepCompletionPattern_SurfacedWhenStrong seeds 30 days of
// fake data where high-sleep days correlate strongly with completion and
// asserts an insight is produced with the expected pattern_type.
func TestEngine_SleepCompletionPattern_SurfacedWhenStrong(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "insights", "habit_logs", "daily_summaries", "check_ins", "habits", "users")
	ctx := context.Background()

	userRepo := user.NewRepository(pool)
	u, err := userRepo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{FirebaseUID: "uid-engine-1", Email: "e@x.com", DisplayName: "Engine"})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}

	// Insert a habit with a known icon → verb mapping.
	var habitID uuid.UUID
	if err := pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, name, icon, time_of_day, track_context)
		VALUES ($1, 'Morning run', 'run', 'morning', true)
		RETURNING id
	`, u.ID).Scan(&habitID); err != nil {
		t.Fatalf("seed habit: %v", err)
	}

	// 30 days: alternate low-sleep (5h, not done) and high-sleep (8h, done).
	// Perfect contingency gives Cramér's V = 1, p ≈ 0.
	today := time.Now().UTC().Truncate(24 * time.Hour)
	for i := 0; i < 30; i++ {
		date := today.AddDate(0, 0, -(i + 1))
		var sleep float64
		var completed bool
		if i%2 == 0 {
			sleep, completed = 8.0, true
		} else {
			sleep, completed = 5.0, false
		}
		if _, err := pool.Exec(ctx, `
			INSERT INTO daily_summaries (user_id, date, sleep_hours, source)
			VALUES ($1, $2, $3, 'apple_health')
		`, u.ID, date, sleep); err != nil {
			t.Fatalf("seed daily_summary: %v", err)
		}
		if completed {
			if _, err := pool.Exec(ctx, `
				INSERT INTO habit_logs (habit_id, date, completed, source)
				VALUES ($1, $2, true, 'manual')
			`, habitID, date); err != nil {
				t.Fatalf("seed log: %v", err)
			}
		}
	}

	engine := insight.NewEngine(pool, insight.NewRepository(pool))
	surfaced, err := engine.ComputeForUser(ctx, u.ID)
	if err != nil {
		t.Fatalf("compute: %v", err)
	}
	if surfaced < 1 {
		t.Fatalf("expected at least 1 surfaced insight, got %d", surfaced)
	}

	// Verify the sleep insight specifically landed and reads sensibly.
	var rendered string
	var effectSize, pValue float64
	if err := pool.QueryRow(ctx, `
		SELECT rendered_text, effect_size, p_value
		FROM insights
		WHERE user_id = $1 AND habit_id = $2 AND pattern_type = 'sleep_x_completion'
	`, u.ID, habitID).Scan(&rendered, &effectSize, &pValue); err != nil {
		t.Fatalf("lookup insight: %v", err)
	}
	if effectSize < 0.5 {
		t.Fatalf("expected strong effect, got %v", effectSize)
	}
	if pValue >= 0.05 {
		t.Fatalf("expected significant p, got %v", pValue)
	}
	if rendered == "" {
		t.Fatalf("rendered text is empty")
	}
}

func TestEngine_NoiseProducesNoStrongInsight(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "insights", "habit_logs", "daily_summaries", "check_ins", "habits", "users")
	ctx := context.Background()

	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{FirebaseUID: "uid-engine-2", Email: "e2@x.com", DisplayName: "Engine2"})
	var habitID uuid.UUID
	pool.QueryRow(ctx, `INSERT INTO habits (user_id, name, icon) VALUES ($1, 'Run', 'run') RETURNING id`, u.ID).Scan(&habitID)

	// 20 days of identical sleep → no signal possible.
	today := time.Now().UTC().Truncate(24 * time.Hour)
	for i := 0; i < 20; i++ {
		date := today.AddDate(0, 0, -(i + 1))
		pool.Exec(ctx, `INSERT INTO daily_summaries (user_id, date, sleep_hours) VALUES ($1, $2, 7.0)`, u.ID, date)
		if i%3 == 0 { // arbitrary completion pattern uncoupled from sleep
			pool.Exec(ctx, `INSERT INTO habit_logs (habit_id, date, completed) VALUES ($1, $2, true)`, habitID, date)
		}
	}

	engine := insight.NewEngine(pool, insight.NewRepository(pool))
	_, err := engine.ComputeForUser(ctx, u.ID)
	if err != nil {
		t.Fatalf("compute: %v", err)
	}

	// No surfaced rendered text should exist.
	var count int
	pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM insights
		WHERE user_id = $1 AND rendered_text <> ''
	`, u.ID).Scan(&count)
	if count != 0 {
		t.Fatalf("expected no surfaced insights for noise, got %d", count)
	}
}

func TestEngine_IdempotentUpsert(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "insights", "habit_logs", "daily_summaries", "check_ins", "habits", "users")
	ctx := context.Background()

	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{FirebaseUID: "uid-engine-3", Email: "e3@x.com", DisplayName: "Engine3"})
	var habitID uuid.UUID
	pool.QueryRow(ctx, `INSERT INTO habits (user_id, name, icon) VALUES ($1, 'Run', 'run') RETURNING id`, u.ID).Scan(&habitID)
	today := time.Now().UTC().Truncate(24 * time.Hour)
	for i := 0; i < 30; i++ {
		date := today.AddDate(0, 0, -(i + 1))
		sleep := 5.0
		if i%2 == 0 {
			sleep = 8.0
		}
		pool.Exec(ctx, `INSERT INTO daily_summaries (user_id, date, sleep_hours) VALUES ($1, $2, $3)`, u.ID, date, sleep)
		if sleep == 8.0 {
			pool.Exec(ctx, `INSERT INTO habit_logs (habit_id, date, completed) VALUES ($1, $2, true)`, habitID, date)
		}
	}

	engine := insight.NewEngine(pool, insight.NewRepository(pool))
	// Run twice — should NOT duplicate rows thanks to the unique constraint.
	if _, err := engine.ComputeForUser(ctx, u.ID); err != nil {
		t.Fatalf("first compute: %v", err)
	}
	if _, err := engine.ComputeForUser(ctx, u.ID); err != nil {
		t.Fatalf("second compute: %v", err)
	}
	var count int
	pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM insights
		WHERE user_id = $1 AND pattern_type = 'sleep_x_completion'
	`, u.ID).Scan(&count)
	if count != 1 {
		t.Fatalf("expected 1 row after re-compute, got %d", count)
	}
}
