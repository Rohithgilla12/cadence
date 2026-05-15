// iOS-default platform indirection. Picked by Metro when bundling for
// iOS; the .android.ts override sits next to this file and is picked
// for Android. Exists so import.ts (and any other intra-module file
// that wants the native-side API without going through the public
// index) can write `from './_native'` and stay platform-agnostic.
//
// The leading underscore marks this as internal to src/lib/health/ —
// no caller outside this directory should reference it.

export { readDailySummary, isAvailable } from './appleHealth';
