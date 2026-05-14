// Shared listening-state copy. Surfaced by the in-app InsightCard and by
// the iOS widget snapshot — keeping the wording in one place so the
// widget and the app stay verbally aligned.

// listeningCopy returns the empty-state sentence for the "Cadence is
// listening" surface based on how many daily summaries the server has
// for this user. Three regimes:
//   • 0 days     — frame the wait
//   • 1..N-1     — tangible countdown
//   • >= N       — enough data, but no pattern crossed the bar yet
//
// PRD §3 principle 2: we don't fabricate insights. The copy is the
// honest version of "nothing yet" — an ETA, not a promise.
export function listeningCopy(daysOfData: number, minDays: number): string {
  if (daysOfData <= 0) {
    return 'Cadence is listening. About two weeks of mornings until patterns surface.';
  }
  if (daysOfData < minDays) {
    const remaining = Math.max(1, minDays - daysOfData);
    const noun = remaining === 1 ? 'morning' : 'mornings';
    return `About ${remaining} more ${noun} of data and patterns start to surface.`;
  }
  return `${daysOfData} days in — the data isn't quite saying anything yet.`;
}
