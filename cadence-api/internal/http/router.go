package http

import (
	"net/http"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/circle"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/feed"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/notify"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/pact"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/reflect"
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
	Pacts          *pact.Repository
	Feed           *feed.Repository
	Reflect        *reflect.Repository
	Devices        *notify.Repository
	PushSender     *notify.Sender
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
		r.Delete("/me", DeleteMe(deps.Users))

		habits := newHabitsHandler(deps.Habits, deps.HabitLogs, deps.Feed)
		r.Get("/habits", habits.list)
		r.Post("/habits", habits.create)
		r.Patch("/habits/{id}", habits.update)
		r.Post("/habits/{id}/toggle", habits.toggle)
		r.Post("/habits/{id}/skip", habits.skip)
		r.Delete("/habits/{id}", habits.archive)

		checkIns := newCheckInHandler(deps.CheckIns)
		r.Get("/check-ins/{date}", checkIns.get)
		r.Put("/check-ins/{date}", checkIns.put)

		dailySums := newDailySumHandler(deps.DailySummaries)
		r.Put("/daily-summaries/{date}", dailySums.put)
		r.Post("/daily-summaries/bulk", dailySums.bulk)

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

		if deps.Pacts != nil {
			pacts := newPactsHandler(deps.Pacts)
			r.Post("/circles/{id}/pacts", pacts.create)
			r.Get("/circles/{id}/pacts", pacts.listForCircle)
			r.Post("/pacts/{id}/complete", pacts.complete)
		}

		if deps.Feed != nil {
			feedH := newFeedHandler(deps.Feed)
			r.Get("/circles/{id}/feed", feedH.listForCircle)
			r.Post("/feed/{id}/reactions/toggle", feedH.toggleReaction)
		}

		if deps.Reflect != nil {
			reflectH := newReflectHandler(deps.Reflect)
			r.Get("/reflect/rhythm", reflectH.rhythm)
			r.Get("/reflect/heatmap", reflectH.heatmap)
		}

		if deps.Devices != nil {
			devicesH := newDevicesHandler(deps.Devices, deps.PushSender)
			r.Put("/me/devices", devicesH.register)
			r.Delete("/me/devices/{token}", devicesH.unregister)
			r.Post("/me/devices/test", devicesH.test)
		}
	})

	return r
}
