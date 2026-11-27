// Epic F9 — printer circuit breaker.
//
// A printer that just keeps failing shouldn't keep eating every job routed
// to it (and shouldn't keep a Document Controller guessing why nothing is
// printing). After CIRCUIT_OPEN, the dispatcher stops sending new jobs to
// that printer until the cool-off window passes, then allows exactly one
// probe through before fully re-closing the circuit.

import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { printers } from '@/db/schema';

const FAILURE_THRESHOLD = 3; // consecutive failures before the circuit opens
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes before a health-check retry is allowed

export async function recordPrintSuccess(printerId: string) {
  await db
    .update(printers)
    .set({
      consecutiveFailures: 0,
      status: 'ACTIVE',
      circuitOpenUntil: null,
      lastHealthCheckAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(printers.id, printerId));
}

export async function recordPrintFailure(printerId: string) {
  const [printer] = await db.select().from(printers).where(eq(printers.id, printerId)).limit(1);
  if (!printer) return;

  const consecutiveFailures = printer.consecutiveFailures + 1;
  const tripping = consecutiveFailures >= FAILURE_THRESHOLD;

  await db
    .update(printers)
    .set({
      consecutiveFailures,
      status: tripping ? 'CIRCUIT_OPEN' : printer.status,
      circuitOpenUntil: tripping ? new Date(Date.now() + COOLDOWN_MS) : printer.circuitOpenUntil,
      updatedAt: new Date(),
    })
    .where(eq(printers.id, printerId));

  return { tripped: tripping, consecutiveFailures };
}

// Called by the dispatcher before handing a job to a printer. Returns
// whether the job may proceed now, and whether this attempt should count
// as the "one probe" that decides if the circuit re-closes.
export async function checkCircuit(
  printerId: string
): Promise<{ allowed: boolean; isProbe: boolean; reason?: string }> {
  const [printer] = await db.select().from(printers).where(eq(printers.id, printerId)).limit(1);
  if (!printer) return { allowed: false, isProbe: false, reason: 'Printer not found' };

  if (printer.status === 'PAUSED') {
    return { allowed: false, isProbe: false, reason: 'Printer is paused by an operator' };
  }

  if (printer.status === 'CIRCUIT_OPEN') {
    const openUntil = printer.circuitOpenUntil ? new Date(printer.circuitOpenUntil).getTime() : 0;
    if (Date.now() < openUntil) {
      return { allowed: false, isProbe: false, reason: 'Circuit open — printer failed repeatedly, cooling off' };
    }
    // Cooldown has elapsed: let exactly one job through as a health probe.
    return { allowed: true, isProbe: true };
  }

  return { allowed: true, isProbe: false };
}

// Manual override for an operator to force-close a circuit from the admin
// dashboard without waiting for the cooldown (e.g. they just fixed the
// printer themselves).
export async function resetCircuit(printerId: string) {
  await db
    .update(printers)
    .set({ status: 'ACTIVE', consecutiveFailures: 0, circuitOpenUntil: null, updatedAt: new Date() })
    .where(eq(printers.id, printerId));
}

export const CIRCUIT_BREAKER_CONFIG = { FAILURE_THRESHOLD, COOLDOWN_MS } as const;
