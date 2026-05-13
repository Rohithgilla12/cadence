package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/pact"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type pactDTO struct {
	ID                  string            `json:"id"`
	CircleID            string            `json:"circleId"`
	Text                string            `json:"text"`
	StartDate           string            `json:"startDate"`
	EndDate             string            `json:"endDate"`
	LinkedHabitTemplate map[string]any    `json:"linkedHabitTemplate,omitempty"`
	CreatedBy           string            `json:"createdBy"`
	CreatedAt           string            `json:"createdAt"`
	Progress            []pactProgressDTO `json:"progress"`
}

type pactProgressDTO struct {
	UserID      string  `json:"userId"`
	DisplayName string  `json:"displayName"`
	Completed   bool    `json:"completed"`
	CompletedAt *string `json:"completedAt,omitempty"`
}

func toPactDTO(p pact.Pact, progress []pact.Progress) pactDTO {
	out := pactDTO{
		ID:        p.ID.String(),
		CircleID:  p.CircleID.String(),
		Text:      p.Text,
		StartDate: p.StartDate.UTC().Format("2006-01-02"),
		EndDate:   p.EndDate.UTC().Format("2006-01-02"),
		CreatedBy: p.CreatedBy.String(),
		CreatedAt: p.CreatedAt.UTC().Format(time.RFC3339),
		Progress:  make([]pactProgressDTO, 0, len(progress)),
	}
	if p.LinkedHabitTemplate != nil && len(*p.LinkedHabitTemplate) > 0 {
		var parsed map[string]any
		if err := json.Unmarshal(*p.LinkedHabitTemplate, &parsed); err == nil {
			out.LinkedHabitTemplate = parsed
		}
	}
	for _, pp := range progress {
		row := pactProgressDTO{
			UserID:      pp.UserID.String(),
			DisplayName: pp.DisplayName,
			Completed:   pp.Completed,
		}
		if pp.CompletedAt != nil {
			s := pp.CompletedAt.UTC().Format(time.RFC3339)
			row.CompletedAt = &s
		}
		out.Progress = append(out.Progress, row)
	}
	return out
}

type pactsHandler struct {
	repo *pact.Repository
}

func newPactsHandler(repo *pact.Repository) *pactsHandler {
	return &pactsHandler{repo: repo}
}

type createPactRequest struct {
	Text                string         `json:"text"`
	StartDate           string         `json:"startDate"` // YYYY-MM-DD
	EndDate             string         `json:"endDate"`   // YYYY-MM-DD
	LinkedHabitTemplate map[string]any `json:"linkedHabitTemplate,omitempty"`
}

func (h *pactsHandler) create(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	circleID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad circle id")
		return
	}
	var req createPactRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}
	if len(req.Text) > 200 {
		writeError(w, http.StatusBadRequest, "text is too long")
		return
	}
	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad startDate — expect YYYY-MM-DD")
		return
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad endDate — expect YYYY-MM-DD")
		return
	}
	if !endDate.After(startDate) {
		writeError(w, http.StatusBadRequest, "endDate must be after startDate")
		return
	}

	var linkedRaw []byte
	if len(req.LinkedHabitTemplate) > 0 {
		linkedRaw, err = json.Marshal(req.LinkedHabitTemplate)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad linkedHabitTemplate")
			return
		}
	}

	created, err := h.repo.Create(r.Context(), pact.CreateInput{
		CircleID:            circleID,
		CreatorID:           u.ID,
		Text:                req.Text,
		StartDate:           startDate,
		EndDate:             endDate,
		LinkedHabitTemplate: linkedRaw,
	})
	if errors.Is(err, pact.ErrForbidden) {
		// 404 not 403 — non-members shouldn't even confirm the circle exists.
		writeError(w, http.StatusNotFound, "circle not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create pact")
		return
	}

	// Pull the WithProgress row so the response includes the freshly-seeded
	// progress dots — no second round-trip from the client.
	all, err := h.repo.ListForCircleWithProgress(r.Context(), circleID, u.ID, 1)
	if err != nil || len(all) == 0 {
		writeJSON(w, http.StatusCreated, map[string]any{"pact": toPactDTO(created, nil)})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"pact": toPactDTO(all[0].Pact, all[0].Progress),
	})
}

func (h *pactsHandler) listForCircle(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	circleID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad circle id")
		return
	}
	pacts, err := h.repo.ListForCircleWithProgress(r.Context(), circleID, u.ID, 10)
	if errors.Is(err, pact.ErrForbidden) {
		writeError(w, http.StatusNotFound, "circle not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list pacts")
		return
	}
	out := make([]pactDTO, 0, len(pacts))
	for _, p := range pacts {
		out = append(out, toPactDTO(p.Pact, p.Progress))
	}
	writeJSON(w, http.StatusOK, map[string]any{"pacts": out})
}

func (h *pactsHandler) complete(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	pactID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad pact id")
		return
	}
	// Authorize: caller must be in the pact's circle.
	if _, err := h.repo.ResolvePactForMember(r.Context(), pactID, u.ID); err != nil {
		if errors.Is(err, pact.ErrNotFound) {
			writeError(w, http.StatusNotFound, "pact not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "resolve pact")
		return
	}
	if err := h.repo.CompleteForUser(r.Context(), pactID, u.ID); err != nil {
		if errors.Is(err, pact.ErrNotFound) {
			writeError(w, http.StatusNotFound, "pact not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "complete pact")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
