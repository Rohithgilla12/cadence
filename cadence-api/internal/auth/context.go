package auth

import (
	"context"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

type identityKey struct{}
type userKey struct{}

func WithIdentity(ctx context.Context, id Identity) context.Context {
	return context.WithValue(ctx, identityKey{}, id)
}

func FromContext(ctx context.Context) (Identity, bool) {
	id, ok := ctx.Value(identityKey{}).(Identity)
	return id, ok
}

func WithUser(ctx context.Context, u user.User) context.Context {
	return context.WithValue(ctx, userKey{}, u)
}

func UserFromContext(ctx context.Context) (user.User, bool) {
	u, ok := ctx.Value(userKey{}).(user.User)
	return u, ok
}
