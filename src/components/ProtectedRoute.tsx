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

/**
 * Shown when a valid session could not be restored because the server was
 * unreachable, rather than because the credential was rejected.
 *
 * The distinction is the whole point: bouncing to /login here would ask for a
 * password the user does not need to re-enter and would read as "you were
 * signed out", when the truth is "the server was asleep".
 */
function CannotReachServer() {
  const { retryConnection, logout } = useAuth();
  return (
    <main className="loading-shell" style={{ flexDirection: 'column', gap: '14px', textAlign: 'center', padding: '24px' }}>
      <h1 style={{ fontSize: '19px', color: '#111512', margin: 0 }}>Cannot reach the server</h1>
      <p style={{ fontSize: '14px', color: '#5a625d', margin: 0, maxWidth: '46ch' }}>
        You are still signed in — the server just did not answer in time. It sleeps when idle, so
        this usually clears on a second attempt.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={retryConnection} className="primary" style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer' }}>
          Try again
        </button>
        <button onClick={logout} style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '6px', background: '#fff', border: '1px solid #dfe1da', color: '#111512', cursor: 'pointer' }}>
          Sign out
        </button>
      </div>
    </main>
  );
}

export function ProtectedRoute({ children, surface }: { children: ReactNode; surface: Surface }) {
  const { user, loading, wakingUp, connectionLost, canReachAdmin } = useAuth();
  if (loading) {
    // A cold start can hold this for several seconds. Saying so is the
    // difference between "it is working on it" and "it is broken".
    return (
      <main className="loading-shell" style={{ flexDirection: 'column', gap: '8px', textAlign: 'center' }}>
        <span>{wakingUp ? 'Waking the server up…' : 'Checking access...'}</span>
        {wakingUp && (
          <span style={{ fontSize: '13px', color: '#8a908a' }}>
            It sleeps when idle, so the first request takes a moment.
          </span>
        )}
      </main>
    );
  }
  // Checked before the login redirect: an unreachable server is not a rejected
  // credential, and must not be presented as one.
  if (connectionLost) return <CannotReachServer />;
  // Not being signed in is the one case where redirecting is right: /login is a
  // different surface, so there is no loop to fall into.
  if (!user) return <Navigate to="/login" replace />;

  const allowed = surface === 'admin' ? canReachAdmin() : user.role === 'student';
  if (!allowed) return <NoAccess surface={surface} />;
  return <>{children}</>;
}
