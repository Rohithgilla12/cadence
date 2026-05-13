package insight

import (
	"time"

	"github.com/google/uuid"
)

// Insight is the engine's output row — one persisted per (user, habit,
// pattern) per worker run, upserted on the unique constraint added in
// migration 0004.
type Insight struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	HabitID        *uuid.UUID // nil for cross-habit insights
	PatternType    string
	EffectSize     float64
	PValue         float64
	SampleSize     int
	TemplateID     string
	TemplateParams map[string]any
	RenderedText   string
	ComputedAt     time.Time
	ShownAt        *time.Time
}

// Strength derives the "small/mild" vs "strong" copy bucket from a Cramér's V
// or |ρ| value, per PRD §8 thresholds (0.20 and 0.35).
type Strength int

const (
	StrengthBelowThreshold Strength = iota
	StrengthMild
	StrengthStrong
)

func StrengthFor(effect float64) Strength {
	switch {
	case effect < MinEffectSizeMin:
		return StrengthBelowThreshold
	case effect < MinEffectSizeMax:
		return StrengthMild
	default:
		return StrengthStrong
	}
}
