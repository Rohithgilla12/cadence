package auth

import (
	"context"
	"errors"
	"fmt"

	firebase "firebase.google.com/go/v4"
	firebaseauth "firebase.google.com/go/v4/auth"
	"google.golang.org/api/option"
)

// Identity is the trusted claims extracted from a verified ID token.
type Identity struct {
	FirebaseUID string
	Email       string
	Name        string
}

// Verifier verifies an ID token and returns the trusted Identity.
// Tests substitute a stub implementation.
type Verifier interface {
	Verify(ctx context.Context, idToken string) (Identity, error)
}

var ErrInvalidToken = errors.New("invalid id token")

type firebaseVerifier struct {
	client *firebaseauth.Client
}

func NewFirebaseVerifier(ctx context.Context, credentialsPath string) (Verifier, error) {
	app, err := firebase.NewApp(ctx, nil, option.WithCredentialsFile(credentialsPath))
	if err != nil {
		return nil, fmt.Errorf("firebase app: %w", err)
	}
	client, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("firebase auth client: %w", err)
	}
	return &firebaseVerifier{client: client}, nil
}

func (v *firebaseVerifier) Verify(ctx context.Context, idToken string) (Identity, error) {
	tok, err := v.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		return Identity{}, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}
	email, _ := tok.Claims["email"].(string)
	name, _ := tok.Claims["name"].(string)
	return Identity{FirebaseUID: tok.UID, Email: email, Name: name}, nil
}
