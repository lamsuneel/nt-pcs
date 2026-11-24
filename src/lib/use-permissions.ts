'use client';

import { useEffect, useState } from 'react';
import { PERMISSIONS, PermissionKey, RoleName, roleHasPermission } from './permissions';

interface SessionInfo {
  userId: string;
  fullName: string;
  email: string;
  roles: RoleName[];
}

/**
 * Client-side mirror of the server's RBAC rules, used only to decide what to
 * show (hide buttons/links the signed-in persona can't use). The API layer
 * (src/server/authz.ts) is the real enforcement point and re-checks every
 * mutation independently — this hook exists so the UI doesn't dangle an
 * action a role will just get a 403 for.
 */
export function usePermissions() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled) setSession(body?.session ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roles = session?.roles ?? [];

  function can(permission: PermissionKey): boolean {
    return roles.some((r) => roleHasPermission(r, permission));
  }

  function canAny(permissions: PermissionKey[]): boolean {
    return permissions.length === 0 || permissions.some((p) => can(p));
  }

  return { session, roles, loading, can, canAny, PERMISSIONS };
}
