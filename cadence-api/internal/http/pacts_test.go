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
	"github.com/Rohithgilla12/cadence/cadence-api/internal/circle"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/pact"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func newPactTestServer(t *testing.T, firebaseUID string) (*httptest.Server, *user.User) {
	t.Helper()
	pool := db.TestPool(t)
	db.Truncate(t, pool,
		"reactions", "circle_feed_items", "pact_progress", "pacts",
		"circle_members", "circles", "users",
	)
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
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{
		FirebaseUID: firebaseUID, Email: firebaseUID + "@x.com", DisplayName: firebaseUID,
	})
	return srv, &u
}

// Joins user 2 onto the same DB pool. Returns a server that authenticates
// as that user. Used for the cross-member tests below.
func joinPactTestServer(t *testing.T, firebaseUID string) *httptest.Server {
	t.Helper()
	pool := db.TestPool(t)
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
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	return srv
}

func TestPacts_CreateSeedsProgressForAllMembers(t *testing.T) {
	srv, _ := newPactTestServer(t, "uid-pact-1")
	_, body := doReq(t, srv, http.MethodPost, "/v1/circles", map[string]any{"name": "P"})
	var created struct {
		Circle struct {
			ID          string `json:"id"`
			InviteToken string `json:"inviteToken"`
		} `json:"circle"`
	}
	_ = json.Unmarshal(body, &created)

	// Second user joins so we get a 2-member circle.
	srv2 := joinPactTestServer(t, "uid-pact-2")
	doReq(t, srv2, http.MethodPost, "/v1/circles/join/"+created.Circle.InviteToken, nil)

	status, body := doReq(t, srv, http.MethodPost, "/v1/circles/"+created.Circle.ID+"/pacts",
		map[string]any{
			"text":      "3 runs this week",
			"startDate": "2026-05-11",
			"endDate":   "2026-05-18",
		})
	if status != http.StatusCreated {
		t.Fatalf("create status %d body %s", status, body)
	}
	var resp struct {
		Pact struct {
			Progress []struct {
				DisplayName string `json:"displayName"`
				Completed   bool   `json:"completed"`
			} `json:"progress"`
		} `json:"pact"`
	}
	_ = json.Unmarshal(body, &resp)
	if len(resp.Pact.Progress) != 2 {
		t.Fatalf("expected progress for both members, got %d", len(resp.Pact.Progress))
	}
	for _, p := range resp.Pact.Progress {
		if p.Completed {
			t.Fatalf("expected completed=false on fresh pact, got true for %s", p.DisplayName)
		}
	}
}

func TestPacts_CompleteFlipsCallerProgress(t *testing.T) {
	srv, _ := newPactTestServer(t, "uid-pact-3")
	_, body := doReq(t, srv, http.MethodPost, "/v1/circles", map[string]any{"name": "C"})
	var created struct {
		Circle struct {
			ID string `json:"id"`
		} `json:"circle"`
	}
	_ = json.Unmarshal(body, &created)

	status, body := doReq(t, srv, http.MethodPost, "/v1/circles/"+created.Circle.ID+"/pacts",
		map[string]any{
			"text":      "Long run Sunday",
			"startDate": "2026-05-11",
			"endDate":   "2026-05-18",
		})
	if status != http.StatusCreated {
		t.Fatalf("create %d %s", status, body)
	}
	var pactResp struct {
		Pact struct {
			ID string `json:"id"`
		} `json:"pact"`
	}
	_ = json.Unmarshal(body, &pactResp)

	status, _ = doReq(t, srv, http.MethodPost, "/v1/pacts/"+pactResp.Pact.ID+"/complete", nil)
	if status != http.StatusNoContent {
		t.Fatalf("complete status %d", status)
	}

	// List pacts — caller's progress row should now show completed=true.
	_, body = doReq(t, srv, http.MethodGet, "/v1/circles/"+created.Circle.ID+"/pacts", nil)
	var listed struct {
		Pacts []struct {
			Progress []struct {
				Completed bool `json:"completed"`
			} `json:"progress"`
		} `json:"pacts"`
	}
	_ = json.Unmarshal(body, &listed)
	if len(listed.Pacts) != 1 || len(listed.Pacts[0].Progress) != 1 || !listed.Pacts[0].Progress[0].Completed {
		t.Fatalf("expected single member completed=true, got %+v", listed.Pacts)
	}
}

func TestPacts_NonMemberCannotCreateOrList(t *testing.T) {
	srvOwner, _ := newPactTestServer(t, "uid-pact-owner")
	_, body := doReq(t, srvOwner, http.MethodPost, "/v1/circles", map[string]any{"name": "Owned"})
	var created struct {
		Circle struct {
			ID string `json:"id"`
		} `json:"circle"`
	}
	_ = json.Unmarshal(body, &created)

	srvStranger := joinPactTestServer(t, "uid-pact-stranger")
	status, _ := doReq(t, srvStranger, http.MethodPost, "/v1/circles/"+created.Circle.ID+"/pacts",
		map[string]any{
			"text":      "Stealth pact",
			"startDate": "2026-05-11",
			"endDate":   "2026-05-18",
		})
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 for non-member create, got %d", status)
	}
	status, _ = doReq(t, srvStranger, http.MethodGet, "/v1/circles/"+created.Circle.ID+"/pacts", nil)
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 for non-member list, got %d", status)
	}
}
