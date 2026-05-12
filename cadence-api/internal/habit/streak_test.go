package habit_test

import (
	"testing"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
)

func d(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestComputeStreak_Empty(t *testing.T) {
	got := habit.ComputeStreak(nil, d("2026-05-13"))
	if got != 0 {
		t.Fatalf("got %d want 0", got)
	}
}

func TestComputeStreak_LatestOlderThanYesterday(t *testing.T) {
	dates := []time.Time{d("2026-05-09"), d("2026-05-08")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 0 {
		t.Fatalf("got %d want 0 (broken — latest log was 4 days ago)", got)
	}
}

func TestComputeStreak_OnlyToday(t *testing.T) {
	dates := []time.Time{d("2026-05-13")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 1 {
		t.Fatalf("got %d want 1", got)
	}
}

func TestComputeStreak_TodayPlusYesterday(t *testing.T) {
	dates := []time.Time{d("2026-05-13"), d("2026-05-12")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 2 {
		t.Fatalf("got %d want 2", got)
	}
}

func TestComputeStreak_YesterdayOnly_TodayMissed(t *testing.T) {
	// Per PRD §3: streak survives today-not-yet-done; doesn't break until tomorrow.
	dates := []time.Time{d("2026-05-12"), d("2026-05-11"), d("2026-05-10")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 3 {
		t.Fatalf("got %d want 3", got)
	}
}

func TestComputeStreak_BreaksOnGap(t *testing.T) {
	// 13, 12, [11 missing], 10, 9 — streak counts only 13,12 = 2
	dates := []time.Time{d("2026-05-13"), d("2026-05-12"), d("2026-05-10"), d("2026-05-09")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 2 {
		t.Fatalf("got %d want 2", got)
	}
}

func TestComputeStreak_HandlesUnsortedInput(t *testing.T) {
	dates := []time.Time{d("2026-05-11"), d("2026-05-13"), d("2026-05-12")}
	got := habit.ComputeStreak(dates, d("2026-05-13"))
	if got != 3 {
		t.Fatalf("got %d want 3", got)
	}
}
