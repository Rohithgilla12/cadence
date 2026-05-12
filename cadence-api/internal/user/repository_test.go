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

func TestUpdateProfile_PartialFieldsPreserveOthers(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "users")
	repo := user.NewRepository(pool)
	ctx := context.Background()

	created, err := repo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{
		FirebaseUID: "uid-upd",
		Email:       "u@x.com",
		DisplayName: "Original",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	intent := "train_honestly"
	pillars := []string{"movement", "rest"}
	updated, err := repo.UpdateProfile(ctx, created.ID, user.UpdateProfileInput{
		Intent:  &intent,
		Pillars: &pillars,
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Intent != "train_honestly" {
		t.Fatalf("intent: %q", updated.Intent)
	}
	if len(updated.Pillars) != 2 || updated.Pillars[0] != "movement" {
		t.Fatalf("pillars: %+v", updated.Pillars)
	}
	if updated.DisplayName != "Original" {
		t.Fatalf("display name overwritten: %q", updated.DisplayName)
	}

	// Second update - only displayName.
	newName := "Renamed"
	updated2, err := repo.UpdateProfile(ctx, created.ID, user.UpdateProfileInput{
		DisplayName: &newName,
	})
	if err != nil {
		t.Fatalf("update2: %v", err)
	}
	if updated2.DisplayName != "Renamed" {
		t.Fatalf("display name: %q", updated2.DisplayName)
	}
	if updated2.Intent != "train_honestly" {
		t.Fatalf("intent cleared: %q", updated2.Intent)
	}
	if len(updated2.Pillars) != 2 {
		t.Fatalf("pillars cleared: %+v", updated2.Pillars)
	}
}
