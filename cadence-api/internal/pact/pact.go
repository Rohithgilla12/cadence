// Package pact owns Circle Pacts — shared weekly commitments. Per PRD §10
// pacts are collective, not competitive: a member marking complete adds to
// the circle's tally without ranking individuals. The package exposes the
// CRUD primitives plus a "with progress" view that joins per-member status.
package pact

import (
	"time"

	"github.com/google/uuid"
)

// Pact is one row from the pacts table.
type Pact struct {
	ID                  uuid.UUID
	CircleID            uuid.UUID
	Text                string
	StartDate           time.Time
	EndDate             time.Time
	LinkedHabitTemplate *[]byte // raw JSON; left opaque since handler shapes vary
	CreatedBy           uuid.UUID
	CreatedAt           time.Time
}

// Progress is a per-(pact, user) row joined with the user's display name so
// the circle detail can render dots/names without a second lookup.
type Progress struct {
	UserID      uuid.UUID
	DisplayName string
	Completed   bool
	CompletedAt *time.Time
}

// WithProgress bundles a pact with the member-by-member progress view. The
// handler emits this directly to the client; mobile renders one card per
// pact in the response.
type WithProgress struct {
	Pact     Pact
	Progress []Progress
}
