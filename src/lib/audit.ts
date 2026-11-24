import { db } from '@/db/client';
import { auditEvents } from '@/db/schema';

export interface AuditEventInput {
  organizationId: string;
  userId?: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  reasonForChange?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  correctsAuditEventId?: string | null;
  ipAddress?: string | null;
}

/**
 * Append-only audit trail. Never update or delete a row here — a correction
 * is logged as a new event referencing the one it corrects (correctsAuditEventId),
 * per the "never silently overwrite" rule in the spec's data-integrity section.
 */
export async function recordAuditEvent(input: AuditEventInput) {
  const [row] = await db
    .insert(auditEvents)
    .values({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      reasonForChange: input.reasonForChange ?? null,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null,
      correctsAuditEventId: input.correctsAuditEventId ?? null,
      ipAddress: input.ipAddress ?? null,
    })
    .returning();
  return row;
}
