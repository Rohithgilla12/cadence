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

// Bulk import: cap per-request entries so a buggy client can't blow the
// connection. 90 covers our practical max (PRD §8 14-day floor + headroom)
// with room for a quarterly re-import too.
const bulkDailySumMaxEntries = 90

type bulkDailySumEntry struct {
	Date string `json:"date"`
	putDailySumRequest
}

type bulkDailySumRequest struct {
	Summaries []bulkDailySumEntry `json:"summaries"`
}

func validateRanges(e *putDailySumRequest) string {
	if e.SleepHours != nil && (*e.SleepHours < 0 || *e.SleepHours > 24) {
		return "sleepHours out of range"
	}
	if e.RestingHeartRate != nil && (*e.RestingHeartRate < 25 || *e.RestingHeartRate > 220) {
		return "restingHeartRate out of physiological range"
	}
	if e.HrvMs != nil && (*e.HrvMs < 0 || *e.HrvMs > 500) {
		return "hrvMs out of range"
	}
	return ""
}

func (h *dailySumHandler) bulk(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req bulkDailySumRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Summaries) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"imported": 0})
		return
	}
	if len(req.Summaries) > bulkDailySumMaxEntries {
		writeError(w, http.StatusBadRequest, "too many entries")
		return
	}

	inputs := make([]dailysum.UpsertInput, 0, len(req.Summaries))
	for _, e := range req.Summaries {
		day, err := time.Parse("2006-01-02", e.Date)
		if err != nil {
			writeError(w, http.StatusBadRequest, "bad date — expect YYYY-MM-DD")
			return
		}
		if msg := validateRanges(&e.putDailySumRequest); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		inputs = append(inputs, dailysum.UpsertInput{
			UserID:           u.ID,
			Date:             day,
			SleepHours:       e.SleepHours,
			SleepDeepMinutes: e.SleepDeepMinutes,
			SleepRemMinutes:  e.SleepRemMinutes,
			SleepCoreMinutes: e.SleepCoreMinutes,
			Steps:            e.Steps,
			DistanceMeters:   e.DistanceMeters,
			ActiveEnergyKcal: e.ActiveEnergyKcal,
			RestingHeartRate: e.RestingHeartRate,
			HrvMs:            e.HrvMs,
			Source:           e.Source,
		})
	}

	written, err := h.repo.UpsertBulk(r.Context(), inputs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "bulk upsert daily summaries")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"imported": written})
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
