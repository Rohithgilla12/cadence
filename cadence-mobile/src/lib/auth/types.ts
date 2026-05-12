export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  getIdToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}
