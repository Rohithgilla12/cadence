// Package feed owns Circle activity feed items + flower reactions
// (PRD §10). Items are server-emitted only — clients never POST raw items —
// and reactions are one type ("flower") to keep the surface anti-performance.
package feed

import (
	"time"

	"github.com/google/uuid"
)

const (
	KindHabitDone      = "habit_done"
	KindPactComplete   = "pact_complete"
	KindBackAfterQuiet = "back_after_quiet"
	ReactionKindFlower = "flower"
)

type Item struct {
	ID          uuid.UUID
	CircleID    uuid.UUID
	UserID      uuid.UUID
	DisplayName string
	Kind        string
	Payload     []byte // raw JSON; handler shapes it before sending
	Note        *string
	CreatedAt   time.Time
}

type ItemWithReactions struct {
	Item
	ReactionCount int
	ViewerReacted bool
}
