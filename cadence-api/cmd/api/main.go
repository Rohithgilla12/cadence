package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/auth"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/checkin"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/circle"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/config"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/feed"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/notify"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/pact"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/reflect"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/strava"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/user"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.MustLoad()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Apply migrations before opening the pool — keeps schema-up-to-date
	// invariant tight and surfaces migration failures as fatal startup errors.
	if err := db.ApplyMigrations(cfg.DatabaseURL); err != nil {
		logger.Error("migrations", "err", err)
		os.Exit(1)
	}
	logger.Info("migrations applied")

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("db pool", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	verifier, err := auth.NewFirebaseVerifier(ctx, cfg.FirebaseCredentials)
	if err != nil {
		logger.Error("firebase verifier", "err", err)
		os.Exit(1)
	}
	repo := user.NewRepository(pool)
	resolver := auth.UserResolverFromRepository(repo)

	habitRepo := habit.NewRepository(pool)
	habitLogRepo := habit.NewLogRepository(pool)
	checkInRepo := checkin.NewRepository(pool)
	dailySumRepo := dailysum.NewRepository(pool)
	insightRepo := insight.NewRepository(pool)
	insightEngine := insight.NewEngine(pool, insightRepo)
	circleRepo := circle.NewRepository(pool)
	pactRepo := pact.NewRepository(pool)
	feedRepo := feed.NewRepository(pool)
	reflectRepo := reflect.NewRepository(pool)
	devicesRepo := notify.NewRepository(pool)
	// Push sender reuses the existing Firebase service account credentials.
	// When the file isn't configured (local dev), NewSender returns a
	// disabled instance that still services token registration; the test
	// endpoint then 503s. Production has the same JSON mounted in.
	pushSender, err := notify.NewSender(ctx, devicesRepo, cfg.FirebaseCredentials)
	if err != nil {
		logger.Error("push sender", "err", err)
		os.Exit(1)
	}

	// Strava is optional. When the four STRAVA_* env vars are missing
	// the service stays nil and the router skips wiring the routes —
	// the rest of the API still boots in dev without Strava credentials.
	var stravaService *strava.Service
	if cfg.StravaConfigured() {
		cipher, err := strava.NewCipher(cfg.StravaTokenEncryptionKey)
		if err != nil {
			logger.Error("strava cipher", "err", err)
			os.Exit(1)
		}
		stravaClient := strava.NewClient(cfg.StravaClientID, cfg.StravaClientSecret)
		stravaRepo := strava.NewRepository(pool, cipher)
		stravaService = strava.NewService(stravaClient, stravaRepo, cfg.PublicBaseURL)
		// AutodetectFunc is wired in a follow-up commit once the habit
		// package exposes a Strava-aware matcher. For now activities
		// persist; habit logs don't fire from Strava events yet.
		logger.Info("strava enabled", "callback", cfg.PublicBaseURL+"/v1/strava/callback")
	} else {
		logger.Info("strava disabled — STRAVA_* env vars not configured")
	}

	server := &http.Server{
		Addr: fmt.Sprintf(":%d", cfg.Port),
		Handler: cadencehttp.NewRouter(cadencehttp.Deps{
			Pool:                     pool,
			Verifier:                 verifier,
			Resolver:                 resolver,
			Users:                    repo,
			Habits:                   habitRepo,
			HabitLogs:                habitLogRepo,
			CheckIns:                 checkInRepo,
			DailySummaries:           dailySumRepo,
			InsightEngine:            insightEngine,
			Insights:                 insightRepo,
			Circles:                  circleRepo,
			Pacts:                    pactRepo,
			Feed:                     feedRepo,
			Reflect:                  reflectRepo,
			Devices:                  devicesRepo,
			PushSender:               pushSender,
			Strava:                   stravaService,
			StravaWebhookVerifyToken: cfg.StravaWebhookVerifyToken,
		}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		logger.Info("cadence-api listening", "port", cfg.Port, "env", cfg.Environment)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server failed", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	logger.Info("shutdown initiated")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "err", err)
		os.Exit(1)
	}
	logger.Info("shutdown complete")
}
