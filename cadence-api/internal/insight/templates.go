package insight

import (
	"fmt"
	"strings"
)

// Templates per PRD §8. Each template knows how to render a deterministic
// string given a parameter map. Patterns the engine doesn't have a template
// for are dropped — we never fabricate copy. Adding a new analysis means
// adding both an analyser and a template; the registry below is the
// single source of truth that joins the two.

// TemplateID is intentionally a string (not an enum) so it round-trips
// through the insights.template_id text column and stays stable across
// engine refactors.
type TemplateID string

const (
	TemplateSleepCompletionStrong TemplateID = "sleep_x_completion_strong"
	TemplateSleepCompletionMild   TemplateID = "sleep_x_completion_mild"
	TemplateDayOfWeekCompletion   TemplateID = "day_of_week_x_completion"
	TemplateHRVCompletionStrong   TemplateID = "hrv_x_completion_strong"
)

// Render returns the final string for a given template + params. Returns ""
// + ok=false if the template is unknown or required params are missing —
// caller must treat that as "no insight to surface."
func Render(id TemplateID, params map[string]any) (string, bool) {
	switch id {
	case TemplateSleepCompletionStrong:
		verb, _ := params["habit_verb"].(string)
		ratio, _ := params["ratio"].(float64)
		threshold, _ := params["threshold_hours"].(float64)
		if verb == "" || ratio <= 0 || threshold <= 0 {
			return "", false
		}
		return fmt.Sprintf(
			"You %s %s× more often after nights over %sh sleep. Sleep is your single biggest lever.",
			verb, formatRatio(ratio), formatHours(threshold),
		), true

	case TemplateSleepCompletionMild:
		verb, _ := params["habit_verb"].(string)
		ratio, _ := params["ratio"].(float64)
		threshold, _ := params["threshold_hours"].(float64)
		if verb == "" || ratio <= 0 || threshold <= 0 {
			return "", false
		}
		return fmt.Sprintf(
			"On nights over %sh sleep, you %s about %s× as often. A gentle pattern.",
			formatHours(threshold), verb, formatRatio(ratio),
		), true

	case TemplateDayOfWeekCompletion:
		verb, _ := params["habit_verb"].(string)
		bestDay, _ := params["best_day"].(string)
		bestRate, _ := params["best_rate"].(float64)
		worstDay, _ := params["worst_day"].(string)
		worstRate, _ := params["worst_rate"].(float64)
		if verb == "" || bestDay == "" || worstDay == "" {
			return "", false
		}
		return fmt.Sprintf(
			"%ss are when you %s most (%s%%). %ss the least (%s%%).",
			bestDay, verb, formatPercent(bestRate), worstDay, formatPercent(worstRate),
		), true

	case TemplateHRVCompletionStrong:
		verb, _ := params["habit_verb"].(string)
		ratio, _ := params["ratio"].(float64)
		if verb == "" || ratio <= 0 {
			return "", false
		}
		return fmt.Sprintf(
			"You %s %s× more often on higher-HRV days. Your recovery shows up in what you do.",
			verb, formatRatio(ratio),
		), true

	default:
		return "", false
	}
}

// formatRatio renders ratios like 2.3 (no trailing zeroes), 1.0 → "1", 2.5 → "2.5".
func formatRatio(r float64) string {
	// One decimal is the right amount of precision for "you do X 2.3× more often."
	// Strip ".0" so 2.0 renders as "2".
	s := fmt.Sprintf("%.1f", r)
	s = strings.TrimSuffix(s, ".0")
	return s
}

// formatHours renders thresholds like 7, 7.5 — strip ".0" for round numbers.
func formatHours(h float64) string {
	s := fmt.Sprintf("%.1f", h)
	s = strings.TrimSuffix(s, ".0")
	return s
}

// formatPercent renders a 0..1 rate as an integer 0..100 string.
func formatPercent(rate float64) string {
	return fmt.Sprintf("%d", int(rate*100+0.5))
}
