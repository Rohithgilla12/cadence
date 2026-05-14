import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

import { endpoints } from '@/lib/api';
import { apiClient } from '@/lib/client';

// Wrapper around @react-native-firebase/messaging that handles permission
// + token registration with our server. Designed to be safe to call on
// every sign-in: requestPermission is idempotent in iOS (returns the
// current grant if the user already decided) and our server upsert keys
// on the token itself, not on user, so re-registers are no-ops.

export interface PushRegisterResult {
  granted: boolean;
  token: string | null;
}

// requestAndRegister asks the OS for notification permission, fetches the
// FCM token, and posts it to /v1/me/devices. Returns the result so the
// caller can decide whether to surface "notifications are off" UI.
//
// Designed to never throw — a transient failure (no network, FCM offline)
// should not block the sign-in flow. The caller can retry on a later
// app-foreground event.
export async function requestAndRegister(): Promise<PushRegisterResult> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { granted: false, token: null };
  }
  let granted = false;
  try {
    const status = await messaging().requestPermission();
    granted =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
  } catch {
    return { granted: false, token: null };
  }
  if (!granted) {
    return { granted: false, token: null };
  }
  let token: string | null = null;
  try {
    token = await messaging().getToken();
  } catch {
    return { granted: true, token: null };
  }
  if (!token) {
    return { granted: true, token: null };
  }
  try {
    await endpoints.registerDevice(apiClient)({
      token,
      platform: Platform.OS as 'ios' | 'android',
    });
  } catch {
    // Server-side register failed — keep going. Local FCM listener still
    // works; we just won't get server-initiated sends until the next
    // re-register attempt.
  }
  return { granted: true, token };
}

// unregister is best-effort cleanup on sign-out. Drops the token from
// the server table so a re-signed-in account doesn't receive
// notifications meant for the previous user.
export async function unregister(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const token = await messaging().getToken();
    if (token) {
      await endpoints.unregisterDevice(apiClient)(token).catch(() => {});
    }
  } catch {
    // ignore — local sign-out proceeds regardless
  }
}

// sendTest hits the dev endpoint so the user can verify push end-to-end
// from the You tab.
export async function sendTest(): Promise<{ sent: number; pruned: number }> {
  return endpoints.sendTestPush(apiClient)();
}
