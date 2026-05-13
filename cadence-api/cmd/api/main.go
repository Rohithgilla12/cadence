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
	"github.com/Rohithgilla12/cadence/cadence-api/internal/config"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/dailysum"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/habit"
	cadencehttp "github.com/Rohithgilla12/cadence/cadence-api/internal/http"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
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

	server := &http.Server{
		Addr: fmt.Sprintf(":%d", cfg.Port),
		Handler: cadencehttp.NewRouter(cadencehttp.Deps{
			Pool:           pool,
			Verifier:       verifier,
			Resolver:       resolver,
			Users:          repo,
			Habits:         habitRepo,
			HabitLogs:      habitLogRepo,
			CheckIns:       checkInRepo,
			DailySummaries: dailySumRepo,
			InsightEngine:  insightEngine,
			Insights:       insightRepo,
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
