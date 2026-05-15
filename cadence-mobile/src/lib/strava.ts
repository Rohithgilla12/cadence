import * as WebBrowser from 'expo-web-browser';

import { endpoints } from '@/lib/api';
import { apiClient } from '@/lib/client';

// Deep-link scheme the server's callback handler redirects to once
// the OAuth dance completes. app.config registers `cadence://` as
// our universal handler; openAuthSessionAsync watches for any URL
// with this scheme and auto-dismisses the in-app Safari sheet as
// soon as it sees one. See internal/http/strava.go callback() for
// the matching server side.
const RETURN_URL = 'cadence://strava/connected';

// connectFlow drives the full Strava OAuth round-trip from a single
// user tap. Asks the server for an authorize URL (server attaches a
// fresh CSRF state token), opens it in an in-app Safari auth sheet,
// and resolves once the server-side callback redirects back to the
// cadence:// scheme.
//
// Why WebBrowser.openAuthSessionAsync rather than Linking.openURL:
// the auth-session API gives us a system-level promise that resolves
// when the user returns, which makes UX cleaner (refetch status the
// instant we know the round-trip ended) and matches the pattern Sign
// in with Apple uses. Requires the expo-web-browser native module in
// the binary — added in the same build that includes this code.
//
// Returns one of:
//   { kind: 'connected' } — user authorized and the server stored tokens
//   { kind: 'cancelled' } — user dismissed the sheet without authorizing
//   { kind: 'failed', reason } — server-side error during the callback
//
// Caller should refetch /v1/me/strava/status on 'connected' to update
// the UI. The server is the only source of truth — the cadence://
// redirect is just a "you're done, ask again" signal.
export type ConnectResult =
  | { kind: 'connected' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; reason: string };

export async function connectFlow(): Promise<ConnectResult> {
  let authorizeUrl: string;
  try {
    authorizeUrl = await endpoints.stravaConnect(apiClient)();
  } catch (err) {
    return {
      kind: 'failed',
      reason: err instanceof Error ? err.message : 'Could not start OAuth',
    };
  }

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, RETURN_URL, {
    // Safari's auth-session UI doesn't leak browsing data into the
    // user's regular Safari profile and dismisses automatically the
    // moment the server redirects back to cadence://.
    showInRecents: false,
  });

  if (result.type === 'success' && result.url) {
    // Server's callback can come back via cadence://strava/connected
    // OR cadence://strava/error?reason=... — disambiguate on the path.
    if (result.url.startsWith('cadence://strava/connected')) {
      return { kind: 'connected' };
    }
    if (result.url.startsWith('cadence://strava/error')) {
      // Parse the query string via URL — the cadence:// scheme isn't
      // a valid http URL constructor input on every JS engine, so
      // we rewrite it to localhost for parsing then read the param.
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

// disconnectFlow is a thin server-side passthrough. PRD §9: encrypted
// tokens are deleted locally and Strava-side deauthorize is fired
// best-effort on the way out.
export async function disconnectFlow(): Promise<void> {
  await endpoints.stravaDisconnect(apiClient)();
}
