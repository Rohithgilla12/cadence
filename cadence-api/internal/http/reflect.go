package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/reflect"
)

type rhythmDTO struct {
	WindowDays     int                `json:"windowDays"`
	TotalSlots     int                `json:"totalSlots"`
	TotalCompleted int                `json:"totalCompleted"`
	ByWeekday      []rhythmWeekdayDTO `json:"byWeekday"`
}

type rhythmWeekdayDTO struct {
	WeekdayIndex   int     `json:"weekdayIndex"` // 0=Mon..6=Sun
	Label          string  `json:"label"`
	CompletedLogs  int     `json:"completedLogs"`
	TotalSlots     int     `json:"totalSlots"`
	CompletionRate float64 `json:"completionRate"`
}

type reflectHandler struct {
	repo *reflect.Repository
}

func newReflectHandler(repo *reflect.Repository) *reflectHandler {
	return &reflectHandler{repo: repo}
}

type heatmapDayDTO struct {
	Date           string  `json:"date"` // YYYY-MM-DD
	TotalSlots     int     `json:"totalSlots"`
	CompletedLogs  int     `json:"completedLogs"`
	CompletionRate float64 `json:"completionRate"`
}

type heatmapDTO struct {
	WindowDays int             `json:"windowDays"`
	Days       []heatmapDayDTO `json:"days"`
}

func (h *reflectHandler) heatmap(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	windowDays := 60
	if raw := r.URL.Query().Get("windowDays"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 365 {
			windowDays = parsed
		}
	}
	hm, err := h.repo.ComputeHeatmap(r.Context(), u.ID, windowDays, time.Now().UTC())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "compute heatmap")
		return
	}
	out := heatmapDTO{
		WindowDays: hm.WindowDays,
		Days:       make([]heatmapDayDTO, 0, len(hm.Days)),
	}
	for _, d := range hm.Days {
		out.Days = append(out.Days, heatmapDayDTO{
			Date:           d.Date.Format("2006-01-02"),
			TotalSlots:     d.TotalSlots,
			CompletedLogs:  d.CompletedLogs,
			CompletionRate: d.CompletionRate,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"heatmap": out})
}

func (h *reflectHandler) rhythm(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	windowDays := 56
	if raw := r.URL.Query().Get("windowDays"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 365 {
			windowDays = parsed
		}
	}
	rhythm, err := h.repo.ComputeRhythm(r.Context(), u.ID, windowDays, time.Now().UTC())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "compute rhythm")
		return
	}
	out := rhythmDTO{
		WindowDays:     rhythm.WindowDays,
		TotalSlots:     rhythm.TotalSlots,
		TotalCompleted: rhythm.TotalCompleted,
		ByWeekday:      make([]rhythmWeekdayDTO, 0, 7),
	}
	for _, b := range rhythm.ByWeekday {
		out.ByWeekday = append(out.ByWeekday, rhythmWeekdayDTO{
			WeekdayIndex:   b.WeekdayIndex,
			Label:          b.Label,
			CompletedLogs:  b.CompletedLogs,
			TotalSlots:     b.TotalSlots,
			CompletionRate: b.CompletionRate,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"rhythm": out})
}
