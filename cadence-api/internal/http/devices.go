package http

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/notify"
	"github.com/go-chi/chi/v5"
)

type devicesHandler struct {
	repo   *notify.Repository
	sender *notify.Sender
}

func newDevicesHandler(repo *notify.Repository, sender *notify.Sender) *devicesHandler {
	return &devicesHandler{repo: repo, sender: sender}
}

type registerDeviceRequest struct {
	Token    string `json:"token"`
	Platform string `json:"platform"`
}

func (h *devicesHandler) register(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	var req registerDeviceRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	req.Token = strings.TrimSpace(req.Token)
	if req.Token == "" {
		writeError(w, http.StatusBadRequest, "token is required")
		return
	}
	platform := notify.Platform(strings.ToLower(req.Platform))
	if platform != notify.PlatformIOS && platform != notify.PlatformAndroid {
		writeError(w, http.StatusBadRequest, "platform must be 'ios' or 'android'")
		return
	}
	if err := h.repo.Upsert(r.Context(), req.Token, u.ID, platform); err != nil {
		writeError(w, http.StatusInternalServerError, "register device")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *devicesHandler) unregister(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	token := strings.TrimSpace(chi.URLParam(r, "token"))
	if token == "" {
		writeError(w, http.StatusBadRequest, "token required")
		return
	}
	if err := h.repo.DeleteForUser(r.Context(), token, u.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "unregister device")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// test is a dev affordance — sends a hello notification to every device the
// caller has registered. Used to verify the round trip end-to-end during
// rollout before templated triggers ship.
func (h *devicesHandler) test(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	if h.sender == nil {
		writeError(w, http.StatusServiceUnavailable, "push sender not configured")
		return
	}
	sent, pruned, err := h.sender.SendCategorized(r.Context(), u.ID, notify.CategoryTest, nil)
	if errors.Is(err, notify.ErrSenderDisabled) {
		writeError(w, http.StatusServiceUnavailable, "push sender disabled")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "send test push")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"sent":   sent,
		"pruned": pruned,
	})
}
