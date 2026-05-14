//go:build integration

package http_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func newDailySumTestServer(t *testing.T) (*httptest.Server, *user.User) {
	t.Helper()
	pool := db.TestPool(t)
	db.Truncate(t, pool, "daily_summaries", "users")
	userRepo := user.NewRepository(pool)
	verifier := stubVerifier{id: auth.Identity{FirebaseUID: "uid-ds", Email: "ds@x.com", Name: "DS"}}
	deps := cadencehttp.Deps{
		Pool:           pool,
		Verifier:       verifier,
		Resolver:       auth.UserResolverFromRepository(userRepo),
		Habits:         habit.NewRepository(pool),
		HabitLogs:      habit.NewLogRepository(pool),
		CheckIns:       checkin.NewRepository(pool),
		DailySummaries: dailysum.NewRepository(pool),
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "uid-ds", Email: "ds@x.com", DisplayName: "DS"})
	return srv, &u
}

func TestDailySummaries_UpsertRoundTrip(t *testing.T) {
	srv, _ := newDailySumTestServer(t)
	status, body := doReq(t, srv, http.MethodPut, "/v1/daily-summaries/2026-05-13", map[string]any{
		"sleepHours":       7.8,
		"sleepDeepMinutes": 72,
		"sleepRemMinutes":  95,
		"sleepCoreMinutes": 245,
		"steps":            8421,
		"distanceMeters":   6300,
		"activeEnergyKcal": 412,
		"restingHeartRate": 55,
		"hrvMs":            48,
	})
	if status != http.StatusOK {
		t.Fatalf("status %d body %s", status, body)
	}
	var resp struct {
		DailySummary struct {
			Date             string  `json:"date"`
			SleepHours       float64 `json:"sleepHours"`
			Steps            int     `json:"steps"`
			HrvMs            int     `json:"hrvMs"`
			RestingHeartRate int     `json:"restingHeartRate"`
		} `json:"dailySummary"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.DailySummary.Date != "2026-05-13" || resp.DailySummary.SleepHours != 7.8 ||
		resp.DailySummary.HrvMs != 48 || resp.DailySummary.RestingHeartRate != 55 {
		t.Fatalf("round trip mismatch: %+v", resp.DailySummary)
	}
}

func TestDailySummaries_PartialUpdatePreservesEarlierFields(t *testing.T) {
	srv, _ := newDailySumTestServer(t)

	// First write: only sleep numbers (e.g. client uploaded in the morning
	// before HRV computed).
	status, _ := doReq(t, srv, http.MethodPut, "/v1/daily-summaries/2026-05-13", map[string]any{
		"sleepHours":       7.8,
		"sleepDeepMinutes": 72,
	})
	if status != http.StatusOK {
		t.Fatalf("first put status %d", status)
	}

	// Second write: only HRV. Sleep fields must be preserved.
	status, body := doReq(t, srv, http.MethodPut, "/v1/daily-summaries/2026-05-13", map[string]any{
		"hrvMs": 48,
	})
	if status != http.StatusOK {
		t.Fatalf("second put status %d", status)
	}
	var resp struct {
		DailySummary struct {
			SleepHours       *float64 `json:"sleepHours,omitempty"`
			SleepDeepMinutes *int     `json:"sleepDeepMinutes,omitempty"`
			HrvMs            *int     `json:"hrvMs,omitempty"`
		} `json:"dailySummary"`
	}
	_ = json.Unmarshal(body, &resp)
	if resp.DailySummary.SleepHours == nil || *resp.DailySummary.SleepHours != 7.8 {
		t.Fatalf("sleepHours not preserved: %+v", resp.DailySummary)
	}
	if resp.DailySummary.SleepDeepMinutes == nil || *resp.DailySummary.SleepDeepMinutes != 72 {
		t.Fatalf("sleepDeepMinutes not preserved: %+v", resp.DailySummary)
	}
	if resp.DailySummary.HrvMs == nil || *resp.DailySummary.HrvMs != 48 {
		t.Fatalf("hrvMs not stored: %+v", resp.DailySummary)
	}
}

func TestDailySummaries_BulkImport(t *testing.T) {
	srv, _ := newDailySumTestServer(t)

	// Build a 14-day window so the test exercises a realistic onboarding
	// retroactive-import payload, not a toy one.
	summaries := make([]map[string]any, 0, 14)
	for i := 14; i > 0; i-- {
		summaries = append(summaries, map[string]any{
			"date":             "2026-05-" + leftPad(13-i+14, 2),
			"sleepHours":       6.5 + float64(i%3)*0.5,
			"sleepDeepMinutes": 70 + i,
			"hrvMs":            40 + i,
			"restingHeartRate": 55,
		})
	}
	status, body := doReq(t, srv, http.MethodPost, "/v1/daily-summaries/bulk", map[string]any{
		"summaries": summaries,
	})
	if status != http.StatusOK {
		t.Fatalf("bulk status %d body %s", status, body)
	}
	var resp struct {
		Imported int `json:"imported"`
	}
	_ = json.Unmarshal(body, &resp)
	if resp.Imported != 14 {
		t.Fatalf("expected 14 imported, got %d", resp.Imported)
	}
}

func TestDailySummaries_BulkRejectsBadEntry(t *testing.T) {
	srv, _ := newDailySumTestServer(t)
	status, _ := doReq(t, srv, http.MethodPost, "/v1/daily-summaries/bulk", map[string]any{
		"summaries": []map[string]any{
			{"date": "2026-05-13", "sleepHours": 7.0},
			{"date": "2026-05-14", "sleepHours": 99.0}, // impossible
		},
	})
	if status != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", status)
	}
}

func TestDailySummaries_BulkRejectsTooMany(t *testing.T) {
	srv, _ := newDailySumTestServer(t)
	summaries := make([]map[string]any, 0, 95)
	for i := 0; i < 95; i++ {
		summaries = append(summaries, map[string]any{
			"date":       "2026-01-" + leftPad(i+1, 2),
			"sleepHours": 7.0,
		})
	}
	status, _ := doReq(t, srv, http.MethodPost, "/v1/daily-summaries/bulk", map[string]any{
		"summaries": summaries,
	})
	if status != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", status)
	}
}

// leftPad renders an int with a fixed minimum width using zero padding —
// just enough for ISO date components without pulling in fmt.Sprintf.
func leftPad(n, width int) string {
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	for len(s) < width {
		s = "0" + s
	}
	if s == "" {
		s = "0"
	}
	return s
}

func TestDailySummaries_RejectsImpossibleValues(t *testing.T) {
	srv, _ := newDailySumTestServer(t)

	cases := []struct {
		name string
		body map[string]any
	}{
		{"sleep > 24h", map[string]any{"sleepHours": 30.0}},
		{"hrv too high", map[string]any{"hrvMs": 1000}},
		{"rhr too low", map[string]any{"restingHeartRate": 10}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, _ := doReq(t, srv, http.MethodPut, "/v1/daily-summaries/2026-05-13", tc.body)
			if status != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d", status)
			}
		})
	}
}
