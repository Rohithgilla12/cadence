import type { ExpoConfig } from "expo/config";

// Firebase config files are gitignored (per .gitignore) because the repo is
// public. For EAS cloud builds, the files are uploaded as secret-visibility
// file env vars (`eas env:create --type file --visibility secret`). EAS
// materializes them on the build runner and sets the env var to the
// resulting absolute file path.
//
// Locally (e.g. `bunx expo run:ios` on a workstation with the files sitting
// next to this config), the env vars are unset and we fall back to the
// repo-relative paths.
const googleServicesInfoPlist =
  process.env.GOOGLE_SERVICES_INFO_PLIST ?? "./GoogleService-Info.plist";
const googleServicesJson =
  process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json";

const config: ExpoConfig = {
  name: "Cadence",
  slug: "cadence-mobile",
  scheme: "cadence",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#2C3528",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "fun.gilla.cadence",
    googleServicesFile: googleServicesInfoPlist,
    usesAppleSignIn: true,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    // Declared statically (not via a withEntitlementsPlist modifier) so EAS
    // Build's capability syncer detects HealthKit and enables it on the
    // provisioning profile. See https://github.com/expo/eas-cli/issues/2117
    entitlements: {
      "com.apple.developer.healthkit": true,
      "com.apple.developer.healthkit.access": [],
    },
  },
  android: {
    package: "fun.gilla.cadence",
    googleServicesFile: googleServicesJson,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#F4F3ED",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-router",
      {
        root: "./app",
      },
    ],
    "expo-system-ui",
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    "@react-native-google-signin/google-signin",
    "expo-apple-authentication",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
        },
      },
    ],
    [
      "@kingstinct/react-native-healthkit",
      {
        NSHealthShareUsageDescription:
          "Cadence reads sleep, mood-affecting activity, and workouts to learn which habits move your rhythm. Your health data stays on this device.",
        NSHealthUpdateUsageDescription:
          "Cadence does not write to Apple Health in this version.",
      },
    ],
    "./plugins/withFirebaseStaticFrameworks",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {
      root: "./app",
    },
    eas: {
      projectId: "9cfe9dc8-b0c9-4f6c-b96e-20f42b8b1532",
    },
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: {
    url: "https://u.expo.dev/9cfe9dc8-b0c9-4f6c-b96e-20f42b8b1532",
  },
};

export default config;
