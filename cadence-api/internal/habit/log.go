package habit

import (
	"time"

	"github.com/google/uuid"
)

type LogSource string

const (
	SourceManual        LogSource = "manual"
	SourceAppleHealth   LogSource = "apple_health"
	SourceHealthConnect LogSource = "health_connect"
	SourceStrava        LogSource = "strava"
)

type Log struct {
	ID         uuid.UUID
	HabitID    uuid.UUID
	Date       time.Time
	Completed  bool
	Value      *float64
	Source     LogSource
	LoggedAt   time.Time
	SkipReason *string
}
