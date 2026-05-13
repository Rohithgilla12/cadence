package http

import (
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/circle"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Deps struct {
	Pool           *pgxpool.Pool
	Verifier       auth.Verifier
	Resolver       auth.UserResolver
	Users          *user.Repository
	Habits         *habit.Repository
	HabitLogs      *habit.LogRepository
	CheckIns       *checkin.Repository
	DailySummaries *dailysum.Repository
	InsightEngine  *insight.Engine
	Insights       *insight.Repository
	Circles        *circle.Repository
}

func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	r.Get("/health", Health(deps.Pool))

	r.Route("/v1", func(r chi.Router) {
		r.Use(auth.RequireAuth(deps.Verifier, deps.Resolver))
		r.Get("/me", GetMe)
		r.Patch("/me", PatchMe(deps.Users))

		habits := newHabitsHandler(deps.Habits, deps.HabitLogs)
		r.Get("/habits", habits.list)
		r.Post("/habits", habits.create)
		r.Patch("/habits/{id}", habits.update)
		r.Post("/habits/{id}/toggle", habits.toggle)
		r.Delete("/habits/{id}", habits.archive)

		checkIns := newCheckInHandler(deps.CheckIns)
		r.Get("/check-ins/{date}", checkIns.get)
		r.Put("/check-ins/{date}", checkIns.put)

		dailySums := newDailySumHandler(deps.DailySummaries)
		r.Put("/daily-summaries/{date}", dailySums.put)

		if deps.InsightEngine != nil && deps.Insights != nil {
			insights := newInsightsHandler(deps.InsightEngine, deps.Insights)
			r.Get("/insights/today", insights.today)
			r.Get("/insights", insights.list)
			r.Post("/insights/compute", insights.compute)
		}

		if deps.Circles != nil {
			circles := newCirclesHandler(deps.Circles)
			r.Get("/circles", circles.list)
			r.Post("/circles", circles.create)
			r.Get("/circles/{id}", circles.get)
			r.Post("/circles/join/{token}", circles.join)
		}
	})

	return r
}
