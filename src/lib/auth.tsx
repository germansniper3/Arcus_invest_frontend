import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from './api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  canReachAdmin: () => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api.me()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
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
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
