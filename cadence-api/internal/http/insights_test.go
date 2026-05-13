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
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
	"github.com/google/uuid"
)

func newInsightTestServer(t *testing.T) (*httptest.Server, *user.User) {
	t.Helper()
	pool := db.TestPool(t)
	db.Truncate(t, pool, "insights", "habit_logs", "daily_summaries", "check_ins", "habits", "users")
	userRepo := user.NewRepository(pool)
	verifier := stubVerifier{id: auth.Identity{FirebaseUID: "uid-ins", Email: "i@x.com", Name: "I"}}
	insightRepo := insight.NewRepository(pool)
	insightEngine := insight.NewEngine(pool, insightRepo)
	deps := cadencehttp.Deps{
		Pool:           pool,
		Verifier:       verifier,
		Resolver:       auth.UserResolverFromRepository(userRepo),
		Habits:         habit.NewRepository(pool),
		HabitLogs:      habit.NewLogRepository(pool),
		CheckIns:       checkin.NewRepository(pool),
		DailySummaries: dailysum.NewRepository(pool),
		InsightEngine:  insightEngine,
		Insights:       insightRepo,
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "uid-ins", Email: "i@x.com", DisplayName: "I"})
	return srv, &u
}

// seedSleepCompletionPattern inserts a strong-but-realistic sleep-completion
// pattern that the engine surfaces as an insight when run. Returns the
// habit_id so callers can reference it in assertions.
func seedSleepCompletionPattern(t *testing.T, srv *httptest.Server, u *user.User) uuid.UUID {
	t.Helper()
	pool := db.TestPool(t)

	var habitID uuid.UUID
	if err := pool.QueryRow(context.Background(), `
		INSERT INTO habits (user_id, name, icon, time_of_day) VALUES ($1, 'Morning run', 'run', 'morning')
		RETURNING id
	`, u.ID).Scan(&habitID); err != nil {
		t.Fatalf("seed habit: %v", err)
	}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	highSleepCompletion := []bool{true, true, true, true, true, false, true, true, true, true, true, true, false, true, true}
	lowSleepCompletion := []bool{false, false, true, false, false, false, false, true, false, false, false, false, false, false, true}
	for i := 0; i < 30; i++ {
		date := today.AddDate(0, 0, -(i + 1))
		half := i / 2
		var sleep float64
		var completed bool
		if i%2 == 0 {
			sleep = 8.0
			completed = highSleepCompletion[half]
		} else {
			sleep = 5.0
			completed = lowSleepCompletion[half]
		}
		pool.Exec(context.Background(), `INSERT INTO daily_summaries (user_id, date, sleep_hours) VALUES ($1, $2, $3)`, u.ID, date, sleep)
		if completed {
			pool.Exec(context.Background(), `INSERT INTO habit_logs (habit_id, date, completed) VALUES ($1, $2, true)`, habitID, date)
		}
	}
	return habitID
}

func TestInsights_TodayReturnsNullWhenNothingComputed(t *testing.T) {
	srv, _ := newInsightTestServer(t)
	status, body := doReq(t, srv, http.MethodGet, "/v1/insights/today", nil)
	if status != http.StatusOK {
		t.Fatalf("status %d body %s", status, body)
	}
	var resp struct {
		Insight *map[string]any `json:"insight"`
	}
	_ = json.Unmarshal(body, &resp)
	if resp.Insight != nil {
		t.Fatalf("expected insight=null, got %v", resp.Insight)
	}
}

func TestInsights_ComputeThenTodayReturnsTopInsightAndStampsShown(t *testing.T) {
	srv, u := newInsightTestServer(t)
	seedSleepCompletionPattern(t, srv, u)

	// Trigger compute.
	status, body := doReq(t, srv, http.MethodPost, "/v1/insights/compute", nil)
	if status != http.StatusOK {
		t.Fatalf("compute status %d body %s", status, body)
	}
	var computeResp struct {
		Surfaced int `json:"surfaced"`
	}
	_ = json.Unmarshal(body, &computeResp)
	if computeResp.Surfaced < 1 {
		t.Fatalf("expected at least 1 surfaced, got %d", computeResp.Surfaced)
	}

	// First fetch returns the insight.
	status, body = doReq(t, srv, http.MethodGet, "/v1/insights/today", nil)
	if status != http.StatusOK {
		t.Fatalf("today status %d body %s", status, body)
	}
	var resp struct {
		Insight *struct {
			ID           string `json:"id"`
			RenderedText string `json:"renderedText"`
			ShownAt      string `json:"shownAt"`
		} `json:"insight"`
	}
	_ = json.Unmarshal(body, &resp)
	if resp.Insight == nil || resp.Insight.RenderedText == "" {
		t.Fatalf("expected insight returned, got %v", resp.Insight)
	}
	firstID := resp.Insight.ID

	// Second fetch within the 7-day cooldown: shouldn't return the same one.
	status, body = doReq(t, srv, http.MethodGet, "/v1/insights/today", nil)
	if status != http.StatusOK {
		t.Fatalf("repeat today status %d", status)
	}
	_ = json.Unmarshal(body, &resp)
	if resp.Insight != nil && resp.Insight.ID == firstID {
		t.Fatalf("same insight returned twice within cooldown")
	}
}

func TestInsights_ListReturnsAllAboveThreshold(t *testing.T) {
	srv, u := newInsightTestServer(t)
	seedSleepCompletionPattern(t, srv, u)
	doReq(t, srv, http.MethodPost, "/v1/insights/compute", nil)

	status, body := doReq(t, srv, http.MethodGet, "/v1/insights", nil)
	if status != http.StatusOK {
		t.Fatalf("list status %d body %s", status, body)
	}
	var resp struct {
		Insights []map[string]any `json:"insights"`
	}
	_ = json.Unmarshal(body, &resp)
	if len(resp.Insights) < 1 {
		t.Fatalf("expected at least 1 insight, got %d", len(resp.Insights))
	}
}
