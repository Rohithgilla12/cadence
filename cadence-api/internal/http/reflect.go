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
