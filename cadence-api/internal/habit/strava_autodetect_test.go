package habit

import (
	"testing"
	"time"
)

func TestMatchesActivity_TypeMustMatch(t *testing.T) {
	run := StravaActivity{Type: "run", StartedAt: time.Now().UTC(), ElapsedSeconds: 1800}
	if matchesActivity(&SourceLink{Activity: "run", Provider: "strava"}, run) != true {
		t.Fatal("run should match run link")
	}
	if matchesActivity(&SourceLink{Activity: "ride", Provider: "strava"}, run) != false {
		t.Fatal("run should not match ride link")
	}
}

func TestMatchesActivity_MinMinutes(t *testing.T) {
	short := StravaActivity{Type: "run", StartedAt: time.Now().UTC(), ElapsedSeconds: 60 * 5}
	link := &SourceLink{Activity: "run", Provider: "strava", MinMinutes: 10}
	if matchesActivity(link, short) {
		t.Fatal("5-min run should fail MinMinutes=10")
	}

	long := StravaActivity{Type: "run", StartedAt: time.Now().UTC(), ElapsedSeconds: 60 * 30}
	if !matchesActivity(link, long) {
		t.Fatal("30-min run should pass MinMinutes=10")
	}
}

func TestMatchesActivity_WindowSameDay(t *testing.T) {
	// 5am–11am window. Activity at 7am UTC matches.
	link := &SourceLink{
		Activity: "run", Provider: "strava",
		Window: &TimeWindow{Start: "05:00", End: "11:00"},
	}
	morning := StravaActivity{
		Type:           "run",
		StartedAt:      time.Date(2026, 5, 15, 7, 0, 0, 0, time.UTC),
		ElapsedSeconds: 1800,
	}
	if !matchesActivity(link, morning) {
		t.Fatal("7am UTC should fall in 05:00–11:00 window")
	}

	evening := StravaActivity{
		Type:           "run",
		StartedAt:      time.Date(2026, 5, 15, 18, 0, 0, 0, time.UTC),
		ElapsedSeconds: 1800,
	}
	if matchesActivity(link, evening) {
		t.Fatal("6pm UTC should not fall in 05:00–11:00 window")
	}
}

func TestMatchesActivity_WindowWrapsMidnight(t *testing.T) {
	// Sleep-adjacent: 22:00–06:00 wraps midnight. Activities at 23:00
	// and 02:00 should both match; 12:00 should not.
	link := &SourceLink{
		Activity: "walk", Provider: "strava",
		Window: &TimeWindow{Start: "22:00", End: "06:00"},
	}
	for _, hh := range []int{23, 2} {
		act := StravaActivity{
			Type:           "walk",
			StartedAt:      time.Date(2026, 5, 15, hh, 0, 0, 0, time.UTC),
			ElapsedSeconds: 600,
		}
		if !matchesActivity(link, act) {
			t.Errorf("%d:00 UTC should fall in 22:00–06:00 wrap window", hh)
		}
	}
	noon := StravaActivity{
		Type:           "walk",
		StartedAt:      time.Date(2026, 5, 15, 12, 0, 0, 0, time.UTC),
		ElapsedSeconds: 600,
	}
	if matchesActivity(link, noon) {
		t.Fatal("12:00 UTC should not fall in 22:00–06:00 wrap window")
	}
}

func TestParseHM(t *testing.T) {
	cases := []struct {
		in     string
		want   int
		wantOK bool
	}{
		{"00:00", 0, true},
		{"05:30", 5*60 + 30, true},
		{"23:59", 23*60 + 59, true},
		{"", 0, false},
		{"5:00", 0, false},  // missing leading zero
		{"24:00", 0, false}, // hour out of range
		{"12:60", 0, false}, // minute out of range
		{"abcde", 0, false},
	}
	for _, c := range cases {
		got, ok := parseHM(c.in)
		if got != c.want || ok != c.wantOK {
			t.Errorf("parseHM(%q) = (%d, %v); want (%d, %v)", c.in, got, ok, c.want, c.wantOK)
		}
	}
}
