import * as SecureStore from 'expo-secure-store';

// Client-only user settings — values that personalize calculations but don't
// need to round-trip through the server. Stored via expo-secure-store so they
// survive uninstall+reinstall on iCloud-restored devices. Keys are
// namespaced ('cadence.*') to dodge collisions with other apps sharing the
// keychain partition.

const KEY_MAX_HR = 'cadence.max_hr';

// Apple's default max-HR estimate for adults if the user hasn't set one.
// Used as a fallback by HR-zone calculations.
export const DEFAULT_MAX_HR = 190;

export async function getMaxHr(): Promise<number | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY_MAX_HR);
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
  } catch {
    return null;
  }
}

export async function setMaxHr(value: number): Promise<void> {
  if (!Number.isFinite(value) || value < 80 || value > 230) {
    throw new Error('Max heart rate must be between 80 and 230 bpm');
  }
  await SecureStore.setItemAsync(KEY_MAX_HR, String(Math.round(value)));
}

export async function clearMaxHr(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY_MAX_HR);
  } catch {
    // Best-effort — if the key was never set there's nothing to clear.
  }
}
