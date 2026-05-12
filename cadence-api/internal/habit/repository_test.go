//go:build integration

package habit_test

import (
	"context"
	"testing"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
	"github.com/jackc/pgx/v5/pgxpool"
)

func seedUser(t *testing.T, pool *pgxpool.Pool) user.User {
	t.Helper()
	repo := user.NewRepository(pool)
	u, err := repo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{
		FirebaseUID: "uid-habit-test",
		Email:       "h@x.com",
		DisplayName: "Habit Tester",
	})
	if err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return u
}

func TestCreateHabit_PersistsAndReturnsRecord(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)

	got, err := repo.Create(context.Background(), habit.CreateInput{
		UserID:    u.ID,
		Name:      "Morning run",
		Icon:      "run",
		TimeOfDay: habit.TimeMorning,
		Target:    &habit.Target{Value: 30, Unit: "min"},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if got.Name != "Morning run" || got.Icon != "run" || got.TimeOfDay != habit.TimeMorning {
		t.Fatalf("unexpected: %+v", got)
	}
	if got.Target == nil || got.Target.Value != 30 {
		t.Fatalf("target: %+v", got.Target)
	}
}

func TestListForUser_OmitsArchivedAndOtherUsers(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)
	ctx := context.Background()

	live, err := repo.Create(ctx, habit.CreateInput{UserID: u.ID, Name: "Live", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create live: %v", err)
	}
	archived, err := repo.Create(ctx, habit.CreateInput{UserID: u.ID, Name: "Old", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create archived: %v", err)
	}
	if err := repo.Archive(ctx, archived.ID); err != nil {
		t.Fatalf("archive: %v", err)
	}

	got, err := repo.ListForUser(ctx, u.ID)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("got %d habits, want 1", len(got))
	}
	if got[0].ID != live.ID {
		t.Fatalf("unexpected habit returned: %+v", got[0])
	}
}

func TestArchive_SetsArchivedAtAndExcludesFromList(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)
	ctx := context.Background()

	h, err := repo.Create(ctx, habit.CreateInput{UserID: u.ID, Name: "Doomed", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := repo.Archive(ctx, h.ID); err != nil {
		t.Fatalf("archive: %v", err)
	}
	list, _ := repo.ListForUser(ctx, u.ID)
	if len(list) != 0 {
		t.Fatalf("archived habit still listed: %+v", list)
	}
}

func TestGetByID_ScopedToOwner(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	userRepo := user.NewRepository(pool)
	ctx := context.Background()

	owner, err := userRepo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{FirebaseUID: "owner"})
	if err != nil {
		t.Fatalf("owner: %v", err)
	}
	stranger, err := userRepo.GetOrCreateByFirebaseUID(ctx, user.NewUserInput{FirebaseUID: "stranger"})
	if err != nil {
		t.Fatalf("stranger: %v", err)
	}
	repo := habit.NewRepository(pool)

	h, err := repo.Create(ctx, habit.CreateInput{UserID: owner.ID, Name: "Mine", Icon: "sparkles"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := repo.GetByID(ctx, h.ID, owner.ID); err != nil {
		t.Fatalf("owner can't read own habit: %v", err)
	}
	if _, err := repo.GetByID(ctx, h.ID, stranger.ID); err == nil {
		t.Fatalf("stranger should not access habit")
	}
}
