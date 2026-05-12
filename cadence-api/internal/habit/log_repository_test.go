//go:build integration

package habit_test

import (
	"context"
	"testing"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func TestUpsertLog_CreatesAndIsIdempotent(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "habits", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "log-user"})
	hRepo := habit.NewRepository(pool)
	h, _ := hRepo.Create(context.Background(), habit.CreateInput{UserID: u.ID, Name: "Run", Icon: "run"})
	logRepo := habit.NewLogRepository(pool)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)

	if _, err := logRepo.Upsert(context.Background(), habit.UpsertLogInput{HabitID: h.ID, Date: day, Completed: true, Source: habit.SourceManual}); err != nil {
		t.Fatalf("first upsert: %v", err)
	}
	if _, err := logRepo.Upsert(context.Background(), habit.UpsertLogInput{HabitID: h.ID, Date: day, Completed: true, Source: habit.SourceManual}); err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	var count int
	if err := pool.QueryRow(context.Background(), `SELECT count(*) FROM habit_logs WHERE habit_id=$1`, h.ID).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("got %d rows, want 1", count)
	}
}

func TestDeleteLog_RemovesEntry(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "habits", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "del-user"})
	hRepo := habit.NewRepository(pool)
	h, _ := hRepo.Create(context.Background(), habit.CreateInput{UserID: u.ID, Name: "Run", Icon: "run"})
	logRepo := habit.NewLogRepository(pool)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)
	_, _ = logRepo.Upsert(context.Background(), habit.UpsertLogInput{HabitID: h.ID, Date: day, Completed: true})

	if err := logRepo.Delete(context.Background(), h.ID, day); err != nil {
		t.Fatalf("delete: %v", err)
	}
	var count int
	pool.QueryRow(context.Background(), `SELECT count(*) FROM habit_logs WHERE habit_id=$1`, h.ID).Scan(&count)
	if count != 0 {
		t.Fatalf("got %d rows, want 0", count)
	}
}

func TestRecentCompletedDates_OrderedDesc(t *testing.T) {
	pool := db.TestPool(t)
	db.Truncate(t, pool, "habit_logs", "habits", "users")
	userRepo := user.NewRepository(pool)
	u, _ := userRepo.GetOrCreateByFirebaseUID(context.Background(), user.NewUserInput{FirebaseUID: "rec-user"})
	hRepo := habit.NewRepository(pool)
	h, _ := hRepo.Create(context.Background(), habit.CreateInput{UserID: u.ID, Name: "Run", Icon: "run"})
	logRepo := habit.NewLogRepository(pool)
	for _, day := range []string{"2026-05-11", "2026-05-12", "2026-05-13"} {
		t0, _ := time.Parse("2006-01-02", day)
		_, _ = logRepo.Upsert(context.Background(), habit.UpsertLogInput{HabitID: h.ID, Date: t0, Completed: true})
	}
	got, err := logRepo.RecentCompletedDates(context.Background(), h.ID, time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC), 30)
	if err != nil {
		t.Fatalf("recent: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("got %d dates, want 3", len(got))
	}
	if !got[0].Equal(time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("first date: %v", got[0])
	}
}
