import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, verifySession, SessionPayload } from '@/lib/auth';
import { PermissionKey, RoleName, roleHasPermission } from '@/lib/permissions';

declare module 'hono' {
  interface ContextVariableMap {
    session: SessionPayload;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: 'Not authenticated' }, 401);
  const session = await verifySession(token);
  if (!session) return c.json({ error: 'Session invalid or expired' }, 401);
  c.set('session', session);
  await next();
}

/**
 * Enforced server-side (API layer), per section 5 of the spec: "Enforce access
 * permissions at the API and database layers, not merely in the frontend."
 */
export function requirePermission(permission: PermissionKey) {
  return async (c: Context, next: Next) => {
    const session = c.get('session');
    if (!session) return c.json({ error: 'Not authenticated' }, 401);
    const roles = (session.roles || []) as RoleName[];
    const allowed = roles.some((r) => roleHasPermission(r, permission));
    if (!allowed) {
      return c.json({ error: `Forbidden: missing permission ${permission}` }, 403);
    }
    await next();
  };
}
