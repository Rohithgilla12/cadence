import * as SecureStore from 'expo-secure-store';

import { endpoints } from '@/lib/api';
import type { DailySummaryUpload } from '@/lib/api';
import { apiClient } from '@/lib/client';

// Imports through the _native indirection so this file works unchanged on
// both platforms — _native.ts resolves to appleHealth on iOS,
// healthConnect on Android (Metro picks via the .android.ts override).
import { isAvailable, readDailySummary } from './_native';

// Retroactive HealthKit import — the fix for the 14-day cold start.
//
// The correlation engine needs 14+ days of paired data before it'll commit
// to a pattern (PRD §8). A fresh install has zero of that. But the user's
// iPhone has been collecting sleep, HRV, workouts, and steps for months.
// On first launch after granting HealthKit, we read the last N days of
// summaries locally, ship them to the server in one bulk write, and the
// correlation worker can find a real pattern in their actual history
// instead of asking them to wait two weeks.

const KEY_IMPORT_DONE_AT = 'cadence.health_import.done_at';
const KEY_IMPORT_DAYS = 'cadence.health_import.days';

// 30 days back. Comfortably above the 14-day correlation floor with
// headroom for partial coverage (some days will be missing — old watch
// not worn, traveling, etc.). Capped to 90 server-side; sticking well
// inside that ceiling keeps a single onboarding import in one request.
export const DEFAULT_IMPORT_DAYS = 30;

export interface ImportResult {
  read: number; // how many local days produced any data
  uploaded: number; // how many rows the server confirmed
}

export interface ImportProgress {
  read: number;
  total: number;
}

interface ImportOptions {
  daysBack?: number;
  onProgress?: (progress: ImportProgress) => void;
}

// Returns the ISO date for `daysAgo` days before today, in the device's
// local timezone (matches what readDailySummary expects).
function dateNDaysAgo(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(12, 0, 0, 0);
  return d;
}

// Convert the on-device DailySummary shape to the server's bulk upload
// shape. Strips workouts (server doesn't store them) and pulls stage
// minutes from the nested sleepStages object up to the flat fields.
function toUpload(summary: {
  date: string;
  sleepHours?: number;
  sleepStages?: { deepMinutes: number; remMinutes: number; coreMinutes: number };
  steps?: number;
  distanceMeters?: number;
  activeEnergyKcal?: number;
  restingHeartRate?: number;
  hrvMs?: number;
}): DailySummaryUpload & { date: string } {
  return {
    date: summary.date,
    sleepHours: summary.sleepHours,
    sleepDeepMinutes: summary.sleepStages?.deepMinutes,
    sleepRemMinutes: summary.sleepStages?.remMinutes,
    sleepCoreMinutes: summary.sleepStages?.coreMinutes,
    steps: summary.steps,
    distanceMeters: summary.distanceMeters,
    activeEnergyKcal: summary.activeEnergyKcal,
    restingHeartRate: summary.restingHeartRate,
    hrvMs: summary.hrvMs,
    source: 'apple_health',
  };
}

// Returns true if at least one measurement field has data. We skip
// fully-empty days so the bulk payload (and the server validation pass)
// stay lean — a phone in a drawer for a week contributes nothing.
function hasAnyData(upload: DailySummaryUpload): boolean {
  return (
    upload.sleepHours != null ||
    upload.steps != null ||
    upload.distanceMeters != null ||
    upload.activeEnergyKcal != null ||
    upload.restingHeartRate != null ||
    upload.hrvMs != null
  );
}

// importHistoricalHealth reads the last `daysBack` days of HealthKit
// summaries and bulk-uploads them. Idempotent at the SecureStore layer:
// once a successful import lands, hasCompleted() returns true and the
// onboarding screen won't re-trigger it. The server upsert is itself
// idempotent (same COALESCE semantics as the per-day PUT), so a
// re-import after a manual clear is also safe.
export async function importHistoricalHealth(options: ImportOptions = {}): Promise<ImportResult> {
  const { daysBack = DEFAULT_IMPORT_DAYS, onProgress } = options;
  if (!isAvailable()) {
    return { read: 0, uploaded: 0 };
  }

  const total = daysBack;
  const uploads: Array<DailySummaryUpload & { date: string }> = [];
  for (let i = 1; i <= daysBack; i++) {
    const date = dateNDaysAgo(i);
    try {
      const summary = await readDailySummary(date);
      const upload = toUpload(summary);
      if (hasAnyData(upload)) {
        uploads.push(upload);
      }
    } catch {
      // Skip days the HealthKit read fails on — a single bad day shouldn't
      // abort the whole import.
    }
    onProgress?.({ read: i, total });
  }

  if (uploads.length === 0) {
    await markCompleted(0);
    return { read: 0, uploaded: 0 };
  }

  const uploaded = await endpoints.bulkPutDailySummaries(apiClient)(uploads);
  await markCompleted(uploads.length);
  return { read: uploads.length, uploaded };
}

async function markCompleted(daysWritten: number): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY_IMPORT_DONE_AT, new Date().toISOString());
    await SecureStore.setItemAsync(KEY_IMPORT_DAYS, String(daysWritten));
  } catch {
    // Best-effort. If the SecureStore write fails, the import still ran;
    // worst case we re-import on next onboarding (server upsert no-ops).
  }
}

// hasCompleted is the cheap check the onboarding screen calls before
// kicking off a fresh import — avoids the 30-day HealthKit read on every
// relaunch.
export async function hasCompleted(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY_IMPORT_DONE_AT)) != null;
  } catch {
    return false;
  }
}

// clearCompletion drops the SecureStore flag — used by delete-account so
// a subsequent re-install reimports cleanly.
export async function clearCompletion(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_IMPORT_DONE_AT);
    await SecureStore.deleteItemAsync(KEY_IMPORT_DAYS);
  } catch {
    // Best-effort.
  }
}
