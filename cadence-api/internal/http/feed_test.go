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
	"github.com/Rohithgilla12/cadence/cadence-api/internal/feed"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/pact"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
	"github.com/jackc/pgx/v5/pgxpool"
)

func feedServer(t *testing.T, pool *pgxpool.Pool, firebaseUID string) (*httptest.Server, *user.User) {
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
	}
	srv := httptest.NewServer(cadencehttp.NewRouter(deps))
	t.Cleanup(srv.Close)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{
		FirebaseUID: firebaseUID, Email: firebaseUID + "@x.com", DisplayName: firebaseUID,
	})
	return srv, &u
}

func TestFeed_HabitCompletionEmitsItemAndReactionTogglesIdempotently(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool,
		"reactions", "circle_feed_items", "pact_progress", "pacts",
		"circle_members", "circles", "habit_logs", "habits", "users",
	)
	srv, _ := feedServer(t, pool, "uid-feed-1")

	_, body := doReq(t, srv, http.MethodPost, "/v1/circles", map[string]any{"name": "FeedTest"})
	var circleResp struct {
		Circle struct {
			ID string `json:"id"`
		} `json:"circle"`
	}
	_ = json.Unmarshal(body, &circleResp)

	_, body = doReq(t, srv, http.MethodPost, "/v1/habits", map[string]any{
		"name":       "Morning run",
		"icon":       "run",
		"sharedWith": []string{circleResp.Circle.ID},
	})
	var habitResp struct {
		Habit struct {
			ID         string   `json:"id"`
			SharedWith []string `json:"sharedWith"`
		} `json:"habit"`
	}
	_ = json.Unmarshal(body, &habitResp)
	if len(habitResp.Habit.SharedWith) != 1 || habitResp.Habit.SharedWith[0] != circleResp.Circle.ID {
		t.Fatalf("sharedWith not echoed back: %+v", habitResp.Habit.SharedWith)
	}

	doReq(t, srv, http.MethodPost, "/v1/habits/"+habitResp.Habit.ID+"/toggle", nil)

	status, body := doReq(t, srv, http.MethodGet, "/v1/circles/"+circleResp.Circle.ID+"/feed", nil)
	if status != http.StatusOK {
		t.Fatalf("feed status %d body %s", status, body)
	}
	var listed struct {
		Items []struct {
			ID            string `json:"id"`
			Kind          string `json:"kind"`
			ReactionCount int    `json:"reactionCount"`
			ViewerReacted bool   `json:"viewerReacted"`
		} `json:"items"`
	}
	_ = json.Unmarshal(body, &listed)
	if len(listed.Items) != 1 || listed.Items[0].Kind != feed.KindHabitDone {
		t.Fatalf("expected one habit_done feed item, got %+v", listed.Items)
	}
	itemID := listed.Items[0].ID

	// Toggle reaction: 0 → 1
	status, body = doReq(t, srv, http.MethodPost, "/v1/feed/"+itemID+"/reactions/toggle", nil)
	if status != http.StatusOK {
		t.Fatalf("toggle status %d body %s", status, body)
	}
	var toggleResp struct {
		ReactionCount int  `json:"reactionCount"`
		ViewerReacted bool `json:"viewerReacted"`
	}
	_ = json.Unmarshal(body, &toggleResp)
	if toggleResp.ReactionCount != 1 || !toggleResp.ViewerReacted {
		t.Fatalf("first toggle: %+v", toggleResp)
	}

	// Toggle again: 1 → 0
	_, body = doReq(t, srv, http.MethodPost, "/v1/feed/"+itemID+"/reactions/toggle", nil)
	_ = json.Unmarshal(body, &toggleResp)
	if toggleResp.ReactionCount != 0 || toggleResp.ViewerReacted {
		t.Fatalf("second toggle: %+v", toggleResp)
	}
}

func TestFeed_NonMemberCannotReadFeed(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool,
		"reactions", "circle_feed_items", "pact_progress", "pacts",
		"circle_members", "circles", "habit_logs", "habits", "users",
	)
	srvOwner, _ := feedServer(t, pool, "uid-feed-owner")
	_, body := doReq(t, srvOwner, http.MethodPost, "/v1/circles", map[string]any{"name": "Locked"})
	var circleResp struct {
		Circle struct {
			ID string `json:"id"`
		} `json:"circle"`
	}
	_ = json.Unmarshal(body, &circleResp)

	srvStranger, _ := feedServer(t, pool, "uid-feed-stranger")
	status, _ := doReq(t, srvStranger, http.MethodGet, "/v1/circles/"+circleResp.Circle.ID+"/feed", nil)
	if status != http.StatusNotFound {
		t.Fatalf("expected 404 for non-member feed read, got %d", status)
	}
}
