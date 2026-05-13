// Package dailysum stores per-user, per-day health summaries computed
// on-device. Per PRD §9 / §15, raw health samples never leave the user's
// phone — only the daily rollup is uploaded here, which is what the
// correlation engine reads to find sleep/HRV/activity ↔ habit patterns.
package dailysum

import (
	"time"

	"github.com/google/uuid"
)

// DailySummary mirrors the mobile DailySummary type. All measurement fields
// are nullable: the client uploads whatever it has, and missing readings
// stay NULL so the correlation worker can distinguish "no data" from "zero."
type DailySummary struct {
	UserID           uuid.UUID
	Date             time.Time
	SleepHours       *float64
	SleepDeepMinutes *int
	SleepRemMinutes  *int
	SleepCoreMinutes *int
	Steps            *int
	DistanceMeters   *int
	ActiveEnergyKcal *int
	RestingHeartRate *int
	HrvMs            *int
	Source           string
	UpdatedAt        time.Time
}
