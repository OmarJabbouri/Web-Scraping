import { Queue, type JobsOptions, type BackoffStrategy } from 'bullmq';
import { createRedisConnection } from './connection.js';
import type { JobPayloads } from './payloads.js';

/**
 * The pipeline's queue names. `dead-letter` is not part of the normal flow — jobs land there only
 * after exhausting all retries (see dead-letter handling in worker.ts / @rag/db recordDeadLetter).
 */
export const QUEUE_NAMES = {
  scrape: 'scrape',
  process: 'process',
  index: 'index',
  deadLetter: 'dead-letter',
} as const;

export type PipelineQueueName = keyof JobPayloads; // 'scrape' | 'process' | 'index'

/**
 * Retry policy (task 2.2): 4 attempts (1 initial + 3 retries) with exponential backoff **and
 * jitter**. Jitter matters when several workers fail on the same domain at once — without it they
 * would all retry in lockstep and hammer the site again on the same tick (a "thundering herd").
 *
 * BullMQ's built-in `exponential` backoff has no jitter, so we register a custom strategy
 * (`applyBackoffJitter`) and reference it here with `type: 'custom'`. Every worker wires the same
 * strategy in via `buildWorkerSettings()`.
 */
export const DEFAULT_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export const defaultJobOptions: JobsOptions = {
  attempts: DEFAULT_ATTEMPTS,
  backoff: { type: 'custom' },
  // Keep Redis tidy: drop succeeded jobs but retain recent failures so the demo (and Bull Board)
  // can show what went wrong before it hit the dead-letter queue.
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

/**
 * Exponential backoff with "equal jitter": half the delay is fixed exponential growth, the other
 * half is random. Delay for attempt n ≈ base * 2^(n-1), split 50/50 fixed/random, capped.
 */
export const applyBackoffJitter: BackoffStrategy = (attemptsMade: number): number => {
  const exp = Math.min(BASE_BACKOFF_MS * 2 ** (attemptsMade - 1), MAX_BACKOFF_MS);
  const half = exp / 2;
  return Math.round(half + Math.random() * half);
};

// Cache one Queue instance per name — a Queue owns a Redis connection, so we don't want a new one
// on every enqueue call.
const queueCache = new Map<string, Queue>();

function getQueue<N extends PipelineQueueName>(name: N): Queue<JobPayloads[N]> {
  let queue = queueCache.get(name);
  if (!queue) {
    queue = new Queue(QUEUE_NAMES[name], {
      connection: createRedisConnection(),
      defaultJobOptions,
    });
    queueCache.set(name, queue);
  }
  return queue as Queue<JobPayloads[N]>;
}

/** Enqueue a typed job onto one of the pipeline queues. */
export function enqueue<N extends PipelineQueueName>(
  name: N,
  data: JobPayloads[N],
  opts?: JobsOptions,
): Promise<unknown> {
  // `name` doubles as the job name. Widen to the default Queue generics so BullMQ's `add`
  // overload (which narrows the job-name type from the data type) doesn't reject the generic N.
  const queue = getQueue(name) as unknown as Queue;
  return queue.add(name, data, opts);
}

/** The dead-letter queue. Holds a copy of every job that failed permanently, for inspection/replay. */
let deadLetterQueue: Queue | undefined;
export function getDeadLetterQueue(): Queue {
  if (!deadLetterQueue) {
    deadLetterQueue = new Queue(QUEUE_NAMES.deadLetter, {
      connection: createRedisConnection(),
      // Dead-lettered jobs are already terminal — never auto-retry them.
      defaultJobOptions: { attempts: 1, removeOnComplete: false, removeOnFail: false },
    });
  }
  return deadLetterQueue;
}

/**
 * Every queue instance, for mounting on the Bull Board dashboard (task 2.5). Returns the three
 * pipeline queues plus the dead-letter queue so operators can watch depth, retries and failures.
 */
export function getAllQueues(): Queue[] {
  return [
    getQueue('scrape'),
    getQueue('process'),
    getQueue('index'),
    getDeadLetterQueue(),
  ];
}

/** Close every cached queue connection (used during graceful shutdown). */
export async function closeQueues(): Promise<void> {
  await Promise.all([...queueCache.values()].map((q) => q.close()));
  queueCache.clear();
  if (deadLetterQueue) {
    await deadLetterQueue.close();
    deadLetterQueue = undefined;
  }
}
