// Epic H — inbound print-trigger webhook. This is the "seamless triggering
// from any API" requirement: MasterControl, SharePoint, Veeva, or (today)
// Google Drive calls this endpoint when a document should be printed, and
// PrintAssure creates a normal print_request from it — still subject to
// the same e-signed approval step as a request made in-app. Triggering a
// print is not the same as approving one; this route only ever creates a
// REQUESTED row.
//
// Auth is a per-organization, per-provider shared secret (not a user
// session — the caller is a server, not a signed-in person), stored in
// integrations.configJson.webhookSecret. Each provider is isolated by
// construction: a bad/misconfigured secret, a down adapter, or a malformed
// payload for one provider can only ever 400/502 that one call — there's no
// shared state across providers or with native print requests.

import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { organizations, integrations, printRequests, departments, documents } from '@/db/schema';
import { recordAuditEvent } from '@/lib/audit';
import { getAdapter, type IntegrationProviderKey } from '@/lib/integrations/adapter';
import { googleDriveAdapter } from '@/lib/integrations/google-drive';
import { sharePointAdapter } from '@/lib/integrations/sharepoint';
import { registerAdapter } from '@/lib/integrations/adapter';

registerAdapter(googleDriveAdapter);
registerAdapter(sharePointAdapter);

const PROVIDER_PATH_MAP: Record<string, IntegrationProviderKey> = {
  'google-drive': 'GOOGLE_DRIVE',
  sharepoint: 'SHAREPOINT',
  mastercontrol: 'MASTERCONTROL',
  veeva: 'VEEVA',
};

export const integrationRoutes = new Hono();

integrationRoutes.post('/print-trigger/:provider/:orgSlug', async (c) => {
  const providerPath = c.req.param('provider');
  const orgSlug = c.req.param('orgSlug');
  const providerKey = PROVIDER_PATH_MAP[providerPath];
  if (!providerKey) return c.json({ error: `Unknown provider "${providerPath}"` }, 404);

  const [org] = await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1);
  if (!org) return c.json({ error: 'Unknown organization' }, 404);

  const [integration] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.organizationId, org.id), eq(integrations.providerKey, providerPath)))
    .limit(1);
  if (!integration || !integration.isActive) {
    return c.json({ error: `${providerPath} is not configured/active for this organization` }, 403);
  }

  const expectedSecret = (integration.configJson as any)?.webhookSecret;
  const providedSecret = c.req.header('x-ntpcs-webhook-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return c.json({ error: 'Invalid or missing webhook secret' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body?.externalRef || !body?.requestedByEmail || !body?.destinationLocation || !body?.departmentId) {
    return c.json(
      { error: 'Required: externalRef, requestedByEmail, destinationLocation, departmentId. Optional: numberOfCopies, isUrgent, intendedPurpose.' },
      400
    );
  }

  const adapter = getAdapter(providerKey);
  if (!adapter) return c.json({ error: `No adapter registered for ${providerKey}` }, 500);

  let resolved;
  try {
    resolved = await adapter.resolveDocument(body.externalRef);
  } catch (err) {
    // Scoped failure: this provider's adapter couldn't resolve the
    // reference (auth, network, not-yet-implemented). Native printing and
    // every other provider are entirely unaffected.
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `${providerKey} adapter error: ${message}` }, 502);
  }

  if (!resolved) {
    return c.json(
      { error: `No approved document is mapped to externalRef "${body.externalRef}" for ${providerKey}` },
      404
    );
  }

  const [dept] = await db.select().from(departments).where(eq(departments.id, body.departmentId)).limit(1);
  if (!dept || dept.organizationId !== org.id) {
    return c.json({ error: 'Unknown department for this organization' }, 400);
  }

  // There's no signed-in user to attribute this to — it came from an
  // external system, not a PrintAssure session. Attribute it to the
  // document's own owner/creator (a real, already-provisioned user), and
  // record the real requester's email in the audit trail and the request's
  // own notes so the human identity behind the trigger is never lost.
  const [doc] = await db.select().from(documents).where(eq(documents.id, resolved.documentId)).limit(1);
  const attributedUserId = doc?.ownerUserId ?? doc?.createdByUserId;
  if (!attributedUserId) {
    return c.json({ error: 'Document has no owner/creator on record to attribute this request to' }, 500);
  }

  const [req_] = await db
    .insert(printRequests)
    .values({
      organizationId: org.id,
      documentId: resolved.documentId,
      documentRevisionId: resolved.revisionId,
      numberOfCopies: body.numberOfCopies ?? 1,
      requestingUserId: attributedUserId,
      departmentId: dept.id,
      destinationLocation: body.destinationLocation,
      intendedPurpose: body.intendedPurpose ?? `Triggered from ${adapter.displayName}`,
      reasonForPrinting: `Requested by ${body.requestedByEmail} via ${adapter.displayName}`,
      isUrgent: !!body.isUrgent,
      source: providerKey,
      sourceRef: body.externalRef,
      status: 'REQUESTED',
    })
    .returning();

  await recordAuditEvent({
    organizationId: org.id,
    userId: attributedUserId,
    eventType: 'PRINT_REQUESTED',
    entityType: 'print_request',
    entityId: req_.id,
    summary: `Print requested via ${adapter.displayName} webhook for ${resolved.documentNumber} rev ${resolved.revisionLabel} (external ref ${body.externalRef}, requested by ${body.requestedByEmail})`,
  });

  return c.json({ printRequest: req_ }, 201);
});
