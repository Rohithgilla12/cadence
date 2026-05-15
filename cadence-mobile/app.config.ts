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
    // Universal Links. iOS fetches /.well-known/apple-app-site-association
    // from cadence.gilla.fun on install and verifies this app's claim over
    // /circle/join/* URLs. Once verified, taps on those URLs open the app
    // directly without bouncing through Safari. The static declaration
    // here lets EAS's capability syncer enable Associated Domains on the
    // App ID — same mechanism as HealthKit / Push below.
    associatedDomains: ["applinks:cadence.gilla.fun"],
    // Declared statically (not via a withEntitlementsPlist modifier) so EAS
    // Build's capability syncer detects HealthKit and enables it on the
    // provisioning profile. See https://github.com/expo/eas-cli/issues/2117
    //
    // App Groups: the suffix must match the `appGroupIdentifier` in
    // `targets/cadence-widget/expo-target.config.json` so the widget
    // extension and the main app share a UserDefaults suite.
    entitlements: {
      "com.apple.developer.healthkit": true,
      "com.apple.developer.healthkit.access": [],
      "com.apple.security.application-groups": ["group.fun.gilla.cadence"],
      // Push notifications. Static declaration so EAS's capability syncer
      // enables Push on the App ID and regenerates a provisioning profile
      // that carries the matching entitlement.
      "aps-environment": "production",
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
    // Android App Links. autoVerify drives the OS to fetch
    // /.well-known/assetlinks.json from cadence.gilla.fun at install
    // and grant this app the right to open https URLs under
    // /circle/join/*. assetlinks.json carries the production keystore
    // SHA-256 (alias 07cdfcb...). Verified taps open the app directly;
    // unverified ones still fall back through the static landing page.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        category: ["BROWSABLE", "DEFAULT"],
        data: [
          {
            scheme: "https",
            host: "cadence.gilla.fun",
            pathPrefix: "/circle/join",
          },
        ],
      },
    ],
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
    // No @react-native-firebase/analytics plugin entry — the v24 package
    // doesn't ship an app.plugin.js. The JS module still autolinks via
    // Expo (the native pod follows from @react-native-firebase/app) and
    // calls to analytics() pick up the already-initialized Firebase app.
    "@react-native-google-signin/google-signin",
    "expo-apple-authentication",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
        },
        android: {
          // Health Connect requires Android 8.0 (API 26). Expo SDK 54's
          // default minSdkVersion is 24; bumping is safe — sub-2% of
          // in-market Android devices are pre-26, and none of those are
          // running a habits app paired with Health Connect.
          minSdkVersion: 26,
        },
      },
    ],
    // react-native-health-connect — Android-only Health Connect wrapper.
    // Its config plugin appends the permission-rationale intent-filter
    // to MainActivity, which Google Play uses to surface the app in
    // Health Connect's permissions UI. iOS bundle never sees this lib
    // (autolinking config + Metro platform-extension dispatch in
    // src/lib/health/).
    "react-native-health-connect",
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
    // Registers the WidgetKit extension target defined under
    // `targets/cadence-widget/`. See cadence-mobile/README.md → "iOS Home
    // Screen widgets".
    "@bacons/apple-targets",
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
