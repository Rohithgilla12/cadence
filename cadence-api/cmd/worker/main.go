// cmd/worker is the background process that runs the correlation engine on
// a schedule. Per PRD §17 Phase 3 it's a separate binary from cmd/api so it
// can be sized, restarted, and oncall'd independently. For now both share
// the same Postgres pool via the database URL env var.
package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Rohithgilla12/cadence/cadence-api/internal/config"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/db"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/insight"
	"github.com/Rohithgilla12/cadence/cadence-api/internal/notify"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/robfig/cron/v3"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// Dev affordance: `./worker -once` runs one pass for every user and exits.
	// In production the binary starts cron and stays up. CRON_SPEC overrides
	// the default schedule (3 AM UTC nightly, behind Cadence's overnight
	// quiet window so heavy DB work happens when no one is using the app).
	var runOnce bool
	flag.BoolVar(&runOnce, "once", false, "run one pass for every user and exit")
	flag.Parse()

	cfg := config.MustLoad()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("db pool", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	engine := insight.NewEngine(pool, insight.NewRepository(pool))
	notifyRepo := notify.NewRepository(pool)
	pushSender, err := notify.NewSender(ctx, notifyRepo, "")
	if err != nil {
		// Sender setup failing is recoverable — we still want correlations
		// to run, just without the surface push at the end.
		logger.Error("push sender init failed; correlations only", "err", err)
		pushSender = nil
	}

	if runOnce {
		if err := computeAll(ctx, pool, engine, pushSender, logger); err != nil {
			logger.Error("once pass failed", "err", err)
			os.Exit(1)
		}
		return
	}

	spec := os.Getenv("CRON_SPEC")
	if spec == "" {
		spec = "0 3 * * *" // 3 AM UTC nightly
	}
	c := cron.New(cron.WithLogger(cron.PrintfLogger(slogPrintf{logger})))
	if _, err := c.AddFunc(spec, func() {
		runCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		if err := computeAll(runCtx, pool, engine, pushSender, logger); err != nil {
			logger.Error("nightly pass failed", "err", err)
		}
	}); err != nil {
		logger.Error("schedule pass", "err", err, "spec", spec)
		os.Exit(1)
	}
	c.Start()
	logger.Info("cadence-worker scheduled", "spec", spec)

	<-ctx.Done()
	stopCtx := c.Stop()
	select {
	case <-stopCtx.Done():
	case <-time.After(5 * time.Second):
		logger.Warn("cron stop timed out")
	}
}

func computeAll(ctx context.Context, pool *pgxpool.Pool, engine *insight.Engine, pushSender *notify.Sender, logger *slog.Logger) error {
	rows, err := pool.Query(ctx, `SELECT id FROM users WHERE deleted_at IS NULL`)
	if err != nil {
		return err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	start := time.Now()
	totalSurfaced := 0
	firstSurfaceNotifs := 0
	for _, id := range ids {
		// Count pre-existing insights so we can distinguish "user just got
		// their first pattern ever" from "ongoing recompute." Failing here
		// shouldn't block correlation — we just skip the notification.
		preCount := -1
		if pushSender != nil {
			if n, err := countInsightsForUser(ctx, pool, id); err == nil {
				preCount = n
			}
		}
		surfaced, err := engine.ComputeForUser(ctx, id)
		if err != nil {
			// One user's failure shouldn't stop the rest of the run.
			logger.Error("compute for user failed", "user_id", id, "err", err)
			continue
		}
		totalSurfaced += surfaced

		// PRD §6 voice: notify only when we have something genuinely new
		// to say. "Your first pattern surfaced" is exactly that moment;
		// re-confirmations on subsequent nights are not. Capping at the
		// 0→N transition keeps the notification quiet by default.
		if pushSender != nil && preCount == 0 && surfaced > 0 {
			notifyCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			if _, _, sendErr := pushSender.SendCategorized(notifyCtx, id, notify.CategoryInsightSurfaced, nil); sendErr != nil {
				logger.Warn("insight-surfaced push failed", "user_id", id, "err", sendErr)
			} else {
				firstSurfaceNotifs++
			}
			cancel()
		}
	}
	logger.Info("compute pass complete",
		"users", len(ids),
		"insights_upserted", totalSurfaced,
		"first_surface_pushes", firstSurfaceNotifs,
		"elapsed", time.Since(start).String(),
	)
	return nil
}

func countInsightsForUser(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int, error) {
	var n int
	err := pool.QueryRow(ctx, `SELECT count(*) FROM insights WHERE user_id = $1`, userID).Scan(&n)
	return n, err
}

// slogPrintf bridges cron's Printf-style logger interface to slog. Avoids a
// dependency on go-logr just for this one shim.
type slogPrintf struct{ l *slog.Logger }

func (s slogPrintf) Printf(format string, args ...any) {
	s.l.Info("cron", "msg", format, "args", args)
}
