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
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func newCirclesTestServer(t *testing.T, firebaseUID string) (*httptest.Server, *user.User) {
	t.Helper()
	pool := db.TestPool(t)
	db.Truncate(t, pool, "reactions", "circle_feed_items", "pact_progress", "pacts", "circle_members", "circles", "users")
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
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{
		FirebaseUID: firebaseUID, Email: firebaseUID + "@x.com", DisplayName: firebaseUID,
	})
	return srv, &u
}

func TestCircles_CreateAddsCreatorAsMember(t *testing.T) {
	srv, _ := newCirclesTestServer(t, "uid-c1")

	status, body := doReq(t, srv, http.MethodPost, "/v1/circles", map[string]any{
		"name": "Sunday runners",
	})
	if status != http.StatusCreated {
		t.Fatalf("create status %d body %s", status, body)
	}
	var created struct {
		Circle struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			InviteToken string `json:"inviteToken"`
		} `json:"circle"`
	}
	_ = json.Unmarshal(body, &created)
	if created.Circle.Name != "Sunday runners" || created.Circle.InviteToken == "" {
		t.Fatalf("unexpected: %+v", created.Circle)
	}

	// Creator should appear in the members list with role=creator.
	status, body = doReq(t, srv, http.MethodGet, "/v1/circles/"+created.Circle.ID, nil)
	if status != http.StatusOK {
		t.Fatalf("get status %d body %s", status, body)
	}
	var detail struct {
		Members []struct {
			DisplayName string `json:"displayName"`
			Role        string `json:"role"`
		} `json:"members"`
	}
	_ = json.Unmarshal(body, &detail)
	if len(detail.Members) != 1 || detail.Members[0].Role != "creator" {
		t.Fatalf("unexpected members: %+v", detail.Members)
	}
}

func TestCircles_JoinByTokenAndListVisible(t *testing.T) {
	// Two users, two test servers. The first creates the circle, the
	// second joins it via the invite token. Each test server uses its own
	// firebase uid so the verifier resolves to the right user.
	srv1, _ := newCirclesTestServer(t, "uid-creator")
	status, body := doReq(t, srv1, http.MethodPost, "/v1/circles", map[string]any{"name": "Sat AM"})
	if status != http.StatusCreated {
		t.Fatalf("create %d %s", status, body)
	}
	var created struct {
		Circle struct {
			ID          string `json:"id"`
			InviteToken string `json:"inviteToken"`
		} `json:"circle"`
	}
	_ = json.Unmarshal(body, &created)

	// The truncate inside newCirclesTestServer would wipe the first user.
	// Instead seed user 2 directly through the auth path on the same DB
	// pool by hitting an authenticated endpoint with a new firebase uid.
	pool := db.TestPool(t)
	userRepo := user.NewRepository(pool)
	verifier := stubVerifier{id: auth.Identity{FirebaseUID: "uid-joiner", Email: "j@x.com", Name: "Joiner"}}
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
	}
	srv2 := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv2.Close)

	status, body = doReq(t, srv2, http.MethodPost, "/v1/circles/join/"+created.Circle.InviteToken, nil)
	if status != http.StatusOK {
		t.Fatalf("join %d %s", status, body)
	}

	// Joiner should now see the circle in their list.
	status, body = doReq(t, srv2, http.MethodGet, "/v1/circles", nil)
	if status != http.StatusOK {
		t.Fatalf("list %d %s", status, body)
	}
	var listed struct {
		Circles []struct {
			ID string `json:"id"`
		} `json:"circles"`
	}
	_ = json.Unmarshal(body, &listed)
	if len(listed.Circles) != 1 || listed.Circles[0].ID != created.Circle.ID {
		t.Fatalf("unexpected joiner list: %+v", listed.Circles)
	}

	// Re-joining the same token is idempotent (no 409, no duplicate row).
	status, _ = doReq(t, srv2, http.MethodPost, "/v1/circles/join/"+created.Circle.InviteToken, nil)
	if status != http.StatusOK {
		t.Fatalf("re-join not idempotent: %d", status)
	}
}

func TestCircles_NonMemberCannotRead(t *testing.T) {
	srv1, _ := newCirclesTestServer(t, "uid-owner")
	_, body := doReq(t, srv1, http.MethodPost, "/v1/circles", map[string]any{"name": "Private"})
	var created struct {
		Circle struct {
			ID string `json:"id"`
		} `json:"circle"`
	}
	_ = json.Unmarshal(body, &created)

	// Second user, no join.
	pool := db.TestPool(t)
	userRepo := user.NewRepository(pool)
	verifier := stubVerifier{id: auth.Identity{FirebaseUID: "uid-stranger", Email: "s@x.com", Name: "Stranger"}}
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
	}
	srv2 := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv2.Close)

	status, _ := doReq(t, srv2, http.MethodGet, "/v1/circles/"+created.Circle.ID, nil)
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 for non-member, got %d", status)
	}
}
