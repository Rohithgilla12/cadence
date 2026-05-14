package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/feed"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type feedItemDTO struct {
	ID            string         `json:"id"`
	CircleID      string         `json:"circleId"`
	UserID        string         `json:"userId"`
	DisplayName   string         `json:"displayName"`
	Kind          string         `json:"kind"`
	Payload       map[string]any `json:"payload,omitempty"`
	Note          *string        `json:"note,omitempty"`
	CreatedAt     string         `json:"createdAt"`
	ReactionCount int            `json:"reactionCount"`
	ViewerReacted bool           `json:"viewerReacted"`
}

func toFeedDTO(item feed.ItemWithReactions) feedItemDTO {
	dto := feedItemDTO{
		ID:            item.ID.String(),
		CircleID:      item.CircleID.String(),
		UserID:        item.UserID.String(),
		DisplayName:   item.DisplayName,
		Kind:          item.Kind,
		Note:          item.Note,
		CreatedAt:     item.CreatedAt.UTC().Format(time.RFC3339),
		ReactionCount: item.ReactionCount,
		ViewerReacted: item.ViewerReacted,
	}
	if len(item.Payload) > 0 {
		var parsed map[string]any
		if err := json.Unmarshal(item.Payload, &parsed); err == nil {
			dto.Payload = parsed
		}
	}
	return dto
}

type feedHandler struct {
	repo *feed.Repository
}

func newFeedHandler(repo *feed.Repository) *feedHandler {
	return &feedHandler{repo: repo}
}

func (h *feedHandler) listForCircle(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	circleID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad circle id")
		return
	}
	items, err := h.repo.ListForCircle(r.Context(), circleID, u.ID, 50)
	if errors.Is(err, feed.ErrForbidden) {
		writeError(w, http.StatusNotFound, "circle not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list feed")
		return
	}
	out := make([]feedItemDTO, 0, len(items))
	for _, it := range items {
		out = append(out, toFeedDTO(it))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out})
}

func (h *feedHandler) toggleReaction(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	itemID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad feed item id")
		return
	}
	count, viewerReacted, err := h.repo.ToggleReaction(r.Context(), itemID, u.ID)
	if errors.Is(err, feed.ErrNotFound) {
		writeError(w, http.StatusNotFound, "feed item not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "toggle reaction")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"reactionCount": count,
		"viewerReacted": viewerReacted,
	})
}
