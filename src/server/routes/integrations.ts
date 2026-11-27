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
import { getDriveAccessTokenForUser, isServiceAccountConfigured } from '@/lib/integrations/google-service-account';
import { requireAuth } from '../authz';

registerAdapter(googleDriveAdapter);
registerAdapter(sharePointAdapter);

const PROVIDER_PATH_MAP: Record<string, IntegrationProviderKey> = {
  'google-drive': 'GOOGLE_DRIVE',
  sharepoint: 'SHAREPOINT',
  mastercontrol: 'MASTERCONTROL',
  veeva: 'VEEVA',
};

export const integrationRoutes = new Hono();

// Live Google Drive search for the "request print" screen — the document
// picker searches Drive directly instead of only the local document list,
// per the requirement to "pick up a copy" from Drive. Session-authed (this
// is called from inside the app, not a webhook), scoped to the session's
// organization for the linked-document cross-reference.
//
// Returns Drive search hits enriched with whether each one is already
// linked to an approved, printable document in PrintAssure — only linked
// + approved items can actually be selected to request a print; this is
// what stops a print being requested against an unapproved/unregistered
// file. Falls back to searching only already-linked documents by name when
// no live Drive credentials are configured for this user yet
// — still a real search, just scoped to what PrintAssure already knows
// about, until live credentials are added.
integrationRoutes.get('/google-drive/search', requireAuth, async (c) => {
  const session = c.get('session');
  const q = (c.req.query('q') ?? '').trim();
  if (!q) return c.json({ source: 'none', results: [] });

  const linked = await db
    .select({
      externalRef: documents.externalRef,
      documentId: documents.id,
      documentNumber: documents.documentNumber,
      title: documents.title,
      currentRevisionId: documents.currentRevisionId,
    })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, session.organizationId),
        eq(documents.externalProvider, 'GOOGLE_DRIVE')
      )
    );
  const linkedByRef = new Map(linked.filter((d) => d.externalRef).map((d) => [d.externalRef as string, d]));

  // Domain-wide delegation: impersonate the signed-in user's own email, so
  // the search runs over their own Drive with no separate Google login.
  const accessToken = await getDriveAccessTokenForUser(session.email);
  if (accessToken) {
    try {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', `name contains '${q.replace(/'/g, "\\'")}' and trashed = false`);
      url.searchParams.set('fields', 'files(id,name,modifiedTime,webViewLink)');
      url.searchParams.set('pageSize', '15');
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Drive API returned ${res.status}`);
      const data = (await res.json()) as { files?: { id: string; name: string; modifiedTime: string; webViewLink: string }[] };
      const results = (data.files ?? []).map((f) => {
        const match = linkedByRef.get(f.id);
        return {
          externalRef: f.id,
          name: f.name,
          modifiedTime: f.modifiedTime,
          webViewLink: f.webViewLink,
          linkedDocumentId: match?.documentId ?? null,
          linkedDocumentNumber: match?.documentNumber ?? null,
        };
      });
      return c.json({ source: 'live_drive', results });
    } catch (err) {
      console.error('[google-drive search] live search failed, falling back to linked documents:', err);
      // fall through to the DB-backed fallback below
    }
  }

  const fallbackMatches = linked.filter(
    (d) => d.title.toLowerCase().includes(q.toLowerCase()) || d.documentNumber.toLowerCase().includes(q.toLowerCase())
  );
  return c.json({
    source: 'linked_documents_only',
    note: accessToken
      ? 'Live Google Drive search failed; showing already-linked documents that match instead.'
      : isServiceAccountConfigured()
        ? `Your Workspace admin hasn't granted Drive delegation for ${session.email} yet — showing already-linked documents instead.`
        : "Live Google Drive search isn't configured yet (service account + domain-wide delegation) — showing already-linked documents instead.",
    results: fallbackMatches.map((d) => ({
      externalRef: d.externalRef,
      name: `${d.documentNumber} — ${d.title}`,
      modifiedTime: null,
      webViewLink: null,
      linkedDocumentId: d.documentId,
      linkedDocumentNumber: d.documentNumber,
    })),
  });
});

// Resolves a selected Drive file to the approved, printable document it's
// linked to (same governance check the adapter applies to a webhook
// trigger) — this is what the print-request form calls right before
// letting the user submit, so a search hit can never be force-fit into a
// print request it isn't actually approved for.
integrationRoutes.get('/google-drive/resolve', requireAuth, async (c) => {
  const session = c.get('session');
  const fileId = c.req.query('fileId');
  if (!fileId) return c.json({ error: 'fileId is required' }, 400);

  let resolved;
  try {
    resolved = await googleDriveAdapter.resolveDocument(fileId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Google Drive adapter error: ${message}` }, 502);
  }
  if (!resolved) {
    return c.json(
      { error: 'This Drive file isn’t linked to an approved controlled document yet. Link it from the document’s page first.' },
      404
    );
  }
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, resolved.documentId), eq(documents.organizationId, session.organizationId)))
    .limit(1);
  if (!doc) return c.json({ error: 'Document not found in your organization' }, 404);

  return c.json({ documentId: resolved.documentId, documentNumber: resolved.documentNumber, revisionLabel: resolved.revisionLabel });
});

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
