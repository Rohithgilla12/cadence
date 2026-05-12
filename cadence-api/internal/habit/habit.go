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

type Habit struct {
	ID           uuid.UUID
	UserID       uuid.UUID
	Name         string
	Icon         string
	TimeOfDay    TimeOfDay
	Target       *Target
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
