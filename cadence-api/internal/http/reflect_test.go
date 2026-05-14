//go:build integration

package http_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/circle"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/feed"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/pact"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/reflect"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func reflectServer(t *testing.T, pool *pgxpool.Pool, firebaseUID string) (*httptest.Server, *user.User) {
	t.Helper()
	userRepo := user.NewRepository(pool)
	verifier := stubVerifier{id: auth.Identity{FirebaseUID: firebaseUID, Email: firebaseUID + "@x.com", Name: firebaseUID}}
	insightRepo := insight.NewRepository(pool)
	deps := cadencehttp.Deps{
		Pool:           pool,
		Verifier:       verifier,
		Resolver:       auth.UserResolverFromRepository(userRepo),
		Habits:         habit.NewRepository(pool),
		HabitLogs:      habit.NewLogRepository(pool),
		CheckIns:       checkin.NewRepository(pool),
		DailySummaries: dailysum.NewRepository(pool),
		InsightEngine:  insight.NewEngine(pool, insightRepo),
		Insights:       insightRepo,
		Circles:        circle.NewRepository(pool),
		Pacts:          pact.NewRepository(pool),
		Feed:           feed.NewRepository(pool),
		Reflect:        reflect.NewRepository(pool),
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{
		FirebaseUID: firebaseUID, Email: firebaseUID + "@x.com", DisplayName: firebaseUID,
	})
	return srv, &u
}

func TestReflect_RhythmBucketsByWeekday(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "habits", "users")
	srv, u := reflectServer(t, pool, "uid-rhythm-1")

	// Seed a habit that's been around for 8 weeks. Complete it every Monday
	// and every Wednesday in that window; skip every other day. Mondays
	// and Wednesdays should hit ~100% completion, others 0%.
	ctx := context.Background()
	var habitID uuid.UUID
	pool.QueryRow(ctx, `
		INSERT INTO habits (user_id, name, icon, created_at)
		VALUES ($1, 'Test', 'sparkles', now() - interval '60 days')
		RETURNING id
	`, u.ID).Scan(&habitID)

	now := time.Now().UTC()
	for i := 0; i < 56; i++ {
		date := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -i)
		dow := int(date.Weekday()) // 0=Sun..6=Sat
		if dow == 1 || dow == 3 {  // Mon or Wed
			pool.Exec(ctx, `
				INSERT INTO habit_logs (habit_id, date, completed) VALUES ($1, $2, true)
				ON CONFLICT (habit_id, date) DO NOTHING
			`, habitID, date)
		}
	}

	status, body := doReq(t, srv, http.MethodGet, "/v1/reflect/rhythm?windowDays=56", nil)
	if status != http.StatusOK {
		t.Fatalf("status %d body %s", status, body)
	}
	var resp struct {
		Rhythm struct {
			WindowDays int `json:"windowDays"`
			ByWeekday  []struct {
				WeekdayIndex   int     `json:"weekdayIndex"`
				Label          string  `json:"label"`
				CompletionRate float64 `json:"completionRate"`
				TotalSlots     int     `json:"totalSlots"`
				CompletedLogs  int     `json:"completedLogs"`
			} `json:"byWeekday"`
		} `json:"rhythm"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("decode: %v body=%s", err, body)
	}
	if len(resp.Rhythm.ByWeekday) != 7 {
		t.Fatalf("expected 7 weekday buckets, got %d", len(resp.Rhythm.ByWeekday))
	}
	for _, b := range resp.Rhythm.ByWeekday {
		switch b.Label {
		case "Mon", "Wed":
			if b.CompletionRate < 0.95 {
				t.Fatalf("%s completion rate %v, expected ~1.0", b.Label, b.CompletionRate)
			}
		default:
			if b.CompletionRate > 0.05 {
				t.Fatalf("%s completion rate %v, expected ~0", b.Label, b.CompletionRate)
			}
		}
	}
}

func TestReflect_RhythmIsZeroWhenNoHabits(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "habits", "users")
	srv, _ := reflectServer(t, pool, "uid-rhythm-empty")

	status, body := doReq(t, srv, http.MethodGet, "/v1/reflect/rhythm", nil)
	if status != http.StatusOK {
		t.Fatalf("status %d body %s", status, body)
	}
	var resp struct {
		Rhythm struct {
			TotalSlots int `json:"totalSlots"`
		} `json:"rhythm"`
	}
	_ = json.Unmarshal(body, &resp)
	if resp.Rhythm.TotalSlots != 0 {
		t.Fatalf("expected 0 slots, got %d", resp.Rhythm.TotalSlots)
	}
}
