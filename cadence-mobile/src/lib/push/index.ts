import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { endpoints } from '@/lib/api';
import { apiClient } from '@/lib/client';

// Foreground behavior — when a push lands while Cadence is open we still
// show the banner. Calm by default: no badge, no sound (we let the OS
// quiet-hours / focus-mode call those).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushRegisterResult {
  granted: boolean;
  token: string | null;
}

// requestAndRegister asks the OS for notification permission, fetches the
// Expo push token (an "ExponentPushToken[…]" string the Expo Push Service
// accepts), and posts it to our server. Safe to call on every signed-in
// launch — the OS only shows the prompt the first time, server upserts by
// token so re-registers are idempotent.
//
// Never throws — a transient failure shouldn't block the sign-in flow.
export async function requestAndRegister(): Promise<PushRegisterResult> {
  if (!Device.isDevice) {
    // Simulator / web — push tokens aren't issued.
    return { granted: false, token: null };
  }

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    } catch {
      // Best-effort.
    }
  }

  let granted = false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (existing.status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    granted = finalStatus === 'granted';
  } catch {
    return { granted: false, token: null };
  }

  if (!granted) return { granted: false, token: null };

  let token: string | null = null;
  try {
    const result = await Notifications.getExpoPushTokenAsync();
    token = result.data;
  } catch {
    return { granted: true, token: null };
  }
  if (!token) return { granted: true, token: null };

  try {
    await endpoints.registerDevice(apiClient)({
      token,
      platform: Platform.OS as 'ios' | 'android',
    });
  } catch {
    // Server-side register failed — keep going. Re-try happens next launch.
  }
  return { granted: true, token };
}

// unregister is best-effort cleanup on sign-out. Drops the current device's
// Expo push token from the server table.
export async function unregister(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const result = await Notifications.getExpoPushTokenAsync();
    const token = result.data;
    if (token) {
      await endpoints.unregisterDevice(apiClient)(token).catch(() => {});
    }
  } catch {
    // ignore — local sign-out proceeds regardless
  }
}

export async function sendTest(): Promise<{ sent: number; pruned: number }> {
  return endpoints.sendTestPush(apiClient)();
}
