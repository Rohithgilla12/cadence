//go:build integration

package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func newTestServer(t *testing.T) (*httptest.Server, *user.User) {
	t.Helper()
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "check_ins", "habits", "users")
	userRepo := user.NewRepository(pool)
	verifier := stubVerifier{id: auth.Identity{FirebaseUID: "uid-h", Email: "h@x.com", Name: "H"}}
	deps := cadencehttp.Deps{
		Pool:      pool,
		Verifier:  verifier,
		Resolver:  auth.UserResolverFromRepository(userRepo),
		Habits:    habit.NewRepository(pool),
		HabitLogs: habit.NewLogRepository(pool),
		CheckIns:  checkin.NewRepository(pool),
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "uid-h", Email: "h@x.com", DisplayName: "H"})
	return srv, &u
}

func doReq(t *testing.T, srv *httptest.Server, method, path string, body any) (int, []byte) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, srv.URL+path, &buf)
	req.Header.Set("Authorization", "Bearer anything")
	req.Header.Set("Content-Type", "application/json")
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	bs, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, bs
}

func TestHabits_CreateThenList(t *testing.T) {
	srv, _ := newTestServer(t)

	status, body := doReq(t, srv, http.MethodPost, "/v1/habits", map[string]any{
		"name": "Morning run", "icon": "run", "timeOfDay": "morning",
		"target": map[string]any{"value": 30, "unit": "min"}, "trackContext": true,
	})
	if status != http.StatusCreated {
		t.Fatalf("create status %d body %s", status, body)
	}

	status, body = doReq(t, srv, http.MethodGet, "/v1/habits", nil)
	if status != http.StatusOK {
		t.Fatalf("list status %d body %s", status, body)
	}
	var listed struct {
		Habits []struct {
			Name      string `json:"name"`
			DoneToday bool   `json:"doneToday"`
			Streak    int    `json:"streak"`
		} `json:"habits"`
	}
	if err := json.Unmarshal(body, &listed); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(listed.Habits) != 1 || listed.Habits[0].Name != "Morning run" {
		t.Fatalf("got %+v", listed.Habits)
	}
	if listed.Habits[0].DoneToday {
		t.Fatalf("brand-new habit should not be done today")
	}
}

func TestHabits_ToggleFlipsDoneAndStreak(t *testing.T) {
	srv, _ := newTestServer(t)
	_, body := doReq(t, srv, http.MethodPost, "/v1/habits", map[string]any{
		"name": "Run", "icon": "run",
	})
	var created struct {
		Habit struct {
			ID string `json:"id"`
		} `json:"habit"`
	}
	_ = json.Unmarshal(body, &created)
	id := created.Habit.ID

	status, body := doReq(t, srv, http.MethodPost, "/v1/habits/"+id+"/toggle", nil)
	if status != http.StatusOK {
		t.Fatalf("toggle status %d body %s", status, body)
	}
	var toggled struct {
		Habit struct {
			DoneToday bool `json:"doneToday"`
			Streak    int  `json:"streak"`
		} `json:"habit"`
	}
	_ = json.Unmarshal(body, &toggled)
	if !toggled.Habit.DoneToday || toggled.Habit.Streak != 1 {
		t.Fatalf("after first toggle: %+v", toggled.Habit)
	}

	_, body = doReq(t, srv, http.MethodPost, "/v1/habits/"+id+"/toggle", nil)
	_ = json.Unmarshal(body, &toggled)
	if toggled.Habit.DoneToday || toggled.Habit.Streak != 0 {
		t.Fatalf("after second toggle: %+v", toggled.Habit)
	}
}

func TestHabits_ArchiveRemovesFromList(t *testing.T) {
	srv, _ := newTestServer(t)
	_, body := doReq(t, srv, http.MethodPost, "/v1/habits", map[string]any{"name": "Bye", "icon": "sparkles"})
	var created struct {
		Habit struct {
			ID string `json:"id"`
		} `json:"habit"`
	}
	_ = json.Unmarshal(body, &created)

	status, _ := doReq(t, srv, http.MethodDelete, "/v1/habits/"+created.Habit.ID, nil)
	if status != http.StatusNoContent {
		t.Fatalf("archive status %d", status)
	}
	_, body = doReq(t, srv, http.MethodGet, "/v1/habits", nil)
	var listed struct {
		Habits []any `json:"habits"`
	}
	_ = json.Unmarshal(body, &listed)
	if len(listed.Habits) != 0 {
		t.Fatalf("expected empty list, got %v", listed.Habits)
	}
}
