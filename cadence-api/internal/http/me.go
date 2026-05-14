package http

import (
	"encoding/json"
	"net/http"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

type meResponse struct {
	ID                  string   `json:"id"`
	FirebaseUID         string   `json:"firebaseUid"`
	Email               string   `json:"email"`
	DisplayName         string   `json:"displayName"`
	Handle              string   `json:"handle"`
	Intent              string   `json:"intent"`
	Pillars             []string `json:"pillars"`
	OnboardingCompleted bool     `json:"onboardingCompleted"`
}

func toMeResponse(u user.User) meResponse {
	return meResponse{
		ID:                  u.ID.String(),
		FirebaseUID:         u.FirebaseUID,
		Email:               u.Email,
		DisplayName:         u.DisplayName,
		Handle:              u.Handle,
		Intent:              u.Intent,
		Pillars:             u.Pillars,
		OnboardingCompleted: u.Intent != "",
	}
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusInternalServerError, "no user in context")
		return
	}
	writeJSON(w, http.StatusOK, toMeResponse(u))
}

type patchMeRequest struct {
	Intent      *string   `json:"intent,omitempty"`
	Pillars     *[]string `json:"pillars,omitempty"`
	DisplayName *string   `json:"displayName,omitempty"`
}

// DeleteMe hard-deletes the calling user. PRD §15 — "delete account and all
// data with one action." All child rows cascade away via FK constraints.
// Idempotent: returns 204 even when the row was already gone.
func DeleteMe(users *user.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusInternalServerError, "no user in context")
			return
		}
		if err := users.DeleteByID(r.Context(), u.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "delete account")
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func PatchMe(users *user.Repository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusInternalServerError, "no user in context")
			return
		}
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		var req patchMeRequest
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		updated, err := users.UpdateProfile(r.Context(), u.ID, user.UpdateProfileInput{
			Intent:      req.Intent,
			Pillars:     req.Pillars,
			DisplayName: req.DisplayName,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "update failed")
			return
		}
		writeJSON(w, http.StatusOK, toMeResponse(updated))
	}
}
