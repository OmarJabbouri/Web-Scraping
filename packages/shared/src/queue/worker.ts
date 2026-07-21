import { Worker, type Job, type Processor, type WorkerOptions } from 'bullmq';
import { createRedisConnection } from './connection.js';
import { applyBackoffJitter, QUEUE_NAMES, type PipelineQueueName } from './queues.js';
import { jobSchemas } from './payloads.js';
import type { JobPayloads } from './payloads.js';

/** Called once per job after the *final* retry fails. Lets an app persist the job to the DLQ. */
export type FinalFailureHandler<N extends PipelineQueueName> = (
  job: Job<JobPayloads[N]>,
  err: Error,
) => void | Promise<void>;

export interface CreateWorkerOptions<N extends PipelineQueueName> {
  concurrency?: number;
  /** Invoked when a job exhausts all its attempts — wire this to @rag/db `recordDeadLetter`. */
  onFinalFailure?: FinalFailureHandler<N>;
  /** Extra BullMQ worker options merged last (e.g. limiter). */
  workerOptions?: Partial<WorkerOptions>;
}

/**
 * Create a typed BullMQ Worker for a pipeline queue with the project's cross-cutting concerns
 * baked in:
 *   - the payload is validated with its zod schema before the processor sees it;
 *   - the jitter backoff strategy (2.2) is registered so `backoff: { type: 'custom' }` works;
 *   - permanently-failed jobs trigger `onFinalFailure` for dead-lettering (2.3);
 *   - SIGTERM/SIGINT drain the worker gracefully (2.6) — the in-flight job finishes (or is
 *     released back to the queue) instead of being lost, which is what makes the "kill a worker
 *     mid-task, the job recovers" fault-tolerance demo work.
 */
export function createWorker<N extends PipelineQueueName>(
  name: N,
  processor: (job: Job<JobPayloads[N]>) => Promise<unknown>,
  opts: CreateWorkerOptions<N> = {},
): Worker<JobPayloads[N]> {
  const schema = jobSchemas[name];

  const validatingProcessor: Processor<JobPayloads[N]> = async (job) => {
    // Parse defensively: the job may have been queued by an older/newer build.
    const data = schema.parse(job.data) as JobPayloads[N];
    return processor({ ...job, data } as Job<JobPayloads[N]>);
  };

  const worker = new Worker<JobPayloads[N]>(QUEUE_NAMES[name], validatingProcessor, {
    connection: createRedisConnection(),
    concurrency: opts.concurrency ?? 1,
    settings: { backoffStrategy: applyBackoffJitter },
    ...opts.workerOptions,
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    const isFinal = job.attemptsMade >= attempts;
    console.error(
      `[${name}] job ${job.id} failed (attempt ${job.attemptsMade}/${attempts})${
        isFinal ? ' — final, dead-lettering' : ', will retry'
      }: ${err.message}`,
    );
    if (isFinal && opts.onFinalFailure) {
      void Promise.resolve(opts.onFinalFailure(job, err)).catch((e) =>
        console.error(`[${name}] onFinalFailure handler threw: ${(e as Error).message}`),
      );
    }
  });

  registerGracefulShutdown(name, worker);
  console.log(`[${name}] worker ready (concurrency ${opts.concurrency ?? 1})`);
  return worker;
}

/** Wire SIGTERM/SIGINT → worker.close(), which stops taking new jobs and waits for the active one. */
function registerGracefulShutdown(name: string, worker: Worker): void {
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[${name}] ${signal} received — draining current job before exit`);
    try {
      await worker.close(); // resolves once the in-flight job settles
    } catch (e) {
      console.error(`[${name}] error during shutdown: ${(e as Error).message}`);
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}
