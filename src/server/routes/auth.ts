import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, userRoles, roles } from '@/db/schema';
import { verifyPassword, signSession, SESSION_COOKIE } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { requireAuth } from '../authz';

export const authRoutes = new Hono();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);

  if (!user || !user.isActive) return c.json({ error: 'Invalid credentials' }, 401);
  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  const roleRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  const token = await signSession({
    userId: user.id,
    organizationId: user.organizationId,
    siteId: user.siteId,
    departmentId: user.departmentId,
    email: user.email,
    fullName: user.fullName,
    roles: roleRows.map((r) => r.name),
  });

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });

  await recordAuditEvent({
    organizationId: user.organizationId,
    userId: user.id,
    eventType: 'USER_LOGIN',
    entityType: 'user',
    entityId: user.id,
    summary: `${user.fullName} logged in`,
  });

  return c.json({
    user: { id: user.id, fullName: user.fullName, email: user.email, roles: roleRows.map((r) => r.name) },
  });
});

authRoutes.post('/logout', requireAuth, async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, async (c) => {
  return c.json({ session: c.get('session') });
});
