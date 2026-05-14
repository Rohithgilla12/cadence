// JS surface for the WidgetBridge local Expo Module. On non-iOS platforms
// every call is a no-op so callers don't need to platform-gate.

import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

interface WidgetBridgeNativeModule {
  setSnapshot(appGroup: string, key: string, json: string): boolean;
  clearSnapshot(appGroup: string, key: string): boolean;
  reloadAllTimelines(): void;
}

const noop: WidgetBridgeNativeModule = {
  setSnapshot: () => false,
  clearSnapshot: () => false,
  reloadAllTimelines: () => {},
};

let module: WidgetBridgeNativeModule = noop;
if (Platform.OS === 'ios') {
  try {
    module = requireNativeModule<WidgetBridgeNativeModule>('WidgetBridge');
  } catch {
    // Pre-prebuild dev runs (e.g. web, or before `expo prebuild`) hit this
    // path. Silently keep the no-op shim.
    module = noop;
  }
}

export const WidgetBridge = module;
