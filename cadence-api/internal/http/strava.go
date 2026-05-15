package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/strava"
)

type stravaHandler struct {
	service     *strava.Service
	verifyToken string // shared secret for webhook subscribe handshake
	// successDeepLink is where the OAuth callback sends the user's browser
	// after a successful connection. The mobile app handles cadence://
	// scheme links and dismisses the in-app WebBrowser sheet on receipt.
	successDeepLink string
	failureDeepLink string
}

func newStravaHandler(service *strava.Service, verifyToken string) *stravaHandler {
	return &stravaHandler{
		service:         service,
		verifyToken:     verifyToken,
		successDeepLink: "cadence://strava/connected",
		failureDeepLink: "cadence://strava/error",
	}
}

// connect kicks off the OAuth flow. Returns the URL the client should
// open in an in-app browser. Response shape mirrors the convention
// already used by /v1/me — `{ authorizeUrl: "https://www.strava.com/..." }`.
func (h *stravaHandler) connect(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	authURL, err := h.service.BeginAuthorize(u.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "build strava authorize url")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"authorizeUrl": authURL})
}

// callback is the OAuth redirect target. Not auth-required (Strava
// can't carry our Bearer token), but state is the binding to the
// originating user. On success we redirect to the deep link so the
// mobile WebBrowser closes itself.
//
// IMPORTANT: this handler is registered OUTSIDE the /v1 auth-gated
// route group. See router.go.
func (h *stravaHandler) callback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	errParam := q.Get("error")
	if errParam != "" {
		http.Redirect(w, r, h.failureDeepLink+"?reason="+errParam, http.StatusSeeOther)
		return
	}
	code := q.Get("code")
	state := q.Get("state")
	if code == "" || state == "" {
		http.Redirect(w, r, h.failureDeepLink+"?reason=missing_params", http.StatusSeeOther)
		return
	}
	if _, err := h.service.FinishAuthorize(r.Context(), code, state); err != nil {
		http.Redirect(w, r, h.failureDeepLink+"?reason=exchange_failed", http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, h.successDeepLink, http.StatusSeeOther)
}

// status reports whether the calling user has an active Strava
// connection. Includes the athlete name so the mobile UI can render
// "Connected as Rohith Gilla" rather than just a bare toggle.
func (h *stravaHandler) status(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	conn, err := h.service.Repo().GetByUser(r.Context(), u.ID)
	if err != nil {
		if errors.Is(err, strava.ErrConnectionNotFound) {
			writeJSON(w, http.StatusOK, map[string]any{"connected": false})
			return
		}
		writeError(w, http.StatusInternalServerError, "load strava status")
		return
	}
	resp := map[string]any{
		"connected":   true,
		"athleteId":   conn.AthleteID,
		"connectedAt": conn.CreatedAt,
	}
	if conn.AthleteFirstname != nil || conn.AthleteLastname != nil {
		var fn, ln string
		if conn.AthleteFirstname != nil {
			fn = *conn.AthleteFirstname
		}
		if conn.AthleteLastname != nil {
			ln = *conn.AthleteLastname
		}
		resp["athleteName"] = strings.TrimSpace(fn + " " + ln)
	}
	if conn.AthleteProfileURL != nil {
		resp["athleteAvatarUrl"] = *conn.AthleteProfileURL
	}
	writeJSON(w, http.StatusOK, resp)
}

// disconnect tears the connection down. Idempotent: a second call
// after a successful disconnect returns 204 too.
func (h *stravaHandler) disconnect(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	if err := h.service.Disconnect(r.Context(), u.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "disconnect strava")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// webhookVerify is Strava's subscribe handshake. Strava GETs the
// callback URL with hub.mode=subscribe + hub.verify_token + hub.challenge
// and we must echo the challenge back as JSON when the verify token
// matches. No auth — Strava can't carry a Bearer.
func (h *stravaHandler) webhookVerify(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if q.Get("hub.mode") != "subscribe" {
		writeError(w, http.StatusBadRequest, "unsupported hub.mode")
		return
	}
	if q.Get("hub.verify_token") != h.verifyToken {
		writeError(w, http.StatusForbidden, "bad verify token")
		return
	}
	challenge := q.Get("hub.challenge")
	writeJSON(w, http.StatusOK, map[string]string{"hub.challenge": challenge})
}

// webhookEvent receives activity / athlete events from Strava. We
// acknowledge quickly (Strava requires a 2xx within 2 seconds) and
// process inline — webhook event handling is fast enough not to need
// a queue yet, but if rate ever exceeds the inline budget we'd push
// to a channel here and drain in a worker.
func (h *stravaHandler) webhookEvent(w http.ResponseWriter, r *http.Request) {
	var ev strava.WebhookEvent
	if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
		writeError(w, http.StatusBadRequest, "bad event body")
		return
	}
	// Per Strava: always return 200 fast. Errors during ingest are
	// logged but never bubbled up to Strava — they'd retry and we'd
	// just hit the same error.
	if err := h.service.HandleWebhookEvent(r.Context(), ev); err != nil {
		// Log path lives in the surrounding middleware (chi Logger).
		// Suppress the error here on purpose.
		_ = err
	}
	w.WriteHeader(http.StatusOK)
}
