import express from 'express';
import { loadConfig, getAllQueues } from '@rag/shared';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const config = loadConfig();
const app = express();

app.use(express.json());

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', service: 'api', env: config.NODE_ENV });
});

// Bull Board (task 2.5): a live dashboard over every queue — depth, active/completed/failed jobs,
// retries and the dead-letter queue. Great for the demo video and for showing fault tolerance.
const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: getAllQueues().map((queue) => new BullMQAdapter(queue)),
  serverAdapter: bullBoardAdapter,
});
app.use('/admin/queues', bullBoardAdapter.getRouter());

app.listen(config.PORT, () => {
  console.log(`[api] listening on port ${config.PORT}`);
  console.log(`[api] Bull Board dashboard at http://localhost:${config.PORT}/admin/queues`);
});
