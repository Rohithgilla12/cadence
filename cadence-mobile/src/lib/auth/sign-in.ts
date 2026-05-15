import auth from '@react-native-firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

// `autoDetect` tells the library to read the Web OAuth client ID from
// google-services.json on Android and from GoogleService-Info.plist on
// iOS (requires a <key>WEB_CLIENT_ID</key> entry there). The value isn't
// a secret — it ships embedded in those config files anyway — so we
// don't route it through env vars where a missing var silently produces
// a build with a broken sign-in button. v14+ of the library supports
// this; we're on v16, so it works without further setup on Android. For
// iOS, ensure GoogleService-Info.plist carries the WEB_CLIENT_ID key.
export function configureGoogleSignIn() {
  GoogleSignin.configure({ webClientId: 'autoDetect' });
}

export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  // RNGS v16 returns { type: 'success', data: User } or { type: 'cancelled', data: null }
  if (response.type === 'cancelled') return;
  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('Google sign-in returned no idToken');
  }
  const credential = auth.GoogleAuthProvider.credential(idToken);
  await auth().signInWithCredential(credential);
}

export async function signInWithApple(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is iOS-only in v1');
  }
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!credential.identityToken) {
    throw new Error('Apple Sign-In returned no identity token');
  }
  const appleCredential = auth.AppleAuthProvider.credential(
    credential.identityToken,
    credential.authorizationCode ?? undefined,
  );
  await auth().signInWithCredential(appleCredential);
}

export { statusCodes };
