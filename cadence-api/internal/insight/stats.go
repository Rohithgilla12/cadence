package insight

import (
	"math"
	"sort"

	"gonum.org/v1/gonum/stat"
	"gonum.org/v1/gonum/stat/distuv"
)

// Threshold constants per PRD §8. Exposed so tests can replay the gate
// logic without re-reading the PRD.
const (
	MinSampleSize    = 14
	MaxPValue        = 0.05
	MinEffectSizeMin = 0.20 // "small/mild" floor — below this we don't surface
	MinEffectSizeMax = 0.35 // "strong" threshold — used for copy emphasis
)

// SpearmanCorrelation returns Spearman's rho and the two-sided p-value
// approximated via Student's t. Suitable for ordinal × continuous pairs
// (mood × sleep_hours, mood × habit completion as 0/1). Returns (0, 1, false)
// if there's no signal to estimate from.
//
// The approximation is the standard one: t = ρ √((n-2)/(1-ρ²)) is
// approximately t-distributed with n-2 df under H₀ : ρ = 0. For tiny samples
// it's optimistic; the 14-day minimum sample gate (PRD §8) keeps us safely
// in the regime where the approximation behaves.
func SpearmanCorrelation(xs, ys []float64) (rho float64, pValue float64, ok bool) {
	if len(xs) != len(ys) || len(xs) < 3 {
		return 0, 1, false
	}
	xr := ranks(xs)
	yr := ranks(ys)
	rho = stat.Correlation(xr, yr, nil)
	if math.IsNaN(rho) {
		return 0, 1, false
	}
	if math.Abs(rho) >= 1-1e-12 {
		// Perfect (anti-)correlation: zero p-value, but the t-approximation
		// blows up. Return a tiny positive p so consumers don't trip on NaN.
		return rho, 1e-12, true
	}
	n := float64(len(xs))
	t := rho * math.Sqrt((n-2)/(1-rho*rho))
	dist := distuv.StudentsT{Mu: 0, Sigma: 1, Nu: n - 2}
	pValue = 2 * dist.Survival(math.Abs(t))
	return rho, pValue, true
}

// ranks returns the average-tied-rank vector for xs. Average-rank handling
// matches the Spearman convention: tied observations receive the average of
// the ranks they would have occupied.
func ranks(xs []float64) []float64 {
	indexed := make([]struct {
		value float64
		index int
	}, len(xs))
	for i, v := range xs {
		indexed[i].value = v
		indexed[i].index = i
	}
	sort.Slice(indexed, func(i, j int) bool { return indexed[i].value < indexed[j].value })

	result := make([]float64, len(xs))
	i := 0
	for i < len(indexed) {
		j := i + 1
		for j < len(indexed) && indexed[j].value == indexed[i].value {
			j++
		}
		// average rank for the tied group (1-indexed): (i+1 + i+2 + ... + j) / (j - i)
		sum := 0
		for k := i; k < j; k++ {
			sum += k + 1
		}
		avg := float64(sum) / float64(j-i)
		for k := i; k < j; k++ {
			result[indexed[k].index] = avg
		}
		i = j
	}
	return result
}

// ChiSquareCramersV runs a chi-square test of independence on a contingency
// table and returns the statistic, two-sided p-value, and Cramér's V effect
// size. The table is rows × columns. Cramér's V is bounded [0, 1]; ~0.20 is
// the PRD's lower surfacing threshold.
//
// Returns ok=false if any row or column total is zero (degenerate table) or
// the table has fewer than 2 rows / 2 columns. Cells with an expected count
// below 5 are still computed but should be interpreted carefully — chi-square
// is a large-sample approximation. PRD §8's minimum 14-day gate keeps us
// near that regime for 2x2 tables; bigger tables need more data.
func ChiSquareCramersV(table [][]int) (chiSq float64, pValue float64, cramersV float64, ok bool) {
	rows := len(table)
	if rows < 2 {
		return 0, 1, 0, false
	}
	cols := len(table[0])
	if cols < 2 {
		return 0, 1, 0, false
	}
	for _, row := range table {
		if len(row) != cols {
			return 0, 1, 0, false
		}
	}
	rowTotals := make([]int, rows)
	colTotals := make([]int, cols)
	grand := 0
	for i, row := range table {
		for j, count := range row {
			if count < 0 {
				return 0, 1, 0, false
			}
			rowTotals[i] += count
			colTotals[j] += count
			grand += count
		}
	}
	if grand == 0 {
		return 0, 1, 0, false
	}
	for _, total := range rowTotals {
		if total == 0 {
			return 0, 1, 0, false
		}
	}
	for _, total := range colTotals {
		if total == 0 {
			return 0, 1, 0, false
		}
	}

	for i, row := range table {
		for j, observed := range row {
			expected := float64(rowTotals[i]) * float64(colTotals[j]) / float64(grand)
			delta := float64(observed) - expected
			chiSq += (delta * delta) / expected
		}
	}
	df := (rows - 1) * (cols - 1)
	pValue = distuv.ChiSquared{K: float64(df)}.Survival(chiSq)

	minDim := rows - 1
	if cols-1 < minDim {
		minDim = cols - 1
	}
	cramersV = math.Sqrt(chiSq / (float64(grand) * float64(minDim)))
	return chiSq, pValue, cramersV, true
}

// QuartileBucket returns the bucket index (0..3) for x within values,
// computed against the empirical quartile cuts of values. Sorts internally;
// pass a copy if the caller needs to preserve order. Used to bucket
// continuous context (sleep hours, HRV, steps) before feeding contingency
// tables to ChiSquareCramersV.
//
// Returns ok=false when len(values) < 4 — quartiles aren't meaningful on
// fewer points.
func QuartileBucket(x float64, values []float64) (bucket int, ok bool) {
	if len(values) < 4 {
		return 0, false
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)
	cuts := [3]float64{
		stat.Quantile(0.25, stat.Empirical, sorted, nil),
		stat.Quantile(0.50, stat.Empirical, sorted, nil),
		stat.Quantile(0.75, stat.Empirical, sorted, nil),
	}
	switch {
	case x < cuts[0]:
		return 0, true
	case x < cuts[1]:
		return 1, true
	case x < cuts[2]:
		return 2, true
	default:
		return 3, true
	}
}
