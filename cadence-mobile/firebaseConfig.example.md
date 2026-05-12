# Firebase configuration

Two files (both gitignored) must sit at the root of `cadence-mobile/`:

- `GoogleService-Info.plist` — download from Firebase console (iOS app)
- `google-services.json` — download from Firebase console (Android app)

For Google Sign-In on iOS, copy the **reversed client ID** (looks like
`com.googleusercontent.apps.<digits>-<hash>`) and add it as a URL scheme.
The `@react-native-google-signin/google-signin` config plugin handles this
when `expo prebuild` runs.

For Apple Sign-In, enable "Sign In with Apple" capability for the bundle ID
in the Apple Developer console.
