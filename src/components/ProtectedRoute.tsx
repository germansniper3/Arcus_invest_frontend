import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import type { Role } from '../types';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles: Role[] }) {
  const { user, loading, canAccess } = useAuth();
  if (loading) return <main className="loading-shell">Checking access...</main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccess(roles)) return <Navigate to={user.role === 'student' ? '/student' : '/admin'} replace />;
  return <>{children}</>;
}
