import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { overlayProfiles } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { storage } from '@/lib/storage';
import { buildControlledCopyPdf, type StampField } from '@/lib/pdf';
import { requireAuth, requirePermission } from '../authz';

export const overlayProfileRoutes = new Hono();
overlayProfileRoutes.use('*', requireAuth);

overlayProfileRoutes.get('/', async (c) => {
  const session = c.get('session');
  const rows = await db
    .select()
    .from(overlayProfiles)
    .where(eq(overlayProfiles.organizationId, session.organizationId))
    .orderBy(desc(overlayProfiles.createdAt));
  return c.json({ overlayProfiles: rows });
});

// Document Controller is who owns Print Review under MVP scope — gated on
// DOCUMENT_REGISTER, same permission as assigning a profile to a document.
overlayProfileRoutes.post('/', requirePermission(PERMISSIONS.DOCUMENT_REGISTER), async (c) => {
  const session = c.get('session');
  const body = await c.req.json();
  if (!body.name) return c.json({ error: 'name is required' }, 400);

  let logoFileKey: string | null = null;
  if (body.logoDataUrl) {
    const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(body.logoDataUrl);
    if (!match) return c.json({ error: 'logoDataUrl must be a base64 PNG or JPEG data URL' }, 400);
    const bytes = Buffer.from(match[2], 'base64');
    logoFileKey = `overlay-logos/${session.organizationId}/${Date.now()}.${match[1] === 'jpg' ? 'jpeg' : match[1]}`;
    await storage.putObject(logoFileKey, bytes, `image/${match[1]}`);
  }

  const [profile] = await db
    .insert(overlayProfiles)
    .values({
      organizationId: session.organizationId,
      name: body.name,
      logoFileKey,
      paperSize: body.paperSize ?? 'A4',
      stampFields: body.stampFields ?? [],
      isDefault: !!body.isDefault,
      createdByUserId: session.userId,
    })
    .returning();

  return c.json({ overlayProfile: profile }, 201);
});

overlayProfileRoutes.patch('/:id', requirePermission(PERMISSIONS.DOCUMENT_REGISTER), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');
  const body = await c.req.json();

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if ('name' in body) update.name = body.name;
  if ('paperSize' in body) update.paperSize = body.paperSize;
  if ('stampFields' in body) update.stampFields = body.stampFields;
  if ('isDefault' in body) update.isDefault = body.isDefault;

  if (body.logoDataUrl) {
    const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(body.logoDataUrl);
    if (!match) return c.json({ error: 'logoDataUrl must be a base64 PNG or JPEG data URL' }, 400);
    const bytes = Buffer.from(match[2], 'base64');
    const logoFileKey = `overlay-logos/${session.organizationId}/${Date.now()}.${match[1] === 'jpg' ? 'jpeg' : match[1]}`;
    await storage.putObject(logoFileKey, bytes, `image/${match[1]}`);
    update.logoFileKey = logoFileKey;
  }

  const [updated] = await db.update(overlayProfiles).set(update).where(eq(overlayProfiles.id, id)).returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json({ overlayProfile: updated });
});

// Renders this profile's logo + stamp fields over a generic sample page, so
// the Document Controller can see the layout before assigning it to any
// real document. Watermarked the same way as the per-request preview.
overlayProfileRoutes.get('/:id/preview', async (c) => {
  const id = c.req.param('id');
  const [profile] = await db.select().from(overlayProfiles).where(eq(overlayProfiles.id, id)).limit(1);
  if (!profile) return c.json({ error: 'Not found' }, 404);

  const logoBytes = profile.logoFileKey ? await storage.getObject(profile.logoFileKey) : null;

  const pdfBytes = await buildControlledCopyPdf({
    documentNumber: 'SOP-SAMPLE-001',
    documentTitle: 'Sample Controlled Document',
    revisionLabel: '01',
    copyIdentifier: 'SOP-SAMPLE-001-REV01-PREVIEW',
    markingLabel: 'CONTROLLED COPY',
    issuedToLabel: 'Sample Department',
    printedDateLabel: new Date().toISOString().slice(0, 10),
    verifyUrl: 'https://example.invalid/verify/preview',
    overlayProfile: {
      logoBytes: logoBytes ?? undefined,
      stampFields: (profile.stampFields as StampField[]) ?? [],
    },
    previewOnly: true,
  });

  return new Response(pdfBytes, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="overlay-preview.pdf"' },
  });
});
