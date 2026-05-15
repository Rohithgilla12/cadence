package habit

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// StravaActivity is the minimal subset of Strava activity fields the
// auto-detect engine needs. Defined here (rather than imported from
// internal/strava) to avoid an import cycle — internal/strava
// already imports internal/habit indirectly via the wiring in
// cmd/api. Keep this struct in sync with strava.DetailedActivity.
type StravaActivity struct {
	Type           string    // lowercased: "run", "walk", "ride", ...
	StartedAt      time.Time // UTC
	ElapsedSeconds int
}

// StravaAutodetector matches incoming Strava activities against the
// user's habits and pre-checks any matching ones. Mirrors the rules
// the toggle handler enforces for manual + Apple-Health detection:
//
//   - Time window of the activity must be within the habit's
//     sourceLink.Window if set. UTC-only comparison — we don't have
//     per-user timezone server-side yet, so the window matches the
//     wall-clock hours of the activity's UTC start. For users on
//     UTC-adjacent timezones this works; for UTC±many the window may
//     mismatch. v1 trade-off; can wire user_tz later.
//   - Activity duration must clear MinMinutes if set.
//   - Activity type must match sourceLink.Activity (already
//     normalised lowercase on the strava side).
//   - PRD §9: never auto-uncheck a manually-logged habit. If the
//     date already has a log for the habit from source=manual, skip.
type StravaAutodetector struct {
	habits *Repository
	logs   *LogRepository
}

func NewStravaAutodetector(habits *Repository, logs *LogRepository) *StravaAutodetector {
	return &StravaAutodetector{habits: habits, logs: logs}
}

// Detect walks the user's active habits and upserts a habit_log row
// (source=strava, completed=true) for every habit whose source-link
// matches the activity. Returns the count of newly-detected logs so
// the caller can log a metric. Errors on the first DB failure but
// the per-habit matching is independent — a failure on one habit
// doesn't block the rest if the upsert error is per-row.
func (d *StravaAutodetector) Detect(ctx context.Context, userID uuid.UUID, activity StravaActivity) (int, error) {
	habits, err := d.habits.ListForUser(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("list habits: %w", err)
	}

	// Use the activity's UTC date as the "log date" — log keys are
	// dates not times, so we take the calendar day the activity
	// started on. For users in non-UTC timezones this can land on
	// the wrong day for late-night activities. Same trade-off as
	// Apple Health daily summaries.
	logDate := startOfDayUTC(activity.StartedAt)
	matched := 0

	for _, h := range habits {
		if h.SourceLink == nil {
			continue
		}
		if h.SourceLink.Provider != "strava" {
			continue
		}
		if !matchesActivity(h.SourceLink, activity) {
			continue
		}

		// PRD §9 anti-uncheck. Look up existing log; if manual, skip.
		sourceByDate, err := d.logs.SourceByDate(ctx, []uuid.UUID{h.ID}, logDate)
		if err != nil {
			return matched, fmt.Errorf("source by date: %w", err)
		}
		if existing := sourceByDate[h.ID]; existing == SourceManual {
			continue
		}

		if _, err := d.logs.Upsert(ctx, UpsertLogInput{
			HabitID:   h.ID,
			Date:      logDate,
			Completed: true,
			Source:    SourceStrava,
		}); err != nil {
			return matched, fmt.Errorf("upsert log for %s: %w", h.ID, err)
		}
		matched++
	}
	return matched, nil
}

// matchesActivity is the per-habit predicate. Split out so it can be
// unit-tested without a DB.
func matchesActivity(link *SourceLink, activity StravaActivity) bool {
	if link.Activity != activity.Type {
		return false
	}
	if link.MinMinutes > 0 {
		minSeconds := link.MinMinutes * 60
		if activity.ElapsedSeconds < minSeconds {
			return false
		}
	}
	if link.Window != nil {
		// Compare wall-clock hours of the activity's UTC start
		// against the HH:MM window. See note above on timezone
		// limitations.
		start, ok := parseHM(link.Window.Start)
		if !ok {
			return false
		}
		end, ok := parseHM(link.Window.End)
		if !ok {
			return false
		}
		// Activity time in minutes-since-midnight UTC.
		at := activity.StartedAt.UTC()
		mins := at.Hour()*60 + at.Minute()
		// Windows that wrap midnight (start > end, e.g. 22:00–06:00)
		// are valid for sleep-adjacent habits. Treat them as union.
		if start <= end {
			if mins < start || mins > end {
				return false
			}
		} else {
			if mins < start && mins > end {
				return false
			}
		}
	}
	return true
}

// parseHM parses an "HH:MM" 24h string into minutes-since-midnight.
// Returns false on malformed input — callers treat that as a window
// mismatch rather than a panic.
func parseHM(s string) (int, bool) {
	if len(s) != 5 || s[2] != ':' {
		return 0, false
	}
	hh := int(s[0]-'0')*10 + int(s[1]-'0')
	mm := int(s[3]-'0')*10 + int(s[4]-'0')
	if hh < 0 || hh > 23 || mm < 0 || mm > 59 {
		return 0, false
	}
	return hh*60 + mm, true
}

func startOfDayUTC(t time.Time) time.Time {
	y, m, d := t.UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}
