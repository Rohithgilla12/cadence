import type { ApiHeatmapDay } from '@/lib/api/types';
import type { DayDot, DayState } from '@/types';

// Single-letter weekday labels in Monday-first order, matching PRD §3
// (Cadence's weeks start on Monday). The doubled "T"/"S" pair is the
// English-locale convention.
const LETTERS_MONDAY_FIRST = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

// Returns the Date for Monday of the week containing `reference`. Uses
// the local timezone so "this week" matches what the user sees on
// their calendar, not what UTC says.
function startOfMondayWeek(reference: Date): Date {
  const d = new Date(reference);
  d.setHours(0, 0, 0, 0);
  // JS getDay: 0=Sun, 1=Mon..6=Sat. Map to Mon=0..Sun=6.
  const mondayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayIndex);
  return d;
}

function toIsoLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// buildWeekDays renders the Mon..Sun strip for the week containing
// `today`, marking each past day as 'past-done' when the heatmap shows
// at least one completed habit on that date, 'past-quiet' otherwise.
// Future days are dim, today is highlighted. Missing heatmap entries
// for a past date are treated as quiet — we don't fabricate completion.
export function buildWeekDays(
  today: Date,
  heatmapDays?: ReadonlyArray<ApiHeatmapDay>,
): DayDot[] {
  const monday = startOfMondayWeek(today);
  const todayIso = toIsoLocalDate(today);
  // Index for O(1) lookups; heatmap can include weeks outside this
  // window, so we pluck just what we need.
  const completedByDate = new Map<string, number>();
  for (const day of heatmapDays ?? []) {
    completedByDate.set(day.date, day.completedLogs);
  }

  const out: DayDot[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const iso = toIsoLocalDate(date);

    let state: DayState;
    if (iso === todayIso) {
      state = 'today';
    } else if (iso < todayIso) {
      const completed = completedByDate.get(iso) ?? 0;
      state = completed > 0 ? 'past-done' : 'past-quiet';
    } else {
      state = 'future';
    }

    out.push({
      date: iso,
      weekday: LETTERS_MONDAY_FIRST[i],
      state,
    });
  }
  return out;
}
