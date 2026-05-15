import * as WebBrowser from 'expo-web-browser';

import { endpoints } from '@/lib/api';
import { apiClient } from '@/lib/client';

// Deep-link scheme the server redirects to after the OAuth callback. The
// app.config scheme registers `cadence://` as our universal handler;
// openAuthSessionAsync auto-dismisses the WebBrowser sheet as soon as
// it sees a URL with this scheme.
const RETURN_URL = 'cadence://strava/connected';

// connectFlow drives the full OAuth dance from the user's tap. Asks
// the server for an authorize URL (carries a fresh CSRF state), opens
// it in a Safari sheet, and resolves once the server-side callback
// redirects back to the cadence:// scheme.
//
// Returns one of:
//   { kind: 'connected' } — user authorized and the server stored tokens
//   { kind: 'cancelled' } — user dismissed the sheet without authorizing
//   { kind: 'failed', reason } — server-side error during the callback
//
// Callers should refetch /me/strava/status on 'connected' to update
// the UI. We don't try to peek at the underlying token store here —
// the server is the only source of truth and the cadence:// redirect
// is just a "you're done, ask again" signal.
export type ConnectResult =
  | { kind: 'connected' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: string };

export async function connectFlow(): Promise<ConnectResult> {
  const authorizeUrl = await endpoints.stravaConnect(apiClient)();
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, RETURN_URL, {
    // Use Safari's auth-session UI (same one Apple uses for "Sign in
    // with Apple"). Doesn't leak browsing data into the regular
    // Safari profile and dismisses automatically on cadence:// redirect.
    showInRecents: false,
  });

  if (result.type === 'success' && result.url) {
    // Server can come back via cadence://strava/connected OR
    // cadence://strava/error?reason=... — disambiguate on the path.
    if (result.url.startsWith('cadence://strava/connected')) {
      return { kind: 'connected' };
    }
    if (result.url.startsWith('cadence://strava/error')) {
      const reason =
        new URL(result.url.replace('cadence://', 'http://localhost/')).searchParams.get(
          'reason',
        ) ?? 'unknown';
      return { kind: 'failed', reason };
    }
  }
  // 'cancel' | 'dismiss' | 'locked' — user closed the sheet.
  return { kind: 'cancelled' };
}

// disconnectFlow is just a thin wrapper so callers don't import the
// endpoint client directly — keeps the UI side oblivious to where
// Strava state lives.
export async function disconnectFlow(): Promise<void> {
  await endpoints.stravaDisconnect(apiClient)();
}
