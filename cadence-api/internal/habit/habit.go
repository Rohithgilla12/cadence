package habit

import (
	"time"

	"github.com/google/uuid"
)

type TimeOfDay string

const (
	TimeMorning TimeOfDay = "morning"
	TimeMidday  TimeOfDay = "midday"
	TimeEvening TimeOfDay = "evening"
	TimeAnytime TimeOfDay = "anytime"
)

// Target is the optional duration/intensity goal (e.g., 30 min, 5 km).
type Target struct {
	Value float64 `json:"value"`
	Unit  string  `json:"unit"`
}

// SourceLink describes how a habit can be auto-detected from a health
// integration. Per PRD §9 the rule shape is provider + kind + activity +
// optional min duration + optional time-of-day window.
//
//   - Provider:  "apple_health" | "health_connect" | "strava"
//   - Kind:      "workout" (HKWorkout / Strava activity) or "category" (sleep,
//                mindful sessions, etc.)
//   - Activity:  workout slug ("run", "walk", "cycling", "yoga", "hike",
//                "swim") OR a category identifier ("mindful", "sleep")
//   - MinMinutes: ignore samples shorter than this
//   - Window:    optional time-of-day filter, both strings in "HH:MM" 24h
//                local time
type SourceLink struct {
	Provider   string      `json:"provider"`
	Kind       string      `json:"kind"`
	Activity   string      `json:"activity"`
	MinMinutes int         `json:"minMinutes,omitempty"`
	Window     *TimeWindow `json:"window,omitempty"`
}

type TimeWindow struct {
	Start string `json:"start"` // "HH:MM" 24h local
	End   string `json:"end"`
}

type Habit struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	Name         string
	Icon         string
	TimeOfDay    TimeOfDay
	Target       *Target
	SourceLink   *SourceLink
	TrackContext bool
	SharedWith   []uuid.UUID
	CreatedAt    time.Time
	ArchivedAt   *time.Time
}

// View is the response shape for the Today screen — joined with today's log status
// and a pre-computed streak.
type View struct {
	Habit
	DoneToday    bool
	Streak       int
	AutoDetected bool
}
