package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func NewRouter() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/health", Health)

	r.Route("/v1", func(r chi.Router) {
		// Habit, check-in, circle, insight, integration routes land here as
		// the corresponding domains come online (Phase 1 → 5 in PRD §17).
	})

	return r
}
