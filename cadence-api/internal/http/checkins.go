package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/go-chi/chi/v5"
)

type checkInDTO struct {
	Date       string   `json:"date"`
	Mood       *int16   `json:"mood,omitempty"`
	SleepHours *float64 `json:"sleepHours,omitempty"`
	Note       *string  `json:"note,omitempty"`
}

type checkInHandler struct {
	repo *checkin.Repository
}

func newCheckInHandler(repo *checkin.Repository) *checkInHandler {
	return &checkInHandler{repo: repo}
}

func (h *checkInHandler) get(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	dateStr := chi.URLParam(r, "date")
	day, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad date — expect YYYY-MM-DD")
		return
	}
	ci, err := h.repo.Get(r.Context(), u.ID, day)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "get check-in")
		return
	}
	if ci == nil {
		writeJSON(w, http.StatusOK, map[string]any{"checkIn": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"checkIn": checkInDTO{
		Date:       ci.Date.Format("2006-01-02"),
		Mood:       ci.Mood,
		SleepHours: ci.SleepHours,
		Note:       ci.Note,
	}})
}

type putCheckInRequest struct {
	Mood       *int16   `json:"mood,omitempty"`
	SleepHours *float64 `json:"sleepHours,omitempty"`
	Note       *string  `json:"note,omitempty"`
}

func (h *checkInHandler) put(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	dateStr := chi.URLParam(r, "date")
	day, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad date — expect YYYY-MM-DD")
		return
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	var req putCheckInRequest
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Mood != nil && (*req.Mood < 1 || *req.Mood > 5) {
		writeError(w, http.StatusBadRequest, "mood must be 1-5")
		return
	}
	ci, err := h.repo.Upsert(r.Context(), checkin.UpsertInput{
		UserID:     u.ID,
		Date:       day,
		Mood:       req.Mood,
		SleepHours: req.SleepHours,
		Note:       req.Note,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "upsert")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"checkIn": checkInDTO{
		Date:       ci.Date.Format("2006-01-02"),
		Mood:       ci.Mood,
		SleepHours: ci.SleepHours,
		Note:       ci.Note,
	}})
}
