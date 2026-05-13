package http

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/circle"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type circleDTO struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	CreatorID   string  `json:"creatorId"`
	InviteToken string  `json:"inviteToken"`
	CreatedAt   string  `json:"createdAt"`
}

type memberDTO struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
	JoinedAt    string `json:"joinedAt"`
	Role        string `json:"role"`
}

func toCircleDTO(c circle.Circle) circleDTO {
	return circleDTO{
		ID:          c.ID.String(),
		Name:        c.Name,
		Description: c.Description,
		CreatorID:   c.CreatorID.String(),
		InviteToken: c.InviteToken,
		CreatedAt:   c.CreatedAt.UTC().Format(time.RFC3339),
	}
}

type circlesHandler struct {
	repo *circle.Repository
}

func newCirclesHandler(repo *circle.Repository) *circlesHandler {
	return &circlesHandler{repo: repo}
}

func (h *circlesHandler) list(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	circles, err := h.repo.ListForUser(r.Context(), u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list circles")
		return
	}
	out := make([]circleDTO, 0, len(circles))
	for _, c := range circles {
		out = append(out, toCircleDTO(c))
	}
	writeJSON(w, http.StatusOK, map[string]any{"circles": out})
}

type createCircleRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
}

func (h *circlesHandler) create(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req createCircleRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if len(req.Name) > 80 {
		writeError(w, http.StatusBadRequest, "name is too long")
		return
	}
	c, err := h.repo.Create(r.Context(), circle.CreateInput{
		CreatorID:   u.ID,
		Name:        req.Name,
		Description: req.Description,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create circle")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"circle": toCircleDTO(c)})
}

func (h *circlesHandler) get(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	c, err := h.repo.GetByID(r.Context(), id, u.ID)
	if errors.Is(err, circle.ErrNotFound) {
		writeError(w, http.StatusNotFound, "circle not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "get circle")
		return
	}
	members, err := h.repo.ListMembers(r.Context(), id, u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list members")
		return
	}
	out := make([]memberDTO, 0, len(members))
	for _, m := range members {
		out = append(out, memberDTO{
			UserID:      m.UserID.String(),
			DisplayName: m.DisplayName,
			JoinedAt:    m.JoinedAt.UTC().Format(time.RFC3339),
			Role:        m.Role,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"circle":  toCircleDTO(c),
		"members": out,
	})
}

func (h *circlesHandler) join(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	token := strings.TrimSpace(chi.URLParam(r, "token"))
	if token == "" {
		writeError(w, http.StatusBadRequest, "invite token required")
		return
	}
	c, err := h.repo.JoinByToken(r.Context(), token, u.ID)
	if errors.Is(err, circle.ErrNotFound) {
		writeError(w, http.StatusNotFound, "invite not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "join circle")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"circle": toCircleDTO(c)})
}
