// Epic F — the print-job dispatcher. Started via `npm run worker`
// (already wired in package.json). One Node process, one BullMQ Worker per
// printer, running concurrently — this is deliberately NOT a single shared
// worker pulling from a single shared queue, because that would reintroduce
// exactly the cross-printer-delay problem the per-printer queue design (F2)
// exists to avoid.
//
// Responsibilities per job:
//   1. Check the printer's circuit-breaker state (F9) before dispatching.
//   2. Hand the job to the resolved PrinterDriver (simulated today).
//   3. On success: record confirmedPages, detect partial prints (F4),
//      reset the circuit breaker, mark the job CONFIRMED or PARTIAL.
//   4. On failure: record the error, let BullMQ's own retry/backoff (F7)
//      re-attempt automatically; only on the FINAL failed attempt do we
//      trip the circuit breaker and move the job to DEAD_LETTER (F8).

import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { printJobs, printers, controlledCopies } from '@/db/schema';
import { redisConnection, queueNameForPrinter } from '@/lib/print-queue/queues';
import { checkCircuit, recordPrintSuccess, recordPrintFailure } from '@/lib/print-queue/circuit-breaker';
import { getDriverForPrinter, type PrintJobPayload } from '@/lib/print-queue/driver';
import { storage } from '@/lib/storage';

const activeWorkers = new Map<string, Worker>();

async function loadJobContext(printJobId: string) {
  const [job] = await db.select().from(printJobs).where(eq(printJobs.id, printJobId)).limit(1);
  if (!job) throw new Error(`print_jobs row ${printJobId} not found`);
  const [printer] = await db.select().from(printers).where(eq(printers.id, job.printerId)).limit(1);
  if (!printer) throw new Error(`printer ${job.printerId} not found`);
  let pdfBytes: Buffer | null = null;
  if (job.copyId) {
    const [copy] = await db.select().from(controlledCopies).where(eq(controlledCopies.id, job.copyId)).limit(1);
    if (copy?.pdfFileKey) pdfBytes = await storage.getObject(copy.pdfFileKey);
  }
  return { job, printer, pdfBytes };
}

async function processPrintJob(bullJob: Job<{ printJobId: string }>) {
  const { job, printer, pdfBytes } = await loadJobContext(bullJob.data.printJobId);

  const circuit = await checkCircuit(printer.id);
  if (!circuit.allowed) {
    // Don't burn a BullMQ retry attempt on a circuit we already know is
    // open — fail fast with a clear reason and let BullMQ's backoff decide
    // when to try again (the cooldown and the backoff schedule are
    // independent clocks, which is fine: whichever clears later wins).
    throw new Error(circuit.reason ?? 'Printer circuit is open');
  }

  await db
    .update(printJobs)
    .set({ status: 'DISPATCHED', attempts: bullJob.attemptsMade + 1, dispatchedAt: new Date(), updatedAt: new Date() })
    .where(eq(printJobs.id, job.id));

  const driver = getDriverForPrinter(printer.connectionEndpoint);
  const payload: PrintJobPayload = {
    jobId: job.id,
    printerId: printer.id,
    printerName: printer.name,
    connectionEndpoint: printer.connectionEndpoint,
    pdfBytes: pdfBytes ?? Buffer.from(''),
    requestedPages: job.requestedPages,
    paperSize: 'A4',
  };

  try {
    const outcome = await driver.print(payload);
    await recordPrintSuccess(printer.id);

    const partial = outcome.confirmedPages < job.requestedPages; // F4
    await db
      .update(printJobs)
      .set({
        status: partial ? 'PARTIAL' : 'CONFIRMED',
        confirmedPages: outcome.confirmedPages,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(printJobs.id, job.id));

    if (job.copyId) {
      await db
        .update(controlledCopies)
        .set({
          printOutcome: partial ? 'FAILED' : 'SUCCEEDED',
          printOutcomeNote: partial
            ? `Partial print: ${outcome.confirmedPages}/${job.requestedPages} pages confirmed`
            : null,
          updatedAt: new Date(),
        })
        .where(eq(controlledCopies.id, job.copyId));
    }

    return { ok: true, confirmedPages: outcome.confirmedPages };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isFinalAttempt = bullJob.attemptsMade + 1 >= (bullJob.opts.attempts ?? 1);

    await db
      .update(printJobs)
      .set({
        status: isFinalAttempt ? 'DEAD_LETTER' : 'FAILED',
        lastError: message,
        updatedAt: new Date(),
      })
      .where(eq(printJobs.id, job.id));

    const result = await recordPrintFailure(printer.id);

    if (isFinalAttempt && job.copyId) {
      await db
        .update(controlledCopies)
        .set({ printOutcome: 'FAILED', printOutcomeNote: message, updatedAt: new Date() })
        .where(eq(controlledCopies.id, job.copyId));
    }

    if (result?.tripped) {
      console.warn(
        `[print-worker] circuit OPEN for printer ${printer.id} (${printer.name}) after ${result.consecutiveFailures} consecutive failures`
      );
    }

    throw err; // let BullMQ record the failed attempt and apply backoff/retry
  }
}

// Spins up (or reuses) a Worker for a given printer's queue. Called at
// startup for every printer, and should also be called whenever a new
// printer is registered at runtime (the admin route for creating a printer
// does this — see src/server/routes/printers.ts).
export function ensureWorkerForPrinter(printerId: string) {
  const name = queueNameForPrinter(printerId);
  if (activeWorkers.has(name)) return activeWorkers.get(name)!;

  const worker = new Worker(name, processPrintJob, {
    connection: redisConnection,
    concurrency: 1, // one job at a time per printer — it's a physical device
  });

  worker.on('failed', (bullJob, err) => {
    console.error(`[print-worker] job ${bullJob?.id} on queue ${name} failed: ${err.message}`);
  });

  activeWorkers.set(name, worker);
  return worker;
}

async function main() {
  const allPrinters = await db.select().from(printers);
  for (const p of allPrinters) ensureWorkerForPrinter(p.id);
  console.log(`[print-worker] watching ${allPrinters.length} printer queue(s)`);

  // Poll for newly-registered printers every 30s rather than requiring a
  // worker restart after adding one from the admin UI.
  setInterval(async () => {
    const current = await db.select().from(printers);
    for (const p of current) ensureWorkerForPrinter(p.id);
  }, 30_000);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[print-worker] fatal error', err);
    process.exit(1);
  });
}
