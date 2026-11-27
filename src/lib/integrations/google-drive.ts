// Epic H — Google Drive adapter. Built and tested first because a Google
// Drive connection is available right now with zero setup, unlike
// SharePoint which needs a Microsoft 365 developer sandbox the user hasn't
// provisioned yet (see sharepoint.ts). Same IntegrationAdapter contract
// either way, so swapping in the real SharePoint/Graph implementation later
// touches nothing else — not the webhook route, not the request/approval
// pipeline.
//
// Two layers, so this is genuinely useful today and gets stronger once the
// app has its own Google credentials:
//   1. Core match (always active): externalRef -> documents row where
//      external_provider = 'GOOGLE_DRIVE' and external_ref = the Drive file
//      ID, with its current revision APPROVED. This is the actual control —
//      it's what stops an unapproved or stale document from being printed,
//      and it needs nothing beyond our own database.
//   2. Optional live verification: if GOOGLE_OAUTH_ACCESS_TOKEN (a short-
//      lived bearer token for a Drive-scoped service account/OAuth client)
//      is set in the environment, confirm the file still exists and hasn't
//      been trashed in Drive before honoring the trigger — a plain REST
//      call, no Google SDK dependency required. Skipped (not failed) when
//      no token is configured — that's a deployment step for the
//      customer's own Google Workspace, not something this adapter can do
//      on anyone's behalf.

import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { documents, documentRevisions } from '@/db/schema';
import type { IntegrationAdapter, ResolvedExternalDocument } from './adapter';

async function verifyLiveInDrive(fileId: string): Promise<boolean> {
  const accessToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (!accessToken) {
    // No credentials configured — this is an expected, non-error state for
    // most deployments today. The core DB-backed match above is still the
    // real gate; this is a defense-in-depth extra, not the control itself.
    return true;
  }
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      console.error(`[google-drive adapter] Drive API returned ${res.status} for file ${fileId}`);
      return false;
    }
    const data = (await res.json()) as { trashed?: boolean };
    return !data.trashed;
  } catch (err) {
    // A live-check failure (network, revoked grant, file genuinely deleted)
    // fails closed — we'd rather hold the print and let a human look than
    // print against a file we can no longer confirm.
    console.error('[google-drive adapter] live verification failed:', err);
    return false;
  }
}

export const googleDriveAdapter: IntegrationAdapter = {
  providerKey: 'GOOGLE_DRIVE',
  displayName: 'Google Drive',

  async resolveDocument(externalRef: string): Promise<ResolvedExternalDocument | null> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.externalProvider, 'GOOGLE_DRIVE'), eq(documents.externalRef, externalRef)))
      .limit(1);
    if (!doc || !doc.currentRevisionId) return null;

    const [revision] = await db
      .select()
      .from(documentRevisions)
      .where(eq(documentRevisions.id, doc.currentRevisionId))
      .limit(1);
    if (!revision || revision.approvalStatus !== 'APPROVED') return null;

    const stillValid = await verifyLiveInDrive(externalRef);
    if (!stillValid) return null;

    return {
      documentId: doc.id,
      revisionId: revision.id,
      documentNumber: doc.documentNumber,
      revisionLabel: revision.revisionLabel,
    };
  },
};
