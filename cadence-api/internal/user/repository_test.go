//go:build integration

package user_test

import (
	"context"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func TestGetOrCreateByFirebaseUID_CreatesOnFirstCall(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	repo := user.NewRepository(pool)

	got, err := repo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{
		FirebaseUID: "uid-abc",
		Email:       "runner@example.com",
		DisplayName: "Runner One",
	})
	if err != nil {
		t.Fatalf("get-or-create: %v", err)
	}
	if got.FirebaseUID != "uid-abc" {
		t.Fatalf("uid: got %q", got.FirebaseUID)
	}
	if got.Email != "runner@example.com" {
		t.Fatalf("email: got %q", got.Email)
	}
	if got.ID.String() == "00000000-0000-0000-0000-000000000000" {
		t.Fatal("expected a generated UUID")
	}
}

func TestGetOrCreateByFirebaseUID_ReturnsExistingOnSecondCall(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	repo := user.NewRepository(pool)
	ctx := context.Background()

	first, err := repo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{
		FirebaseUID: "uid-xyz", Email: "a@b.com",
	})
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	second, err := repo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{
		FirebaseUID: "uid-xyz", Email: "a@b.com",
	})
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	if first.ID != second.ID {
		t.Fatalf("ids diverged: %s vs %s", first.ID, second.ID)
	}
}

func TestGetOrCreateByFirebaseUID_DoesNotOverwriteDisplayName(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	repo := user.NewRepository(pool)
	ctx := context.Background()

	if _, err := repo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{
		FirebaseUID: "uid-keep", DisplayName: "Original Name",
	}); err != nil {
		t.Fatalf("first: %v", err)
	}
	got, err := repo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{
		FirebaseUID: "uid-keep", DisplayName: "Different Later",
	})
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	if got.DisplayName != "Original Name" {
		t.Fatalf("display name overwritten: %q", got.DisplayName)
	}
}
