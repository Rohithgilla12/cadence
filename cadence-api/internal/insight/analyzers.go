package insight

import (
	"time"
)

// AnalysisResult is what a pattern analyser returns for a single
// (habit, context) pair. Threshold gating happens in the engine — the
// analyser just reports what it computed.
type AnalysisResult struct {
	PatternType    string
	EffectSize     float64
	PValue         float64
	SampleSize     int
	TemplateID     TemplateID
	TemplateParams map[string]any
	RenderedText   string
}

// Analyzer is the interface every pattern implementation conforms to.
// Returning ok=false means the analyser had nothing useful to say —
// not enough paired data, missing covariates, etc.
type Analyzer interface {
	Run(habit habitInfo, rows []dailyRow) (AnalysisResult, bool)
}

// registeredAnalyzers is the engine's working set. Order doesn't matter —
// each pattern produces its own insight row keyed by pattern_type.
var registeredAnalyzers = []Analyzer{
	sleepCompletionAnalyzer{},
	dayOfWeekAnalyzer{},
	hrvCompletionAnalyzer{},
}

// habitVerbFor maps a habit's icon to the verb used in insight copy. Icon
// is more stable than the user-typed name and stays in our control via the
// IconPicker. Falls back to "" when unknown — the engine drops insights
// without a verb rather than fabricating awkward copy ("you do_it 2.3× ...").
func habitVerbFor(h habitInfo) string {
	switch h.icon {
	case "run":
		return "run"
	case "shoe":
		return "walk"
	case "bike":
		return "cycle"
	case "stretching":
		return "stretch"
	case "yoga":
		return "do yoga"
	case "swim":
		return "swim"
	case "book":
		return "read"
	case "moon":
		return "wind down"
	case "sun":
		return "wake early"
	case "heart":
		return "meditate"
	case "sparkles":
		return ""
	default:
		return ""
	}
}

// ---------------------------------------------------------------------------
// Sleep × completion (PRD §8 example)
// ---------------------------------------------------------------------------

type sleepCompletionAnalyzer struct{}

func (sleepCompletionAnalyzer) Run(h habitInfo, rows []dailyRow) (AnalysisResult, bool) {
	verb := habitVerbFor(h)
	if verb == "" {
		return AnalysisResult{}, false
	}
	// Pair each day's sleep hours with that day's completion.
	type pair struct {
		sleepHours float64
		completed  bool
	}
	pairs := make([]pair, 0, len(rows))
	for _, r := range rows {
		if r.sleepHours == nil {
			continue
		}
		pairs = append(pairs, pair{sleepHours: *r.sleepHours, completed: r.completed})
	}
	if len(pairs) < MinSampleSize {
		return AnalysisResult{}, false
	}
	// Bucket sleep into quartiles, then build a 2x2 by collapsing into
	// "lower half" / "upper half" of sleep × done / not. Quartile-level 4x2
	// is also valid (and more sensitive) — start with the simpler split.
	hours := make([]float64, len(pairs))
	for i, p := range pairs {
		hours[i] = p.sleepHours
	}
	var lowDone, lowNot, highDone, highNot int
	for _, p := range pairs {
		bucket, ok := QuartileBucket(p.sleepHours, hours)
		if !ok {
			return AnalysisResult{}, false
		}
		highHalf := bucket >= 2
		switch {
		case highHalf && p.completed:
			highDone++
		case highHalf && !p.completed:
			highNot++
		case !highHalf && p.completed:
			lowDone++
		default:
			lowNot++
		}
	}
	table := [][]int{
		{lowDone, lowNot},
		{highDone, highNot},
	}
	_, pValue, cramersV, ok := ChiSquareCramersV(table)
	if !ok {
		return AnalysisResult{}, false
	}

	// Effect direction: ratio of completion rates between halves. Only
	// surface the "more sleep helps" framing — that's the readable lever.
	// If less sleep is associated with more completion the rendered template
	// flips would feel surveillance-y; per PRD voice we drop it and let
	// other analyses speak.
	highRate := safeRate(highDone, highDone+highNot)
	lowRate := safeRate(lowDone, lowDone+lowNot)
	if highRate <= lowRate || lowRate == 0 {
		return AnalysisResult{
			PatternType: "sleep_x_completion",
			EffectSize:  cramersV,
			PValue:      pValue,
			SampleSize:  len(pairs),
		}, true
	}
	ratio := highRate / lowRate
	// Median of the upper half is a decent threshold to anchor the copy
	// ("nights over Xh") — pick the 50th percentile of all pairs.
	threshold := medianFloat(hours)
	params := map[string]any{
		"habit_verb":      verb,
		"ratio":           ratio,
		"threshold_hours": threshold,
	}
	templateID := TemplateSleepCompletionMild
	if StrengthFor(cramersV) == StrengthStrong {
		templateID = TemplateSleepCompletionStrong
	}
	rendered, ok := Render(templateID, params)
	if !ok {
		return AnalysisResult{}, false
	}
	return AnalysisResult{
		PatternType:    "sleep_x_completion",
		EffectSize:     cramersV,
		PValue:         pValue,
		SampleSize:     len(pairs),
		TemplateID:     templateID,
		TemplateParams: params,
		RenderedText:   rendered,
	}, true
}

// ---------------------------------------------------------------------------
// Day-of-week × completion
// ---------------------------------------------------------------------------

type dayOfWeekAnalyzer struct{}

func (dayOfWeekAnalyzer) Run(h habitInfo, rows []dailyRow) (AnalysisResult, bool) {
	verb := habitVerbFor(h)
	if verb == "" {
		return AnalysisResult{}, false
	}
	if len(rows) < MinSampleSize {
		return AnalysisResult{}, false
	}
	// Tally done vs not per weekday. Mon=0..Sun=6 to match the runner-week
	// convention used elsewhere.
	type cell struct{ done, total int }
	cells := make(map[int]*cell)
	for _, r := range rows {
		idx := (int(r.date.Weekday()) + 6) % 7
		c, ok := cells[idx]
		if !ok {
			c = &cell{}
			cells[idx] = c
		}
		c.total++
		if r.completed {
			c.done++
		}
	}
	if len(cells) < 4 {
		return AnalysisResult{}, false
	}
	// 7x2 contingency for the chi-square test. Skip any weekday with < 2
	// observations — too sparse to inform the table meaningfully.
	table := make([][]int, 0, len(cells))
	for i := 0; i < 7; i++ {
		c, ok := cells[i]
		if !ok || c.total < 2 {
			continue
		}
		table = append(table, []int{c.done, c.total - c.done})
	}
	_, pValue, cramersV, ok := ChiSquareCramersV(table)
	if !ok {
		return AnalysisResult{}, false
	}

	// Find best/worst weekday by completion rate, requiring at least 3
	// observations on each to avoid celebrating a one-off.
	bestIdx, worstIdx := -1, -1
	var bestRate, worstRate float64 = -1, 2
	for i := 0; i < 7; i++ {
		c, ok := cells[i]
		if !ok || c.total < 3 {
			continue
		}
		rate := safeRate(c.done, c.total)
		if rate > bestRate {
			bestRate, bestIdx = rate, i
		}
		if rate < worstRate {
			worstRate, worstIdx = rate, i
		}
	}
	if bestIdx == -1 || worstIdx == -1 || bestIdx == worstIdx {
		return AnalysisResult{
			PatternType: "day_of_week_x_completion",
			EffectSize:  cramersV,
			PValue:      pValue,
			SampleSize:  len(rows),
		}, true
	}
	weekdayNames := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}
	params := map[string]any{
		"habit_verb": verb,
		"best_day":   weekdayNames[bestIdx],
		"best_rate":  bestRate,
		"worst_day":  weekdayNames[worstIdx],
		"worst_rate": worstRate,
	}
	rendered, ok := Render(TemplateDayOfWeekCompletion, params)
	if !ok {
		return AnalysisResult{}, false
	}
	return AnalysisResult{
		PatternType:    "day_of_week_x_completion",
		EffectSize:     cramersV,
		PValue:         pValue,
		SampleSize:     len(rows),
		TemplateID:     TemplateDayOfWeekCompletion,
		TemplateParams: params,
		RenderedText:   rendered,
	}, true
}

// ---------------------------------------------------------------------------
// HRV × completion
// ---------------------------------------------------------------------------

type hrvCompletionAnalyzer struct{}

func (hrvCompletionAnalyzer) Run(h habitInfo, rows []dailyRow) (AnalysisResult, bool) {
	verb := habitVerbFor(h)
	if verb == "" {
		return AnalysisResult{}, false
	}
	type pair struct {
		hrv       float64
		completed bool
	}
	pairs := make([]pair, 0, len(rows))
	for _, r := range rows {
		if r.hrvMs == nil {
			continue
		}
		pairs = append(pairs, pair{hrv: float64(*r.hrvMs), completed: r.completed})
	}
	if len(pairs) < MinSampleSize {
		return AnalysisResult{}, false
	}
	values := make([]float64, len(pairs))
	for i, p := range pairs {
		values[i] = p.hrv
	}
	var lowDone, lowNot, highDone, highNot int
	for _, p := range pairs {
		bucket, ok := QuartileBucket(p.hrv, values)
		if !ok {
			return AnalysisResult{}, false
		}
		highHalf := bucket >= 2
		switch {
		case highHalf && p.completed:
			highDone++
		case highHalf && !p.completed:
			highNot++
		case !highHalf && p.completed:
			lowDone++
		default:
			lowNot++
		}
	}
	table := [][]int{
		{lowDone, lowNot},
		{highDone, highNot},
	}
	_, pValue, cramersV, ok := ChiSquareCramersV(table)
	if !ok {
		return AnalysisResult{}, false
	}
	highRate := safeRate(highDone, highDone+highNot)
	lowRate := safeRate(lowDone, lowDone+lowNot)
	if highRate <= lowRate || lowRate == 0 || StrengthFor(cramersV) != StrengthStrong {
		// Only surface strong HRV patterns — mild HRV correlations are easy
		// to over-interpret and the copy ("recovery shows up...") only earns
		// its keep when the signal is clear.
		return AnalysisResult{
			PatternType: "hrv_x_completion",
			EffectSize:  cramersV,
			PValue:      pValue,
			SampleSize:  len(pairs),
		}, true
	}
	ratio := highRate / lowRate
	params := map[string]any{"habit_verb": verb, "ratio": ratio}
	rendered, ok := Render(TemplateHRVCompletionStrong, params)
	if !ok {
		return AnalysisResult{}, false
	}
	return AnalysisResult{
		PatternType:    "hrv_x_completion",
		EffectSize:     cramersV,
		PValue:         pValue,
		SampleSize:     len(pairs),
		TemplateID:     TemplateHRVCompletionStrong,
		TemplateParams: params,
		RenderedText:   rendered,
	}, true
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func safeRate(numerator, denominator int) float64 {
	if denominator == 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}

func medianFloat(xs []float64) float64 {
	if len(xs) == 0 {
		return 0
	}
	sorted := make([]float64, len(xs))
	copy(sorted, xs)
	// Cheap insertion sort would be fine for our sizes, but the stdlib does
	// it more compactly.
	sortFloats(sorted)
	mid := len(sorted) / 2
	if len(sorted)%2 == 1 {
		return sorted[mid]
	}
	return (sorted[mid-1] + sorted[mid]) / 2
}

func sortFloats(xs []float64) {
	for i := 1; i < len(xs); i++ {
		v := xs[i]
		j := i
		for j > 0 && xs[j-1] > v {
			xs[j] = xs[j-1]
			j--
		}
		xs[j] = v
	}
}

// Suppress unused imports if any are added back later.
var _ = time.Now
