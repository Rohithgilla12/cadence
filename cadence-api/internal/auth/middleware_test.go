//go:build integration

package auth_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

type stubVerifier struct {
	identity auth.Identity
	err      error
}

func (s stubVerifier) Verify(ctx context.Context, token string) (auth.Identity, error) {
	return s.identity, s.err
}

func TestRequireAuth_RejectsMissingHeader(t *testing.T) {
	h := auth.RequireAuth(stubVerifier{}, nil)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("inner handler must not run")
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("got %d want 401", rec.Code)
	}
}

func TestRequireAuth_RejectsMalformedHeader(t *testing.T) {
	h := auth.RequireAuth(stubVerifier{}, nil)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("inner handler must not run")
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Token abc")
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("got %d want 401", rec.Code)
	}
}

func TestRequireAuth_RejectsInvalidToken(t *testing.T) {
	h := auth.RequireAuth(stubVerifier{err: errors.New("bad")}, nil)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("inner handler must not run")
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer something")
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("got %d want 401", rec.Code)
	}
}

func TestRequireAuth_PassesIdentityToHandler(t *testing.T) {
	want := auth.Identity{FirebaseUID: "uid-123", Email: "u@x.com"}
	h := auth.RequireAuth(stubVerifier{identity: want}, nil)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, ok := auth.FromContext(r.Context())
		if !ok {
			t.Fatal("identity not in context")
		}
		if got != want {
			t.Fatalf("got %+v want %+v", got, want)
		}
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer something")
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d want 200", rec.Code)
	}
}

func TestRequireAuth_ResolvesUserViaResolver(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	repo := user.NewRepository(pool)

	verifier := stubVerifier{identity: auth.Identity{FirebaseUID: "uid-resolve", Email: "r@x.com"}}
	mw := auth.RequireAuth(verifier, auth.UserResolverFromRepository(repo))

	h := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := auth.UserFromContext(r.Context())
		if !ok || u.FirebaseUID != "uid-resolve" {
			t.Fatalf("user not in context: %+v ok=%v", u, ok)
		}
		w.WriteHeader(http.StatusOK)
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer something")
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d want 200", rec.Code)
	}
}
