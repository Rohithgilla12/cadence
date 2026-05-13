package http

import (
	"net/http"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
)

// insightsHandler exposes the analytics engine to the client. For v1 only the
// compute trigger lives here so we can verify pipeline plumbing end-to-end
// without waiting for the nightly cron. GET endpoints (today's insight,
// reflect-tab grid) ship next session.
type insightsHandler struct {
	engine *insight.Engine
}

func newInsightsHandler(engine *insight.Engine) *insightsHandler {
	return &insightsHandler{engine: engine}
}

// compute runs the engine for the calling user synchronously and reports how
// many insights got upserted. Useful for "I just connected health, let's see
// what pops" without a 24-hour wait. Not a fire-and-forget — we want a clean
// 500 on failure so client knows nothing changed.
func (h *insightsHandler) compute(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	surfaced, err := h.engine.ComputeForUser(r.Context(), u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "compute insights")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"surfaced": surfaced,
	})
}
