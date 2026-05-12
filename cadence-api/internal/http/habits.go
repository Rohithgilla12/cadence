package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type habitDTO struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	Icon         string        `json:"icon"`
	TimeOfDay    string        `json:"timeOfDay"`
	Target       *habit.Target `json:"target,omitempty"`
	TrackContext bool          `json:"trackContext"`
	DoneToday    bool          `json:"doneToday"`
	Streak       int           `json:"streak"`
	AutoDetected bool          `json:"autoDetected"`
	CreatedAt    time.Time     `json:"createdAt"`
}

type habitsHandler struct {
	habits *habit.Repository
	logs   *habit.LogRepository
}

func newHabitsHandler(habits *habit.Repository, logs *habit.LogRepository) *habitsHandler {
	return &habitsHandler{habits: habits, logs: logs}
}

func (h *habitsHandler) list(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	all, err := h.habits.ListForUser(r.Context(), u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list habits")
		return
	}
	ids := make([]uuid.UUID, 0, len(all))
	for _, hab := range all {
		ids = append(ids, hab.ID)
	}
	today := startOfDayUTC(time.Now())
	doneMap, err := h.logs.DoneByDate(r.Context(), ids, today)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "done map")
		return
	}
	out := make([]habitDTO, 0, len(all))
	for _, hab := range all {
		dates, err := h.logs.RecentCompletedDates(r.Context(), hab.ID, today, 60)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "recent")
			return
		}
		out = append(out, habitDTO{
			ID:           hab.ID.String(),
			Name:         hab.Name,
			Icon:         hab.Icon,
			TimeOfDay:    string(hab.TimeOfDay),
			Target:       hab.Target,
			TrackContext: hab.TrackContext,
			DoneToday:    doneMap[hab.ID],
			Streak:       habit.ComputeStreak(dates, today),
			CreatedAt:    hab.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"habits": out})
}

type createHabitRequest struct {
	Name         string        `json:"name"`
	Icon         string        `json:"icon"`
	TimeOfDay    string        `json:"timeOfDay"`
	Target       *habit.Target `json:"target,omitempty"`
	TrackContext bool          `json:"trackContext"`
}

func (h *habitsHandler) create(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req createHabitRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	hab, err := h.habits.Create(r.Context(), habit.CreateInput{
		UserID:       u.ID,
		Name:         req.Name,
		Icon:         req.Icon,
		TimeOfDay:    habit.TimeOfDay(req.TimeOfDay),
		Target:       req.Target,
		TrackContext: req.TrackContext,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"habit": habitDTO{
		ID:           hab.ID.String(),
		Name:         hab.Name,
		Icon:         hab.Icon,
		TimeOfDay:    string(hab.TimeOfDay),
		Target:       hab.Target,
		TrackContext: hab.TrackContext,
		CreatedAt:    hab.CreatedAt,
	}})
}

func (h *habitsHandler) toggle(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	hab, err := h.habits.GetByID(r.Context(), id, u.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "habit not found")
		return
	}
	today := startOfDayUTC(time.Now())
	doneMap, _ := h.logs.DoneByDate(r.Context(), []uuid.UUID{id}, today)
	if doneMap[id] {
		if err := h.logs.Delete(r.Context(), id, today); err != nil {
			writeError(w, http.StatusInternalServerError, "delete log")
			return
		}
	} else {
		if _, err := h.logs.Upsert(r.Context(), habit.UpsertLogInput{HabitID: id, Date: today, Completed: true, Source: habit.SourceManual}); err != nil {
			writeError(w, http.StatusInternalServerError, "upsert log")
			return
		}
	}
	dates, _ := h.logs.RecentCompletedDates(r.Context(), id, today, 60)
	doneMap, _ = h.logs.DoneByDate(r.Context(), []uuid.UUID{id}, today)
	writeJSON(w, http.StatusOK, map[string]any{"habit": habitDTO{
		ID:           hab.ID.String(),
		Name:         hab.Name,
		Icon:         hab.Icon,
		TimeOfDay:    string(hab.TimeOfDay),
		Target:       hab.Target,
		TrackContext: hab.TrackContext,
		DoneToday:    doneMap[id],
		Streak:       habit.ComputeStreak(dates, today),
		CreatedAt:    hab.CreatedAt,
	}})
}

func (h *habitsHandler) archive(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	if _, err := h.habits.GetByID(r.Context(), id, u.ID); err != nil {
		writeError(w, http.StatusNotFound, "habit not found")
		return
	}
	if err := h.habits.Archive(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "archive")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func startOfDayUTC(t time.Time) time.Time {
	t = t.UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}
