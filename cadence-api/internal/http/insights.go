package http

import (
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
)

// insightsHandler exposes the analytics engine to the client. compute is a
// dev affordance to skip the nightly-cron wait; today + list are how the
// rendered insights actually reach the UI.
type insightsHandler struct {
	engine *insight.Engine
	repo   *insight.Repository
	// dailySums is read for the empty-state ETA on today — "N more
	// mornings of data and patterns start to surface." Nilable so existing
	// tests that don't construct one still work; the today handler falls
	// back to 0 when nil.
	dailySums *dailysum.Repository
}

func newInsightsHandler(engine *insight.Engine, repo *insight.Repository, dailySums *dailysum.Repository) *insightsHandler {
	return &insightsHandler{engine: engine, repo: repo, dailySums: dailySums}
}

// MinDaysForPattern mirrors insight.MinSampleSize — kept here as the
// client-facing constant the today endpoint reports as the threshold.
// Lets the mobile empty-state copy compute "N more mornings" without
// hardcoding the magic number twice.
const minDaysForPattern = 14

type insightDTO struct {
	ID           string         `json:"id"`
	HabitID      *string        `json:"habitId,omitempty"`
	PatternType  string         `json:"patternType"`
	EffectSize   float64        `json:"effectSize"`
	PValue       float64        `json:"pValue"`
	SampleSize   int            `json:"sampleSize"`
	TemplateID   string         `json:"templateId"`
	RenderedText string         `json:"renderedText"`
	ComputedAt   string         `json:"computedAt"`
	ShownAt      *string        `json:"shownAt,omitempty"`
	Params       map[string]any `json:"params,omitempty"`
}

func toInsightDTO(ins insight.Insight) insightDTO {
	dto := insightDTO{
		ID:           ins.ID.String(),
		PatternType:  ins.PatternType,
		EffectSize:   ins.EffectSize,
		PValue:       ins.PValue,
		SampleSize:   ins.SampleSize,
		TemplateID:   ins.TemplateID,
		RenderedText: ins.RenderedText,
		ComputedAt:   ins.ComputedAt.UTC().Format(time.RFC3339),
		Params:       ins.TemplateParams,
	}
	if ins.HabitID != nil {
		h := ins.HabitID.String()
		dto.HabitID = &h
	}
	if ins.ShownAt != nil {
		s := ins.ShownAt.UTC().Format(time.RFC3339)
		dto.ShownAt = &s
	}
	return dto
}

// today picks the highest-effect-size insight the user hasn't seen in the
// last 7 days and stamps shown_at so the rotation moves on next time. PRD
// §8 daily rotation: "Compute all eligible insights, filter shown in last
// 7d, rank by effect size, pick top one. If none eligible: 'Cadence is
// listening.' Never fabricate."
//
// Returns 200 with insight=null when nothing's eligible. Client renders the
// listening empty state in that case.
func (h *insightsHandler) today(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	const cooldown = 7 * 24 * time.Hour
	eligible, err := h.repo.ListEligibleForRotation(r.Context(), u.ID, cooldown)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list insights")
		return
	}
	daysOfData := 0
	if h.dailySums != nil {
		// Failing this query shouldn't take down /today — the count is
		// nice-to-have for the empty-state copy. Default to 0 on error.
		if n, err := h.dailySums.CountForUser(r.Context(), u.ID); err == nil {
			daysOfData = n
		}
	}
	if len(eligible) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{
			"insight":           nil,
			"daysOfData":        daysOfData,
			"minDaysForPattern": minDaysForPattern,
		})
		return
	}
	picked := eligible[0]
	if err := h.repo.MarkShown(r.Context(), picked.ID); err != nil {
		// Surface the insight anyway — failing to stamp shown_at means we
		// might show it again tomorrow, which is annoying but not broken.
		// Log path lives elsewhere; here we silently fall through.
		_ = err
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"insight":           toInsightDTO(picked),
		"daysOfData":        daysOfData,
		"minDaysForPattern": minDaysForPattern,
	})
}

// list returns all above-threshold insights for the user, ranked by effect
// size descending. Used by Reflect (PRD §7 weekly mirror). Includes
// already-shown insights — Reflect is the "show me everything" surface,
// rotation only governs the daily Today card.
func (h *insightsHandler) list(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	// 0 cooldown = no time-based filter; threshold gates still apply.
	all, err := h.repo.ListEligibleForRotation(r.Context(), u.ID, 0)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "list insights")
		return
	}
	out := make([]insightDTO, 0, len(all))
	for _, ins := range all {
		out = append(out, toInsightDTO(ins))
	}
	writeJSON(w, http.StatusOK, map[string]any{"insights": out})
}

// compute runs the engine for the calling user synchronously and reports
// how many insights got upserted. Dev affordance — production traffic goes
// through the nightly worker.
func (h *insightsHandler) compute(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	surfaced, err := h.engine.ComputeForUser(r.Context(), u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "compute insights")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"surfaced": surfaced})
}
