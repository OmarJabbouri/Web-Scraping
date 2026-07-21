import { getDeadLetterQueue } from '@rag/shared';
import type { Job } from 'bullmq';
import { FailedJob } from './models/index.js';

/**
 * Dead-letter a permanently-failed job (task 2.3). Wire this into a worker as its
 * `onFinalFailure` handler; it runs once, after the last retry is exhausted.
 *
 * It does two things:
 *   1. persists the job (queue, payload, error, attempts) to the `failed_jobs` table so the
 *      failure survives a Redis flush and can be inspected/reported;
 *   2. copies the job onto the shared `dead-letter` queue so it also shows up in Bull Board and
 *      could be replayed later.
 *
 * Lives in @rag/db (not @rag/shared) because @rag/shared must not depend on the database — the
 * dependency only flows db → shared.
 */
export async function recordDeadLetter(job: Job, err: Error): Promise<void> {
  await FailedJob.create({
    queue: job.queueName,
    jobId: job.id ?? null,
    payload: job.data,
    errorMessage: err.message,
    errorStack: err.stack ?? null,
    attemptsMade: job.attemptsMade,
  });

  await getDeadLetterQueue().add(
    job.name,
    { originalQueue: job.queueName, originalJobId: job.id, data: job.data, error: err.message },
    { jobId: job.id ? `dlq:${job.queueName}:${job.id}` : undefined },
  );
}
