package http

import (
	"encoding/json"
	"net/http"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
)

type meResponse struct {
	ID          string   `json:"id"`
	FirebaseUID string   `json:"firebaseUid"`
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Handle      string   `json:"handle"`
	Intent      string   `json:"intent"`
	Pillars     []string `json:"pillars"`
}

func GetMe(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "no user in context", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(meResponse{
		ID:          u.ID.String(),
		FirebaseUID: u.FirebaseUID,
		Email:       u.Email,
		DisplayName: u.DisplayName,
		Handle:      u.Handle,
		Intent:      u.Intent,
		Pillars:     u.Pillars,
	})
}
