package http

import (
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/go-chi/chi/v5"
)

type dailySummaryDTO struct {
	Date             string   `json:"date"`
	SleepHours       *float64 `json:"sleepHours,omitempty"`
	SleepDeepMinutes *int     `json:"sleepDeepMinutes,omitempty"`
	SleepRemMinutes  *int     `json:"sleepRemMinutes,omitempty"`
	SleepCoreMinutes *int     `json:"sleepCoreMinutes,omitempty"`
	Steps            *int     `json:"steps,omitempty"`
	DistanceMeters   *int     `json:"distanceMeters,omitempty"`
	ActiveEnergyKcal *int     `json:"activeEnergyKcal,omitempty"`
	RestingHeartRate *int     `json:"restingHeartRate,omitempty"`
	HrvMs            *int     `json:"hrvMs,omitempty"`
	Source           string   `json:"source"`
	UpdatedAt        string   `json:"updatedAt"`
}

type dailySumHandler struct {
	repo *dailysum.Repository
}

func newDailySumHandler(repo *dailysum.Repository) *dailySumHandler {
	return &dailySumHandler{repo: repo}
}

type putDailySumRequest struct {
	SleepHours       *float64 `json:"sleepHours,omitempty"`
	SleepDeepMinutes *int     `json:"sleepDeepMinutes,omitempty"`
	SleepRemMinutes  *int     `json:"sleepRemMinutes,omitempty"`
	SleepCoreMinutes *int     `json:"sleepCoreMinutes,omitempty"`
	Steps            *int     `json:"steps,omitempty"`
	DistanceMeters   *int     `json:"distanceMeters,omitempty"`
	ActiveEnergyKcal *int     `json:"activeEnergyKcal,omitempty"`
	RestingHeartRate *int     `json:"restingHeartRate,omitempty"`
	HrvMs            *int     `json:"hrvMs,omitempty"`
	Source           string   `json:"source,omitempty"`
}

func (h *dailySumHandler) put(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	dateStr := chi.URLParam(r, "date")
	day, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad date — expect YYYY-MM-DD")
		return
	}
	var req putDailySumRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	// Light validation: refuse obviously broken numbers so a buggy client
	// doesn't poison the correlation engine.
	if req.SleepHours != nil && (*req.SleepHours < 0 || *req.SleepHours > 24) {
		writeError(w, http.StatusBadRequest, "sleepHours out of range")
		return
	}
	if req.RestingHeartRate != nil && (*req.RestingHeartRate < 25 || *req.RestingHeartRate > 220) {
		writeError(w, http.StatusBadRequest, "restingHeartRate out of physiological range")
		return
	}
	if req.HrvMs != nil && (*req.HrvMs < 0 || *req.HrvMs > 500) {
		writeError(w, http.StatusBadRequest, "hrvMs out of range")
		return
	}

	saved, err := h.repo.Upsert(r.Context(), dailysum.UpsertInput{
		UserID:           u.ID,
		Date:             day,
		SleepHours:       req.SleepHours,
		SleepDeepMinutes: req.SleepDeepMinutes,
		SleepRemMinutes:  req.SleepRemMinutes,
		SleepCoreMinutes: req.SleepCoreMinutes,
		Steps:            req.Steps,
		DistanceMeters:   req.DistanceMeters,
		ActiveEnergyKcal: req.ActiveEnergyKcal,
		RestingHeartRate: req.RestingHeartRate,
		HrvMs:            req.HrvMs,
		Source:           req.Source,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "upsert daily summary")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"dailySummary": dailySummaryDTO{
		Date:             saved.Date.Format("2006-01-02"),
		SleepHours:       saved.SleepHours,
		SleepDeepMinutes: saved.SleepDeepMinutes,
		SleepRemMinutes:  saved.SleepRemMinutes,
		SleepCoreMinutes: saved.SleepCoreMinutes,
		Steps:            saved.Steps,
		DistanceMeters:   saved.DistanceMeters,
		ActiveEnergyKcal: saved.ActiveEnergyKcal,
		RestingHeartRate: saved.RestingHeartRate,
		HrvMs:            saved.HrvMs,
		Source:           saved.Source,
		UpdatedAt:        saved.UpdatedAt.UTC().Format(time.RFC3339),
	}})
}
