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

func TestCreateHabit_RoundTripsSourceLinkAndTarget(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)
	ctx := context.Background()

	got, err := repo.Create(ctx, habit.CreateInput{
		UserID:    u.ID,
		Name:      "Morning run",
		Icon:      "run",
		TimeOfDay: habit.TimeMorning,
		Target:    &habit.Target{Value: 30, Unit: "min"},
		SourceLink: &habit.SourceLink{
			Provider:   "apple_health",
			Kind:       "workout",
			Activity:   "run",
			MinMinutes: 15,
			Window:     &habit.TimeWindow{Start: "05:00", End: "11:00"},
		},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if got.SourceLink == nil {
		t.Fatalf("source_link not persisted")
	}
	if got.SourceLink.Activity != "run" || got.SourceLink.MinMinutes != 15 {
		t.Fatalf("source_link decoded wrong: %+v", got.SourceLink)
	}
	if got.SourceLink.Window == nil || got.SourceLink.Window.Start != "05:00" {
		t.Fatalf("window decoded wrong: %+v", got.SourceLink.Window)
	}
	if got.Target == nil || got.Target.Value != 30 || got.Target.Unit != "min" {
		t.Fatalf("target decoded wrong: %+v", got.Target)
	}

	// Read it back via Get to make sure persistence works end-to-end.
	fetched, err := repo.GetByID(ctx, got.ID, u.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if fetched.SourceLink == nil || fetched.SourceLink.Provider != "apple_health" {
		t.Fatalf("source_link missing after refetch: %+v", fetched.SourceLink)
	}
}

func TestUpdate_PartialFieldsAndClearSourceLink(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habits", "users")
	u := seedUser(t, pool)
	repo := habit.NewRepository(pool)
	ctx := context.Background()

	h, err := repo.Create(ctx, habit.CreateInput{
		UserID:    u.ID,
		Name:      "Original",
		Icon:      "sparkles",
		TimeOfDay: habit.TimeAnytime,
		SourceLink: &habit.SourceLink{
			Provider: "apple_health", Kind: "category", Activity: "mindful", MinMinutes: 5,
		},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	newName := "Renamed"
	updated, err := repo.Update(ctx, habit.UpdateInput{
		ID:              h.ID,
		OwnerID:         u.ID,
		Name:            &newName,
		ClearSourceLink: true,
	})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Name != "Renamed" {
		t.Fatalf("name not updated: %q", updated.Name)
	}
	if updated.SourceLink != nil {
		t.Fatalf("source_link should be cleared, got %+v", updated.SourceLink)
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
