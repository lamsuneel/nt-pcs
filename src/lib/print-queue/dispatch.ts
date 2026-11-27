// Epic F — enqueue entry point. Called from the print-request `issue` route
// (and, later, from any Integration adapter) right after a controlled copy's
// PDF has been generated and stored. This is the only place that creates a
// print_jobs row and pushes work onto a printer's isolated BullMQ queue —
// keep it the single entry point so the per-printer isolation guarantee
// (F2) can't be bypassed by a second code path.

import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { printers, printJobs } from '@/db/schema';
import { getPrinterQueue, priorityToBullMqPriority } from './queues';

export type PrintJobSource = 'NATIVE' | 'GOOGLE_DRIVE' | 'SHAREPOINT' | 'MASTERCONTROL' | 'VEEVA';

export type EnqueuePrintJobInput = {
  organizationId: string;
  printRequestId?: string;
  copyId?: string;
  printerId?: string | null;
  requestedPages: number;
  priority?: 'STANDARD' | 'URGENT';
  source?: PrintJobSource;
  sourceRef?: string;
};

// Resolves a printer for the job when the caller didn't pin one explicitly.
// MVP fallback: the organization's oldest registered, non-paused printer.
// Replace with real routing (by site/department/document) once there's more
// than one printer per org in practice.
async function resolveDefaultPrinter(organizationId: string) {
  const [printer] = await db
    .select()
    .from(printers)
    .where(and(eq(printers.organizationId, organizationId), isNull(printers.circuitOpenUntil)))
    .orderBy(desc(printers.createdAt))
    .limit(1);
  return printer ?? null;
}

export async function enqueuePrintJob(input: EnqueuePrintJobInput) {
  let printerId = input.printerId ?? null;
  if (!printerId) {
    const fallback = await resolveDefaultPrinter(input.organizationId);
    printerId = fallback?.id ?? null;
  }
  if (!printerId) {
    // No printer registered for this org yet — surface clearly rather than
    // silently dropping the job. Callers should register at least one
    // printer (simulated is fine) before issuing.
    throw new Error('No printer is registered for this organization yet. Add one under Printer & Queue.');
  }

  const [job] = await db
    .insert(printJobs)
    .values({
      organizationId: input.organizationId,
      printRequestId: input.printRequestId ?? null,
      copyId: input.copyId ?? null,
      printerId,
      queueName: '', // set below once we know the job id, kept here for the not-null column
      status: 'QUEUED',
      priority: input.priority ?? 'STANDARD',
      source: input.source ?? 'NATIVE',
      sourceRef: input.sourceRef ?? null,
      requestedPages: input.requestedPages,
    })
    .returning();

  const queue = getPrinterQueue(printerId);
  const bullJob = await queue.add(
    'print',
    { printJobId: job.id },
    { priority: priorityToBullMqPriority(input.priority ?? 'STANDARD') }
  );

  await db
    .update(printJobs)
    .set({ queueName: queue.name, bullJobId: bullJob.id, updatedAt: new Date() })
    .where(eq(printJobs.id, job.id));

  return { ...job, queueName: queue.name, bullJobId: bullJob.id };
}
