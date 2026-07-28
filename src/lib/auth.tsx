import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, clearToken, getToken, onWakeStateChange, setToken } from './api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** The API is unreachable and the client is retrying — a sleeping container. */
  wakingUp: boolean;
  /**
   * A token is held but the session could not be restored because the server
   * could not be reached. Distinct from being signed out: the credential is
   * still good, so the answer is to retry rather than to ask for a password.
   */
  connectionLost: boolean;
  /** Re-attempt the initial session restore. */
  retryConnection: () => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  canReachAdmin: () => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [wakingUp, setWakingUp] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  // Mirrors the api client's retry state into React. Subscribed once for the
  // app's lifetime so any request, from any screen, can raise the indicator.
  useEffect(() => onWakeStateChange(setWakingUp), []);

  const restoreSession = useCallback(() => {
    if (!getToken()) return;
    setLoading(true);
    setUnreachable(false);
    api.me()
      .then((me) => setUser(me))
      .catch((err) => {
        // Only a rejected token signs the user out. This previously cleared the
        // token on ANY failure, so a cold start — the container asleep, the
        // first request refused — logged people out and looked like the session
        // had expired.
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          setUser(null);
          return;
        }
        // Reached the retry budget without an answer. Keep the credential and
        // say the server is unreachable; falling through to the login page here
        // would ask for a password the user does not need to re-enter, which
        // reads as "you were signed out" for what is really a network problem.
        setUnreachable(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { restoreSession(); }, [restoreSession]);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    wakingUp,
    connectionLost: unreachable && Boolean(getToken()) && !user,
    retryConnection: restoreSession,
    login: async (email, password) => {
      const response = await api.login(email, password);
      setToken(response.token);
      setUser(response.user);
      return response.user;
    },
    logout: () => {
      clearToken();
      setUser(null);
    },
    // Whether this user has any business on the admin surface at all.
    //
    // Deliberately a capability check rather than a role list. The backend is
    // permission-based throughout (authz, default-deny), so a hardcoded list of
    // role names here is a second source of truth that drifts — and did: every
    // custom role failed it, which is exactly the population the role-management
    // UI exists to create. The rail already hides the sections a caller cannot
    // use, so "can read at least one thing" is the honest entry condition.
    canReachAdmin: () => {
      if (!user || user.role === 'student') return false;
      // No permissions payload means an older token or a failed load; fall back
      // to the two roles that have always had blanket access rather than
      // locking out a legitimate admin.
      if (!user.permissions) return user.role === 'super_admin' || user.role === 'admin';
      return Object.values(user.permissions).some((p) => p?.read === true);
    }
  }), [user, loading, wakingUp, unreachable, restoreSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
