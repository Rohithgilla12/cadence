// Mirrors `targets/cadence-widget/WidgetSnapshot.swift`. The shape is the
// JSON we serialise into the App Group's UserDefaults under
// `WIDGET_SNAPSHOT_KEY` so the widget extension can decode it.
//
// If you change a field on either side, change the other. The Swift side
// is the consumer — a missing field there is a silent placeholder, which
// is fine for forward compatibility but loud-failing is better. Keep them
// in lockstep.

export const WIDGET_APP_GROUP = 'group.fun.gilla.cadence';
export const WIDGET_SNAPSHOT_KEY = 'cadence.snapshot.v1';

export type WidgetDayState = 'past-done' | 'past-quiet' | 'today' | 'future';

export interface WidgetDayDot {
  weekday: string; // single letter M T W T F S S
  state: WidgetDayState;
}

export interface WidgetHabitSummary {
  id: string;
  name: string;
  doneToday: boolean;
}

export type WidgetInsightKind = 'pattern' | 'listening';

export interface WidgetInsightSnapshot {
  kind: WidgetInsightKind;
  renderedText: string;
}

export interface WidgetSnapshot {
  updatedAt: string; // ISO-8601
  doneCount: number;
  totalCount: number;
  weekDots: WidgetDayDot[];
  habits: WidgetHabitSummary[];
  insight: WidgetInsightSnapshot;
}
