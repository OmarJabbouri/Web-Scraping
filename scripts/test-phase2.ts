/**
 * Phase 2 self-test — exercises the queue infrastructure against a live Redis + Postgres.
 *
 *   npm run build        # scripts import the compiled @rag/shared + @rag/db
 *   docker compose up -d postgres redis
 *   npm run db:migrate
 *   npm run test:phase2
 *
 * Safe to run whether or not the dev stack (`npm run dev`) is up: it does not obliterate the
 * pipeline queues, and each check targets one mechanism directly, so a running worker consuming
 * the round-trip job is fine (that just proves the queue works too).
 *
 * Covers, with no later phases needed:
 *   2.4 per-domain rate limiter spaces requests by crawl_delay_ms (shared across workers)
 *   2.2 exponential backoff produces growing, jittered delays
 *   2.1 a typed job round-trips through a queue and is processed to completion
 *   2.3 dead-lettering writes a failed_jobs row AND copies the job to the dead-letter queue
 */
import {
  createRedisConnection,
  createWorker,
  enqueue,
  reserveDomainSlot,
  applyBackoffJitter,
  closeQueues,
  getDeadLetterQueue,
} from '@rag/shared';
import type { Job } from 'bullmq';
import { recordDeadLetter, FailedJob, sequelize } from '@rag/db';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

async function main() {
  console.log('\nPhase 2 — queue infrastructure self-test\n');

  // 2.4 per-domain rate limiter -------------------------------------------
  console.log('2.4 per-domain rate limiter (crawl_delay = 1000 ms)');
  const redis = createRedisConnection();
  await redis.del('ratelimit:domain:selftest.example');
  const w1 = await reserveDomainSlot(redis, 'selftest.example', 1000);
  const w2 = await reserveDomainSlot(redis, 'selftest.example', 1000);
  const w3 = await reserveDomainSlot(redis, 'selftest.example', 1000);
  check('slots spaced by the delay', w1 < 100 && w2 > 800 && w3 > 1800, `waits: ${w1}/${w2}/${w3} ms`);

  // 2.2 exponential backoff with jitter -----------------------------------
  console.log('2.2 exponential backoff + jitter');
  const delays = [1, 2, 3, 4].map((n) => applyBackoffJitter(n, 'custom', new Error(), {} as Job));
  const grows = delays[0]! < delays[1]! && delays[1]! < delays[2]! && delays[2]! < delays[3]!;
  check('delay grows across attempts', grows && delays.every((d) => d > 0), `${delays.join(' / ')} ms`);

  // 2.1 typed job round-trip ----------------------------------------------
  console.log('2.1 typed job round-trip');
  const worker = createWorker('scrape', async () => ({ ok: true }));
  const job = await enqueue('scrape', { siteId: 1, url: 'https://books.toscrape.com/', depth: 0 });
  let state = '';
  for (let i = 0; i < 50 && state !== 'completed'; i++) {
    state = await (job as Job).getState();
    if (state !== 'completed') await sleep(100);
  }
  check('job processed to completion', state === 'completed', `final state: ${state}`);
  await worker.close();

  // 2.3 dead-letter mechanism ---------------------------------------------
  console.log('2.3 dead-letter (failed_jobs row + dead-letter queue)');
  const dlq = getDeadLetterQueue();
  const beforeRows = await FailedJob.count();
  const beforeDlq = await dlq.getJobCountByTypes('waiting', 'completed', 'active', 'failed');
  // Call the handler directly with a job that has exhausted its retries — the same code path a
  // worker runs on final failure (see createWorker's `onFinalFailure`).
  const jobId = `selftest-${Date.now()}`;
  const deadJob = {
    name: 'index',
    queueName: 'index',
    id: jobId,
    data: { documentId: 999 },
    attemptsMade: 4,
  } as unknown as Job;
  await recordDeadLetter(deadJob, new Error('simulated permanent failure'));
  const afterRows = await FailedJob.count();
  const afterDlq = await dlq.getJobCountByTypes('waiting', 'completed', 'active', 'failed');
  const row = await FailedJob.findOne({ where: { jobId }, order: [['id', 'DESC']] });
  check('failed_jobs row written', afterRows === beforeRows + 1, `error="${row?.errorMessage}"`);
  check('job copied to dead-letter queue', afterDlq > beforeDlq, `${beforeDlq} -> ${afterDlq}`);

  // cleanup ----------------------------------------------------------------
  if (row) await FailedJob.destroy({ where: { id: row.id } });
  await dlq.remove(`dlq:index:${jobId}`).catch(() => {});
  await redis.quit();
  await closeQueues();
  await sequelize.close();

  console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
