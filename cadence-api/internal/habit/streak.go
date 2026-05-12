package habit

import (
	"sort"
	"time"
)

// ComputeStreak counts consecutive completed days going backwards from today
// (or yesterday — today's missing log doesn't break the streak yet). Grace
// days are not honored in Phase 1; that lands with the recovery moment work
// (PRD §17, Phase 6).
func ComputeStreak(completedDates []time.Time, today time.Time) int {
	if len(completedDates) == 0 {
		return 0
	}
	// Normalize to midnight UTC and dedupe to avoid double-counting.
	normalized := make([]time.Time, 0, len(completedDates))
	seen := make(map[time.Time]struct{}, len(completedDates))
	for _, t := range completedDates {
		zero := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
		if _, ok := seen[zero]; ok {
			continue
		}
		seen[zero] = struct{}{}
		normalized = append(normalized, zero)
	}
	sort.Slice(normalized, func(i, j int) bool { return normalized[i].After(normalized[j]) })

	todayZero := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	gap := int(todayZero.Sub(normalized[0]).Hours() / 24)
	// Gap > 1 means the most-recent log is older than yesterday — streak is broken.
	if gap > 1 {
		return 0
	}

	streak := 1
	prev := normalized[0]
	for i := 1; i < len(normalized); i++ {
		dayGap := int(prev.Sub(normalized[i]).Hours() / 24)
		if dayGap == 1 {
			streak++
			prev = normalized[i]
			continue
		}
		break
	}
	return streak
}
