package checkin

import (
	"time"

	"github.com/google/uuid"
)

type CheckIn struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Date       time.Time
	Mood       *int16
	SleepHours *float64
	Note       *string
	CreatedAt  time.Time
}
