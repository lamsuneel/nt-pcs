// Epic F — Printer driver abstraction.
//
// The dispatcher never talks to a printer protocol directly; it goes through
// a PrinterDriver. That's what lets us ship and prove out the whole
// queue/retry/circuit-breaker pipeline today, with zero real hardware on
// hand, and swap in a real protocol (IPP first, most printers speak it)
// later without touching the dispatcher at all.
//
// SimulatedPrinterDriver is the default today. It "prints" by rendering the
// job's PDF bytes to a file under /tmp (so you can open it and see exactly
// what would have come out of the printer) and resolves after a short delay.
// It also accepts a few deliberate failure-injection hooks (below) so the
// retry/backoff/circuit-breaker logic can be exercised without faking a
// flaky printer by hand.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type PrintJobPayload = {
  jobId: string;
  printerId: string;
  printerName: string;
  connectionEndpoint: string | null;
  pdfBytes: Buffer;
  requestedPages: number;
  paperSize: string;
};

export type PrintOutcome = {
  // Pages actually confirmed printed. Used for the F4 expected-vs-confirmed
  // partial-print check — a real IPP driver would read this back from the
  // printer's job-state attributes; the simulator just reports success/fail.
  confirmedPages: number;
};

export interface PrinterDriver {
  // Resolves with the outcome on success. Throws (with a short, user-facing
  // message) on failure — the dispatcher treats any throw as a failed
  // attempt and feeds it into the retry/circuit-breaker state machine.
  print(job: PrintJobPayload): Promise<PrintOutcome>;
  // Lightweight reachability probe used when a CIRCUIT_OPEN printer's
  // circuitOpenUntil has passed, before we resume routing real jobs to it.
  healthCheck(job: Pick<PrintJobPayload, 'printerId' | 'connectionEndpoint'>): Promise<boolean>;
}

const SIM_OUTPUT_DIR = '/tmp/nt-pcs-simulated-prints';

export class SimulatedPrinterDriver implements PrinterDriver {
  async print(job: PrintJobPayload): Promise<PrintOutcome> {
    // Deliberate failure injection for testing, controlled via the printer's
    // name — lets us demo/test retry and circuit-breaker behavior without
    // real hardware:
    //   name contains "(flaky)"   -> fails ~50% of attempts
    //   name contains "(offline)" -> always fails
    //   name contains "(partial)" -> "succeeds" but confirms fewer pages
    //                                 than requested, to exercise F4
    const name = job.printerName.toLowerCase();
    if (name.includes('(offline)')) {
      throw new Error(`Printer "${job.printerName}" is unreachable (simulated offline driver).`);
    }
    if (name.includes('(flaky)') && Math.random() < 0.5) {
      throw new Error(`Printer "${job.printerName}" timed out mid-job (simulated transient failure).`);
    }

    await mkdir(SIM_OUTPUT_DIR, { recursive: true });
    const outPath = path.join(SIM_OUTPUT_DIR, `${job.jobId}.pdf`);
    await writeFile(outPath, job.pdfBytes);

    // Simulate dispatch latency instead of resolving instantly, so the
    // queue's in-flight/active state is observable in the admin dashboard.
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700));

    if (name.includes('(partial)')) {
      return { confirmedPages: Math.max(1, job.requestedPages - 1) };
    }
    return { confirmedPages: job.requestedPages };
  }

  async healthCheck(): Promise<boolean> {
    // The simulated driver is always "reachable" once circuitOpenUntil has
    // passed — it has no real link to probe. A real IppPrinterDriver would
    // send a Get-Printer-Attributes request here.
    return true;
  }
}

// Stub for the real network driver. Not implemented yet — intentionally,
// since there is no hardware/sandbox to validate it against today. Wiring
// a printer's connectionEndpoint to an IPP address is the only change
// needed to move a given printer off the simulator once that's ready.
export class IppPrinterDriver implements PrinterDriver {
  async print(_job: PrintJobPayload): Promise<PrintOutcome> {
    throw new Error('IppPrinterDriver is not implemented yet. Use the simulated driver for now.');
  }
  async healthCheck(): Promise<boolean> {
    return false;
  }
}

export function getDriverForPrinter(connectionEndpoint: string | null): PrinterDriver {
  // No endpoint configured => simulated. Once a printer has a real
  // connectionEndpoint (ipp://...), route it to IppPrinterDriver instead.
  if (connectionEndpoint && connectionEndpoint.startsWith('ipp://')) {
    return new IppPrinterDriver();
  }
  return new SimulatedPrinterDriver();
}
