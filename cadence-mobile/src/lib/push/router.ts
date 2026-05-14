import * as Notifications from 'expo-notifications';
import type { Router } from 'expo-router';

// Push notification → in-app route mapper. Every push the server sends
// rides with a `category` discriminator and a `deeplink` string in
// data{} (see cadence-api/internal/notify). When the user taps a push,
// we read the deeplink and steer the router. Falls back to the app
// root if anything is malformed — a misrouted tap is preferable to a
// crash deep in the stack.

const SCHEME = 'cadence://';

// Subset of Expo Router paths the push system can target. Server-side
// notify.DeeplinkFor only emits these; anything else is treated as a
// soft no-op (route to '/').
type PushDestination = '/' | '/reflect' | '/circles';

function destinationFor(deeplink: string | undefined): PushDestination | null {
  if (!deeplink) return null;
  if (!deeplink.startsWith(SCHEME)) return null;
  const path = deeplink.slice(SCHEME.length).replace(/^\/+/, '');
  // Empty path = app root.
  if (path === '' || path === '/') return '/';
  // Trim trailing slash, drop any query/hash for matching.
  const head = path.split(/[?#]/)[0].replace(/\/+$/, '');
  switch (head) {
    case 'reflect': return '/reflect';
    case 'circles': return '/circles';
    default: return '/';
  }
}

interface PushPayloadData {
  category?: string;
  deeplink?: string;
  [key: string]: unknown;
}

function readData(
  notification: Notifications.Notification | null | undefined,
): PushPayloadData | null {
  const data = notification?.request?.content?.data;
  if (!data || typeof data !== 'object') return null;
  return data as PushPayloadData;
}

// handleResponse routes a push tap. Safe to call with anything Expo
// hands us — guards on every step. Returns true when a navigation
// happened so the caller can log it.
export function handleResponse(
  response: Notifications.NotificationResponse,
  router: Router,
): boolean {
  const data = readData(response.notification);
  const dest = destinationFor(data?.deeplink);
  if (!dest) return false;
  // Cast through unknown because Expo Router's typed-routes cache may
  // not include every route literal until the dev server regenerates.
  router.push(dest as unknown as Parameters<typeof router.push>[0]);
  return true;
}

// initialResponse picks up the push that *launched* the app (cold start
// from a notification tap). Expo's listener doesn't fire for that case
// — we have to ask for the response explicitly once on mount.
export async function handleInitialResponse(router: Router): Promise<boolean> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (!response) return false;
  return handleResponse(response, router);
}
