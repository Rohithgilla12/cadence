package http

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/feed"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type habitDTO struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Icon         string            `json:"icon"`
	TimeOfDay    string            `json:"timeOfDay"`
	Target       *habit.Target     `json:"target,omitempty"`
	SourceLink   *habit.SourceLink `json:"sourceLink,omitempty"`
	SharedWith   []string          `json:"sharedWith"`
	TrackContext bool              `json:"trackContext"`
	DoneToday    bool              `json:"doneToday"`
	Streak       int               `json:"streak"`
	AutoDetected bool              `json:"autoDetected"`
	CreatedAt    time.Time         `json:"createdAt"`
}

func toHabitDTO(h habit.Habit, doneToday bool, streak int, autoDetected bool) habitDTO {
	shared := make([]string, 0, len(h.SharedWith))
	for _, id := range h.SharedWith {
		shared = append(shared, id.String())
	}
	return habitDTO{
		ID:           h.ID.String(),
		Name:         h.Name,
		Icon:         h.Icon,
		TimeOfDay:    string(h.TimeOfDay),
		Target:       h.Target,
		SourceLink:   h.SourceLink,
		SharedWith:   shared,
		TrackContext: h.TrackContext,
		DoneToday:    doneToday,
		Streak:       streak,
		AutoDetected: autoDetected,
		CreatedAt:    h.CreatedAt,
	}
}

type habitsHandler struct {
	habits *habit.Repository
	logs   *habit.LogRepository
	feed   *feed.Repository
}

func newHabitsHandler(habits *habit.Repository, logs *habit.LogRepository, feedRepo *feed.Repository) *habitsHandler {
	return &habitsHandler{habits: habits, logs: logs, feed: feedRepo}
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
	sourceMap, err := h.logs.SourceByDate(r.Context(), ids, today)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "source map")
		return
	}
	out := make([]habitDTO, 0, len(all))
	for _, hab := range all {
		dates, err := h.logs.RecentCompletedDates(r.Context(), hab.ID, today, 60)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "recent")
			return
		}
		auto := doneMap[hab.ID] && sourceMap[hab.ID] != "" && sourceMap[hab.ID] != habit.SourceManual
		out = append(out, toHabitDTO(hab, doneMap[hab.ID], habit.ComputeStreak(dates, today), auto))
	}
	writeJSON(w, http.StatusOK, map[string]any{"habits": out})
}

type createHabitRequest struct {
	Name         string            `json:"name"`
	Icon         string            `json:"icon"`
	TimeOfDay    string            `json:"timeOfDay"`
	Target       *habit.Target     `json:"target,omitempty"`
	SourceLink   *habit.SourceLink `json:"sourceLink,omitempty"`
	SharedWith   []string          `json:"sharedWith,omitempty"`
	TrackContext bool              `json:"trackContext"`
}

// parseSharedWith validates each id and confirms the caller is a member of
// each circle. Non-member entries are filtered out silently — that prevents
// a buggy client from making the API surface a 4xx for stale circle IDs.
func parseSharedWith(raw []string) ([]uuid.UUID, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	out := make([]uuid.UUID, 0, len(raw))
	for _, s := range raw {
		id, err := uuid.Parse(s)
		if err != nil {
			return nil, fmt.Errorf("invalid circle id %q", s)
		}
		out = append(out, id)
	}
	return out, nil
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
	sharedWith, err := parseSharedWith(req.SharedWith)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	hab, err := h.habits.Create(r.Context(), habit.CreateInput{
		UserID:       u.ID,
		Name:         req.Name,
		Icon:         req.Icon,
		TimeOfDay:    habit.TimeOfDay(req.TimeOfDay),
		Target:       req.Target,
		SourceLink:   req.SourceLink,
		SharedWith:   sharedWith,
		TrackContext: req.TrackContext,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "create")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"habit": toHabitDTO(hab, false, 0, false)})
}

type updateHabitRequest struct {
	Name            *string           `json:"name,omitempty"`
	Icon            *string           `json:"icon,omitempty"`
	TimeOfDay       *string           `json:"timeOfDay,omitempty"`
	Target          *habit.Target     `json:"target,omitempty"`
	ClearTarget     bool              `json:"clearTarget,omitempty"`
	SourceLink      *habit.SourceLink `json:"sourceLink,omitempty"`
	ClearSourceLink bool              `json:"clearSourceLink,omitempty"`
	TrackContext    *bool             `json:"trackContext,omitempty"`
	// SharedWith fully replaces the habit's shared_with array when present.
	// Pass an empty slice to clear sharing.
	SharedWith *[]string `json:"sharedWith,omitempty"`
}

func (h *habitsHandler) update(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	var req updateHabitRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var tod *habit.TimeOfDay
	if req.TimeOfDay != nil {
		v := habit.TimeOfDay(*req.TimeOfDay)
		tod = &v
	}
	var sharedWithPtr *[]uuid.UUID
	if req.SharedWith != nil {
		parsed, err := parseSharedWith(*req.SharedWith)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if parsed == nil {
			parsed = []uuid.UUID{}
		}
		sharedWithPtr = &parsed
	}
	hab, err := h.habits.Update(r.Context(), habit.UpdateInput{
		ID:              id,
		OwnerID:         u.ID,
		Name:            req.Name,
		Icon:            req.Icon,
		TimeOfDay:       tod,
		Target:          req.Target,
		ClearTarget:     req.ClearTarget,
		SourceLink:      req.SourceLink,
		ClearSourceLink: req.ClearSourceLink,
		TrackContext:    req.TrackContext,
		SharedWith:      sharedWithPtr,
	})
	if errors.Is(err, habit.ErrNotFound) {
		writeError(w, http.StatusNotFound, "habit not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update")
		return
	}
	today := startOfDayUTC(time.Now())
	doneMap, _ := h.logs.DoneByDate(r.Context(), []uuid.UUID{id}, today)
	sourceMap, _ := h.logs.SourceByDate(r.Context(), []uuid.UUID{id}, today)
	dates, _ := h.logs.RecentCompletedDates(r.Context(), id, today, 60)
	auto := doneMap[id] && sourceMap[id] != "" && sourceMap[id] != habit.SourceManual
	writeJSON(w, http.StatusOK, map[string]any{"habit": toHabitDTO(hab, doneMap[id], habit.ComputeStreak(dates, today), auto)})
}

type toggleHabitRequest struct {
	Source string `json:"source,omitempty"`
}

func (h *habitsHandler) toggle(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad id")
		return
	}
	// Body is optional; if absent, treat as manual.
	var req toggleHabitRequest
	if r.ContentLength > 0 {
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	source := habit.SourceManual
	if req.Source != "" {
		source = habit.LogSource(req.Source)
	}
	hab, err := h.habits.GetByID(r.Context(), id, u.ID)
	if err != nil {
		writeError(w, http.StatusNotFound, "habit not found")
		return
	}
	today := startOfDayUTC(time.Now())
	doneMap, _ := h.logs.DoneByDate(r.Context(), []uuid.UUID{id}, today)
	sourceMap, _ := h.logs.SourceByDate(r.Context(), []uuid.UUID{id}, today)
	existingSource := sourceMap[id]

	if doneMap[id] {
		// Guard: an auto-detected log can be toggled off by the user (that's a
		// deliberate untick). But an auto-detect run must not overwrite a
		// manual log — PRD §9 "never auto-uncheck a manually-logged habit".
		if source != habit.SourceManual && existingSource == habit.SourceManual {
			// No-op: leave the manual log intact.
			dates, _ := h.logs.RecentCompletedDates(r.Context(), id, today, 60)
			auto := existingSource != "" && existingSource != habit.SourceManual
			writeJSON(w, http.StatusOK, map[string]any{"habit": toHabitDTO(hab, true, habit.ComputeStreak(dates, today), auto)})
			return
		}
		if err := h.logs.Delete(r.Context(), id, today); err != nil {
			writeError(w, http.StatusInternalServerError, "delete log")
			return
		}
	} else {
		if _, err := h.logs.Upsert(r.Context(), habit.UpsertLogInput{HabitID: id, Date: today, Completed: true, Source: source}); err != nil {
			writeError(w, http.StatusInternalServerError, "upsert log")
			return
		}
		// PRD §10 — emit a feed item to every circle this habit is shared
		// with. Per-habit opt-in: only habits the user explicitly added to
		// shared_with appear in their circles' feeds. Auto-detect logs
		// trigger the same emission so a recorded run lands in the feed
		// without an extra tap. Failures here are silent — feed visibility
		// shouldn't block the user's toggle from succeeding.
		if h.feed != nil && len(hab.SharedWith) > 0 {
			payload := map[string]any{
				"habitId":   hab.ID.String(),
				"habitName": hab.Name,
				"habitIcon": hab.Icon,
				"source":    string(source),
			}
			for _, circleID := range hab.SharedWith {
				_, _ = h.feed.Emit(r.Context(), feed.EmitInput{
					CircleID: circleID,
					UserID:   u.ID,
					Kind:     feed.KindHabitDone,
					Payload:  payload,
				})
			}
		}
	}
	dates, _ := h.logs.RecentCompletedDates(r.Context(), id, today, 60)
	doneMap, _ = h.logs.DoneByDate(r.Context(), []uuid.UUID{id}, today)
	sourceMap, _ = h.logs.SourceByDate(r.Context(), []uuid.UUID{id}, today)
	finalSource := sourceMap[id]
	auto := doneMap[id] && finalSource != "" && finalSource != habit.SourceManual
	writeJSON(w, http.StatusOK, map[string]any{"habit": toHabitDTO(hab, doneMap[id], habit.ComputeStreak(dates, today), auto)})
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
