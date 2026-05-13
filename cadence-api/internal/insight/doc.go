// Package insight is Cadence's context-aware analytics engine. Per PRD §8 it
// pairs every habit with each contextual variable (sleep, HRV, mood,
// day-of-week, ...) and tests whether the context predicts completion. The
// engine is deliberately deterministic — no LLM in the loop. Templates are
// reviewed and edited like copy.
//
// Surfacing rules (PRD §8) require ALL of:
//   - sample size ≥ 14 paired days
//   - p-value < 0.05
//   - effect size ≥ 0.20 (Cramér's V or |ρ|)
//
// Below threshold the relationship is stored as a negative finding rather
// than fabricated into something it isn't.
package insight
