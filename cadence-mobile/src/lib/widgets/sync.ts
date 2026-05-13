import { Platform } from 'react-native';

import { WidgetBridge } from 'widget-bridge';

import type { Habit, Insight } from '@/types';
import {
  WIDGET_APP_GROUP,
  WIDGET_SNAPSHOT_KEY,
  type WidgetDayDot,
  type WidgetHabitSummary,
  type WidgetInsightSnapshot,
  type WidgetSnapshot,
} from './types';

// Build a Mon-Sun strip for the current calendar week. Until per-day
// completion data is wired up server-side we render past days as
// 'past-quiet' — honest, doesn't fabricate. Today is highlighted; future
// days are dimmed. The shape matches the in-app WeekStrip exactly so the
// widget and the app feel like the same surface.
export function buildWeekDots(reference: Date = new Date()): WidgetDayDot[] {
  const dow = reference.getDay(); // 0=Sun..6=Sat
  const todayIndex = (dow + 6) % 7; // 0=Mon..6=Sun
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return letters.map((weekday, index) => ({
    weekday,
    state:
      index < todayIndex ? 'past-quiet' : index === todayIndex ? 'today' : 'future',
  }));
}

function toInsightSnapshot(insight: Insight): WidgetInsightSnapshot {
  if (insight.kind === 'listening') {
    return {
      kind: 'listening',
      renderedText: 'Cadence is listening.',
    };
  }
  return {
    kind: 'pattern',
    renderedText: insight.renderedText,
  };
}

function toHabitSummaries(habits: ReadonlyArray<Habit>): WidgetHabitSummary[] {
  // Show not-done first so the widget surfaces what's still open; ties
  // are stable in source order. Cap to a generous 8 — the widgets only
  // show the first 4 but keeping a few extra helps if the user
  // reconfigures later.
  return habits
    .map((habit) => ({ id: habit.id, name: habit.name, doneToday: habit.doneToday }))
    .sort((a, b) => Number(a.doneToday) - Number(b.doneToday))
    .slice(0, 8);
}

export interface SyncWidgetInput {
  habits: ReadonlyArray<Habit>;
  insight: Insight;
  weekDots?: WidgetDayDot[];
}

// Build the snapshot the widgets render against. Pure so tests can lean
// on it without touching the native bridge.
export function buildSnapshot(input: SyncWidgetInput): WidgetSnapshot {
  const totalCount = input.habits.length;
  const doneCount = input.habits.filter((h) => h.doneToday).length;
  return {
    updatedAt: new Date().toISOString(),
    doneCount,
    totalCount,
    weekDots: input.weekDots ?? buildWeekDots(),
    habits: toHabitSummaries(input.habits),
    insight: toInsightSnapshot(input.insight),
  };
}

// Hash the parts that matter for redraw so re-renders don't pummel the
// WidgetKit reload API. The Swift side reads the JSON each refresh, so
// identical JSON means no work — but we still want to skip the native
// round-trip when nothing changed.
function snapshotFingerprint(snapshot: WidgetSnapshot): string {
  const habits = snapshot.habits
    .map((h) => `${h.id}:${h.doneToday ? '1' : '0'}:${h.name}`)
    .join('|');
  const dots = snapshot.weekDots.map((d) => `${d.weekday}:${d.state}`).join('|');
  return [
    snapshot.doneCount,
    snapshot.totalCount,
    snapshot.insight.kind,
    snapshot.insight.renderedText,
    dots,
    habits,
  ].join('//');
}

let lastFingerprint: string | null = null;

export function syncWidgetData(input: SyncWidgetInput): void {
  if (Platform.OS !== 'ios') return;
  const snapshot = buildSnapshot(input);
  const fingerprint = snapshotFingerprint(snapshot);
  if (fingerprint === lastFingerprint) return;
  lastFingerprint = fingerprint;
  WidgetBridge.setSnapshot(
    WIDGET_APP_GROUP,
    WIDGET_SNAPSHOT_KEY,
    JSON.stringify(snapshot),
  );
}

export function clearWidgetData(): void {
  if (Platform.OS !== 'ios') return;
  lastFingerprint = null;
  WidgetBridge.clearSnapshot(WIDGET_APP_GROUP, WIDGET_SNAPSHOT_KEY);
}
