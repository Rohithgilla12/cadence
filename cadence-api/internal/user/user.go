package user

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID          uuid.UUID
	FirebaseUID string
	Email       string
	DisplayName string
	Handle      string
	Intent      string
	Pillars     []string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
