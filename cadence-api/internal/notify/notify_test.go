package notify

import (
	"strings"
	"testing"
)

func TestTemplateFor_EveryCategoryHasCopy(t *testing.T) {
	// Defensive — if we add a category and forget to wire its template,
	// the template fallback returns an empty body. That would ship a
	// silent push, which feels glitchy. Lock the requirement here.
	cats := []Category{
		CategoryTest,
		CategoryInsightSurfaced,
		CategoryPactReminder,
		CategoryRecoveryNudge,
	}
	for _, cat := range cats {
		title, body := TemplateFor(cat)
		if strings.TrimSpace(title) == "" {
			t.Errorf("category %q has empty title", cat)
		}
		if strings.TrimSpace(body) == "" {
			t.Errorf("category %q has empty body", cat)
		}
	}
}

func TestTemplateFor_VoiceForbiddenWords(t *testing.T) {
	// PRD §20 voice — guard against the words we said we wouldn't use.
	// Catches a future copy edit that drifts away from the brand.
	banned := []string{"crush", "goal", "streak", "failed", "compete", "awesome"}
	cats := []Category{
		CategoryTest,
		CategoryInsightSurfaced,
		CategoryPactReminder,
		CategoryRecoveryNudge,
	}
	for _, cat := range cats {
		title, body := TemplateFor(cat)
		blob := strings.ToLower(title + " " + body)
		for _, word := range banned {
			if strings.Contains(blob, word) {
				t.Errorf("category %q copy contains banned word %q: %q", cat, word, title+" "+body)
			}
		}
	}
}

func TestDeeplinkFor_ReturnsCadenceScheme(t *testing.T) {
	cats := []Category{
		CategoryTest,
		CategoryInsightSurfaced,
		CategoryPactReminder,
		CategoryRecoveryNudge,
	}
	for _, cat := range cats {
		link := DeeplinkFor(cat)
		if !strings.HasPrefix(link, "cadence://") {
			t.Errorf("category %q deeplink %q does not start with cadence://", cat, link)
		}
	}
}

func TestDeeplinkFor_UnknownFallsBackToRoot(t *testing.T) {
	link := DeeplinkFor("totally-made-up")
	if link != "cadence://" {
		t.Errorf("unknown category should fall back to root, got %q", link)
	}
}
