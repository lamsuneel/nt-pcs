// Epic F2 — per-printer queue isolation.
//
// Every printer gets its OWN BullMQ queue (name derived from printer.id), so
// a backlog or a stuck job on one printer can never delay jobs bound for a
// different printer. There is no shared "print" queue anywhere in this
// design — that's the whole point.

import { Queue, QueueEvents, type ConnectionOptions } from 'bullmq';

const connection: ConnectionOptions = {
  // REDIS_URL is expected to be set in the environment (same convention as
  // DATABASE_URL). bullmq/ioredis are already project dependencies.
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

export function queueNameForPrinter(printerId: string): string {
  return `print-jobs:${printerId}`;
}

const queueCache = new Map<string, Queue>();

export function getPrinterQueue(printerId: string): Queue {
  const name = queueNameForPrinter(printerId);
  let q = queueCache.get(name);
  if (!q) {
    q = new Queue(name, {
      connection,
      defaultJobOptions: {
        // F7 — retry with exponential backoff. 5 attempts: ~2s, 4s, 8s,
        // 16s, 32s before a job is considered exhausted and moved to
        // DEAD_LETTER by the worker's failed-event handler.
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
        removeOnFail: false, // keep failed jobs visible for the dead-letter view
      },
    });
    queueCache.set(name, q);
  }
  return q;
}

export function getPrinterQueueEvents(printerId: string): QueueEvents {
  return new QueueEvents(queueNameForPrinter(printerId), { connection });
}

// BullMQ priority: lower number = higher priority. Map our two-tier
// STANDARD/URGENT model onto it (F11) without starving STANDARD jobs —
// BullMQ still processes in priority order within a queue, but every job
// eventually runs since nothing here holds STANDARD jobs indefinitely.
export function priorityToBullMqPriority(priority: 'STANDARD' | 'URGENT'): number {
  return priority === 'URGENT' ? 1 : 10;
}

export { connection as redisConnection };
