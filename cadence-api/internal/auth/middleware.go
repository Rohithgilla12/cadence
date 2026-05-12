package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

// UserResolver maps a verified Identity to a DB user row, creating
// one if necessary. Pass nil to skip resolution.
type UserResolver func(ctx context.Context, id Identity) (user.User, error)

func UserResolverFromRepository(repo *user.Repository) UserResolver {
	return func(ctx context.Context, id Identity) (user.User, error) {
		return repo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{
			FirebaseUID: id.FirebaseUID,
			Email:       id.Email,
			DisplayName: id.Name,
		})
	}
}

func RequireAuth(verifier Verifier, resolver UserResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := bearerToken(r.Header.Get("Authorization"))
			if token == "" {
				http.Error(w, "missing or malformed Authorization header", http.StatusUnauthorized)
				return
			}
			identity, err := verifier.Verify(r.Context(), token)
			if err != nil {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}
			ctx := WithIdentity(r.Context(), identity)
			if resolver != nil {
				u, err := resolver(ctx, identity)
				if err != nil {
					http.Error(w, "user resolution failed", http.StatusInternalServerError)
					return
				}
				ctx = WithUser(ctx, u)
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func bearerToken(header string) string {
	if header == "" {
		return ""
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(header[len(prefix):])
}
