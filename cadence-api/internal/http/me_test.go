//go:build integration

package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

type stubVerifier struct{ id auth.Identity }

func (s stubVerifier) Verify(_ context.Context, _ string) (auth.Identity, error) {
	return s.id, nil
}

func TestGetMe_ReturnsCurrentUser(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	repo := user.NewRepository(pool)

	router := cadencehttp.NewRouter(cadencehttp.Deps{
		Pool:     pool,
		Verifier: stubVerifier{id: auth.Identity{FirebaseUID: "uid-me", Email: "me@x.com", Name: "Test User"}},
		Resolver: auth.UserResolverFromRepository(repo),
	})

	server := httptest.NewServer(router)
	defer server.Close()

	req, _ := http.NewRequest(http.MethodGet, server.URL+"/v1/me", nil)
	req.Header.Set("Authorization", "Bearer anything")
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}

	var body struct {
		ID          string `json:"id"`
		Email       string `json:"email"`
		DisplayName string `json:"displayName"`
		FirebaseUID string `json:"firebaseUid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.FirebaseUID != "uid-me" {
		t.Fatalf("firebaseUid %q", body.FirebaseUID)
	}
	if body.Email != "me@x.com" {
		t.Fatalf("email %q", body.Email)
	}
}

func TestGetMe_RejectsMissingAuth(t *testing.T) {
	pool := db.TestPool(t)
	router := cadencehttp.NewRouter(cadencehttp.Deps{
		Pool:     pool,
		Verifier: stubVerifier{},
	})
	server := httptest.NewServer(router)
	defer server.Close()

	resp, err := server.Client().Get(server.URL + "/v1/me")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status %d want 401", resp.StatusCode)
	}
}

func TestPatchMe_UpdatesIntentAndPillars(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	userRepo := user.NewRepository(pool)

	router := cadencehttp.NewRouter(cadencehttp.Deps{
		Pool:     pool,
		Verifier: stubVerifier{id: auth.Identity{FirebaseUID: "uid-patch", Email: "p@x.com", Name: "P"}},
		Resolver: auth.UserResolverFromRepository(userRepo),
		Users:    userRepo,
	})
	server := httptest.NewServer(router)
	defer server.Close()

	body := []byte(`{"intent":"train_honestly","pillars":["movement","rest"]}`)
	req, _ := http.NewRequest(http.MethodPatch, server.URL+"/v1/me", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer anything")
	req.Header.Set("Content-Type", "application/json")
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}

	var got struct {
		Intent              string   `json:"intent"`
		Pillars             []string `json:"pillars"`
		OnboardingCompleted bool     `json:"onboardingCompleted"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.Intent != "train_honestly" {
		t.Fatalf("intent: %q", got.Intent)
	}
	if len(got.Pillars) != 2 || got.Pillars[0] != "movement" {
		t.Fatalf("pillars: %+v", got.Pillars)
	}
	if !got.OnboardingCompleted {
		t.Fatalf("expected onboardingCompleted=true after intent set")
	}
}

func TestGetMe_OnboardingCompletedFalseWhenIntentEmpty(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	userRepo := user.NewRepository(pool)

	router := cadencehttp.NewRouter(cadencehttp.Deps{
		Pool:     pool,
		Verifier: stubVerifier{id: auth.Identity{FirebaseUID: "uid-fresh", Email: "f@x.com", Name: "F"}},
		Resolver: auth.UserResolverFromRepository(userRepo),
		Users:    userRepo,
	})
	server := httptest.NewServer(router)
	defer server.Close()

	req, _ := http.NewRequest(http.MethodGet, server.URL+"/v1/me", nil)
	req.Header.Set("Authorization", "Bearer anything")
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()

	var got struct {
		OnboardingCompleted bool `json:"onboardingCompleted"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&got)
	if got.OnboardingCompleted {
		t.Fatalf("fresh user should have onboardingCompleted=false")
	}
}
