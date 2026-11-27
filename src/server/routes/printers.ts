import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { printers, printJobs } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { resetCircuit } from '@/lib/print-queue/circuit-breaker';
import { requireAuth, requirePermission } from '../authz';

export const printerRoutes = new Hono();
printerRoutes.use('*', requireAuth);

printerRoutes.get('/', async (c) => {
  const session = c.get('session');
  const rows = await db.select().from(printers).where(eq(printers.organizationId, session.organizationId)).orderBy(desc(printers.createdAt));
  return c.json({ printers: rows });
});

// Document Controller manages the printer registry under MVP scope — this
// is the "Printer & Queue Management" page's write permission.
printerRoutes.post('/', requirePermission(PERMISSIONS.PRINT_ISSUE), async (c) => {
  const session = c.get('session');
  const body = await c.req.json();
  if (!body.name || !body.siteId) return c.json({ error: 'name and siteId are required' }, 400);

  const [printer] = await db
    .insert(printers)
    .values({
      organizationId: session.organizationId,
      siteId: body.siteId,
      name: body.name,
      connectionEndpoint: body.connectionEndpoint ?? null,
      supportedPaperSizes: body.supportedPaperSizes ?? ['A4'],
    })
    .returning();

  return c.json({ printer }, 201);
});

printerRoutes.post('/:id/reset-circuit', requirePermission(PERMISSIONS.PRINT_ISSUE), async (c) => {
  const id = c.req.param('id');
  await resetCircuit(id);
  const [printer] = await db.select().from(printers).where(eq(printers.id, id)).limit(1);
  return c.json({ printer });
});

printerRoutes.post('/:id/pause', requirePermission(PERMISSIONS.PRINT_ISSUE), async (c) => {
  const id = c.req.param('id');
  const [printer] = await db.update(printers).set({ status: 'PAUSED', updatedAt: new Date() }).where(eq(printers.id, id)).returning();
  return c.json({ printer });
});

printerRoutes.post('/:id/resume', requirePermission(PERMISSIONS.PRINT_ISSUE), async (c) => {
  const id = c.req.param('id');
  const [printer] = await db
    .update(printers)
    .set({ status: 'ACTIVE', consecutiveFailures: 0, circuitOpenUntil: null, updatedAt: new Date() })
    .where(eq(printers.id, id))
    .returning();
  return c.json({ printer });
});

// All print jobs for the org across every printer — the dashboard's
// "what's in flight / dead-lettered right now" view. Registered before
// '/:id/jobs' so the literal 'jobs' segment can never be captured as an id.
printerRoutes.get('/jobs/all', async (c) => {
  const session = c.get('session');
  const rows = await db
    .select()
    .from(printJobs)
    .where(eq(printJobs.organizationId, session.organizationId))
    .orderBy(desc(printJobs.queuedAt))
    .limit(100);
  return c.json({ jobs: rows });
});

printerRoutes.get('/:id/jobs', async (c) => {
  const id = c.req.param('id');
  const rows = await db
    .select()
    .from(printJobs)
    .where(and(eq(printJobs.printerId, id)))
    .orderBy(desc(printJobs.queuedAt))
    .limit(50);
  return c.json({ jobs: rows });
});
