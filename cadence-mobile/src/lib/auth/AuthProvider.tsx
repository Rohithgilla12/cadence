import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { createContext, useEffect, useMemo, useState } from 'react';
import type { AuthState, AuthStatus, AuthUser } from './types';

export const AuthContext = createContext<AuthState | null>(null);

function toAuthUser(user: FirebaseAuthTypes.User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
      setUser(toAuthUser(firebaseUser));
      setStatus(firebaseUser ? 'signed-in' : 'signed-out');
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      getIdToken: async () => {
        const current = auth().currentUser;
        return current ? current.getIdToken() : null;
      },
      signOut: async () => {
        await auth().signOut();
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
