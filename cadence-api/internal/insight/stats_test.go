package insight

import (
	"math"
	"testing"
)

func TestRanks_HandlesTiesWithAverageRank(t *testing.T) {
	got := ranks([]float64{1, 2, 2, 3})
	want := []float64{1, 2.5, 2.5, 4}
	for i := range got {
		if math.Abs(got[i]-want[i]) > 1e-9 {
			t.Fatalf("ranks[%d] = %v want %v", i, got[i], want[i])
		}
	}
}

func TestSpearman_PerfectMonotonicGivesRhoOne(t *testing.T) {
	xs := []float64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	ys := []float64{2, 4, 6, 8, 10, 12, 14, 16, 18, 20}
	rho, p, ok := SpearmanCorrelation(xs, ys)
	if !ok || math.Abs(rho-1) > 1e-9 || p > 0.01 {
		t.Fatalf("rho=%v p=%v ok=%v", rho, p, ok)
	}
}

func TestSpearman_PerfectAntiCorrelationGivesRhoMinusOne(t *testing.T) {
	xs := []float64{1, 2, 3, 4, 5, 6}
	ys := []float64{6, 5, 4, 3, 2, 1}
	rho, p, ok := SpearmanCorrelation(xs, ys)
	if !ok || math.Abs(rho-(-1)) > 1e-9 || p > 0.01 {
		t.Fatalf("rho=%v p=%v ok=%v", rho, p, ok)
	}
}

func TestSpearman_FlatModularRelationGivesNearZeroRho(t *testing.T) {
	// y cycles through {0,1,2} as x increases — no monotonic trend, so
	// Spearman ρ should sit near zero and p should be far above the gate.
	xs := make([]float64, 18)
	ys := make([]float64, 18)
	for i := range xs {
		xs[i] = float64(i + 1)
		ys[i] = float64(i % 3)
	}
	rho, p, ok := SpearmanCorrelation(xs, ys)
	if !ok {
		t.Fatalf("ok=false")
	}
	if math.Abs(rho) > 0.2 {
		t.Fatalf("expected near-zero ρ, got %v", rho)
	}
	if p < MaxPValue {
		t.Fatalf("expected non-significant p, got %v", p)
	}
}

func TestSpearman_TooFewSamplesReturnsNotOK(t *testing.T) {
	_, _, ok := SpearmanCorrelation([]float64{1, 2}, []float64{2, 3})
	if ok {
		t.Fatalf("expected ok=false for n=2")
	}
}

func TestChiSquare_StrongDependenceProducesLargeCramersV(t *testing.T) {
	// Strong association: low sleep → not-done, high sleep → done.
	// Real-world example we'd hope to detect.
	table := [][]int{
		// done, not-done
		{1, 10}, // low-sleep quartile
		{2, 9},  // low-mid
		{8, 3},  // high-mid
		{10, 1}, // high
	}
	chi, p, v, ok := ChiSquareCramersV(table)
	if !ok {
		t.Fatalf("ok=false")
	}
	if chi <= 0 || p > 0.001 || v < 0.4 {
		t.Fatalf("chi=%v p=%v v=%v (expected strong signal)", chi, p, v)
	}
}

func TestChiSquare_IndependentTableProducesSmallV(t *testing.T) {
	// All cells proportional — no dependence.
	table := [][]int{
		{10, 10},
		{10, 10},
	}
	chi, p, v, ok := ChiSquareCramersV(table)
	if !ok {
		t.Fatalf("ok=false")
	}
	if chi > 0.5 || p < 0.5 || v > 0.1 {
		t.Fatalf("chi=%v p=%v v=%v (expected null pattern)", chi, p, v)
	}
}

func TestChiSquare_RejectsDegenerate(t *testing.T) {
	cases := [][][]int{
		nil,
		{{1, 2}},
		{{1}, {2}},
		{{0, 0}, {0, 0}},
		{{1, 2}, {3}}, // ragged
	}
	for i, tc := range cases {
		_, _, _, ok := ChiSquareCramersV(tc)
		if ok {
			t.Fatalf("case %d: expected ok=false", i)
		}
	}
}

func TestQuartileBucket_PlacesValuesInExpectedQuartiles(t *testing.T) {
	values := []float64{1, 2, 3, 4, 5, 6, 7, 8}
	cases := []struct {
		x      float64
		bucket int
	}{
		{1.0, 0},
		{2.5, 1},
		{4.5, 2},
		{7.0, 3},
		{99.0, 3},
	}
	for _, tc := range cases {
		got, ok := QuartileBucket(tc.x, values)
		if !ok {
			t.Fatalf("x=%v ok=false", tc.x)
		}
		if got != tc.bucket {
			t.Fatalf("x=%v bucket=%d want %d", tc.x, got, tc.bucket)
		}
	}
}

func TestQuartileBucket_TooFewValuesReturnsNotOK(t *testing.T) {
	_, ok := QuartileBucket(2, []float64{1, 2, 3})
	if ok {
		t.Fatalf("expected ok=false for n=3")
	}
}
