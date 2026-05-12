import auth from '@react-native-firebase/auth';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

export function configureGoogleSignIn(webClientId: string) {
  GoogleSignin.configure({ webClientId });
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
