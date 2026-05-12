//go:build integration

package checkin_test

import (
	"context"
	"testing"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func TestUpsert_CreatesThenUpdates(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "check_ins", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "ci"})
	repo := checkin.NewRepository(pool)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)

	mood := int16(4)
	sleep := 7.5
	first, err := repo.Upsert(context.Background(), checkin.UpsertInput{UserID: u.ID, Date: day, Mood: &mood, SleepHours: &sleep})
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	if first.Mood == nil || *first.Mood != 4 {
		t.Fatalf("mood: %+v", first.Mood)
	}

	mood2 := int16(5)
	second, err := repo.Upsert(context.Background(), checkin.UpsertInput{UserID: u.ID, Date: day, Mood: &mood2})
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	if second.ID != first.ID {
		t.Fatalf("upsert created a second row: %s vs %s", first.ID, second.ID)
	}
	if second.Mood == nil || *second.Mood != 5 {
		t.Fatalf("mood after update: %+v", second.Mood)
	}
}

func TestGet_ReturnsNilWhenAbsent(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "check_ins", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "ci-empty"})
	repo := checkin.NewRepository(pool)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)

	got, err := repo.Get(context.Background(), u.ID, day)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for absent check-in, got %+v", got)
	}
}
