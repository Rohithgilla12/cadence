package circle

import (
	"time"

	"github.com/google/uuid"
)

// Role constants for circle_members.role. Creator gets it on insert via the
// creator path; everyone joining via invite is member. Future roles
// (moderator, etc.) layer on without a schema change.
const (
	RoleCreator = "creator"
	RoleMember  = "member"
)

type Circle struct {
	ID          uuid.UUID
	Name        string
	Description *string
	CreatorID   uuid.UUID
	InviteToken string
	CreatedAt   time.Time
	ArchivedAt  *time.Time
}

type Member struct {
	CircleID    uuid.UUID
	UserID      uuid.UUID
	DisplayName string
	JoinedAt    time.Time
	Role        string
}
