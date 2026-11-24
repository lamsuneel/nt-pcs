import { Hono } from 'hono';
import { eq, desc, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { sites, departments, users, roles, userRoles, integrations, integrationSyncLogs } from '@/db/schema';
import { requireAuth } from '../authz';

export const metaRoutes = new Hono();
metaRoutes.use('*', requireAuth);

metaRoutes.get('/org', async (c) => {
  const session = c.get('session');
  const siteRows = await db.select().from(sites).where(eq(sites.organizationId, session.organizationId));
  const deptRows = await db.select().from(departments).where(eq(departments.organizationId, session.organizationId));
  return c.json({ sites: siteRows, departments: deptRows });
});

metaRoutes.get('/users', async (c) => {
  const session = c.get('session');
  const userRows = await db.select().from(users).where(eq(users.organizationId, session.organizationId));
  const roleRows = await db
    .select({ userId: userRoles.userId, roleName: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id));

  const rolesByUser: Record<string, string[]> = {};
  for (const r of roleRows) {
    rolesByUser[r.userId] = rolesByUser[r.userId] ?? [];
    rolesByUser[r.userId].push(r.roleName);
  }

  return c.json({
    users: userRows.map((u) => ({ ...u, passwordHash: undefined, roles: rolesByUser[u.id] ?? [] })),
  });
});

metaRoutes.get('/integrations', async (c) => {
  const session = c.get('session');
  const rows = await db.select().from(integrations).where(eq(integrations.organizationId, session.organizationId));
  const logs = rows.length
    ? await db
        .select()
        .from(integrationSyncLogs)
        .where(inArray(integrationSyncLogs.integrationId, rows.map((r) => r.id)))
        .orderBy(desc(integrationSyncLogs.startedAt))
    : [];
  return c.json({ integrations: rows, logs });
});
