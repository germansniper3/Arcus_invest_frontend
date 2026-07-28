import type { PermissionResource } from '../types';
import { useAuth } from './auth';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete';
export type Can = (res: PermissionResource, act?: PermissionAction) => boolean;

/**
 * The permission check every admin feature renders against.
 *
 * Effective permissions come from /auth/me. When they are absent — an older
 * token, or a response that predates the permissions field — this falls back to
 * the role check the portal used before, so a legitimate admin never lands on
 * an empty screen because of a stale session.
 *
 * This is a hook rather than a prop so a feature can be mounted anywhere
 * without the shell having to hand it down; the server re-checks every call
 * regardless, so nothing here is a security boundary.
 */
export function useCan(): Can {
  const { user } = useAuth();
  const perms = user?.permissions;

  return (res, act = 'read') => {
    if (!perms) return user?.role === 'super_admin' || user?.role === 'admin';
    return perms[res]?.[act] === true;
  };
}
