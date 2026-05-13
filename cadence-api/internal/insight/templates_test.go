package insight

import "testing"

func TestRender_SleepStrongMatchesPRDExample(t *testing.T) {
	got, ok := Render(TemplateSleepCompletionStrong, map[string]any{
		"habit_verb":      "run",
		"ratio":           2.3,
		"threshold_hours": 7.0,
	})
	want := "You run 2.3× more often after nights over 7h sleep. Sleep is your single biggest lever."
	if !ok || got != want {
		t.Fatalf("got %q want %q ok=%v", got, want, ok)
	}
}

func TestRender_TrimsTrailingZeroes(t *testing.T) {
	got, ok := Render(TemplateSleepCompletionStrong, map[string]any{
		"habit_verb":      "meditate",
		"ratio":           2.0,
		"threshold_hours": 7.5,
	})
	want := "You meditate 2× more often after nights over 7.5h sleep. Sleep is your single biggest lever."
	if !ok || got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestRender_DayOfWeek(t *testing.T) {
	got, ok := Render(TemplateDayOfWeekCompletion, map[string]any{
		"habit_verb": "stretch",
		"best_day":   "Tuesday",
		"best_rate":  0.86,
		"worst_day":  "Sunday",
		"worst_rate": 0.32,
	})
	want := "Tuesdays are when you stretch most (86%). Sundays the least (32%)."
	if !ok || got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestRender_MissingParamsReturnsNotOK(t *testing.T) {
	cases := []map[string]any{
		{},                                  // empty
		{"habit_verb": "run"},               // missing ratio + threshold
		{"habit_verb": "run", "ratio": 2.3}, // missing threshold
		{"habit_verb": "", "ratio": 2.3, "threshold_hours": 7.0}, // empty verb
	}
	for i, tc := range cases {
		_, ok := Render(TemplateSleepCompletionStrong, tc)
		if ok {
			t.Fatalf("case %d should have returned ok=false", i)
		}
	}
}

func TestRender_UnknownTemplateReturnsNotOK(t *testing.T) {
	_, ok := Render(TemplateID("not_a_template"), map[string]any{})
	if ok {
		t.Fatalf("expected ok=false for unknown template")
	}
}

func TestStrengthFor_MatchesPRDThresholds(t *testing.T) {
	cases := []struct {
		effect float64
		want   Strength
	}{
		{0.10, StrengthBelowThreshold},
		{0.19, StrengthBelowThreshold},
		{0.20, StrengthMild},
		{0.34, StrengthMild},
		{0.35, StrengthStrong},
		{0.80, StrengthStrong},
	}
	for _, tc := range cases {
		got := StrengthFor(tc.effect)
		if got != tc.want {
			t.Fatalf("effect=%v got=%v want=%v", tc.effect, got, tc.want)
		}
	}
}
