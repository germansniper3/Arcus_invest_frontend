import { Link, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

/**
 * The two protected surfaces. Named rather than given a list of role strings:
 * the backend decides authority by permission, and a role list here was a second
 * source of truth that drifted out of step with it.
 */
type Surface = 'admin' | 'student';

/**
 * NoAccess is what a signed-in user sees when they cannot use the surface they
 * asked for.
 *
 * This deliberately renders instead of redirecting. The previous version sent a
 * failing non-student to /admin — including when /admin was what they had just
 * been refused — which re-rendered the same guard and looped forever. Any
 * redirect on failure can recreate that bug the moment the target changes; a
 * terminal screen cannot, because it never navigates at all.
 */
function NoAccess({ surface }: { surface: Surface }) {
  const { user, logout } = useAuth();
  return (
    <main className="loading-shell" style={{ flexDirection: 'column', gap: '14px', textAlign: 'center', padding: '24px' }}>
      <h1 style={{ fontSize: '19px', color: '#111512', margin: 0 }}>No access to this area</h1>
      <p style={{ fontSize: '14px', color: '#5a625d', margin: 0, maxWidth: '46ch' }}>
        {user?.full_name ? `${user.full_name}, your` : 'Your'} account does not have permission for the{' '}
        {surface === 'admin' ? 'management area' : 'student portal'}. If this is unexpected, ask an
        administrator to review your role.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/" style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '6px', background: '#eef0ea', border: '1px solid #dfe1da', color: '#111512', textDecoration: 'none' }}>
          Back to site
        </Link>
        <button onClick={logout} style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '6px', background: '#fff', border: '1px solid #dfe1da', color: '#111512', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </main>
  );
}

export function ProtectedRoute({ children, surface }: { children: ReactNode; surface: Surface }) {
  const { user, loading, canReachAdmin } = useAuth();
  if (loading) return <main className="loading-shell">Checking access...</main>;
  // Not being signed in is the one case where redirecting is right: /login is a
  // different surface, so there is no loop to fall into.
  if (!user) return <Navigate to="/login" replace />;

  const allowed = surface === 'admin' ? canReachAdmin() : user.role === 'student';
  if (!allowed) return <NoAccess surface={surface} />;
  return <>{children}</>;
}
