import express from 'express';
import { loadConfig } from '@rag/shared';

const config = loadConfig();
const app = express();

app.use(express.json());

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ status: 'ok', service: 'api', env: config.NODE_ENV });
});

app.listen(config.PORT, () => {
  console.log(`[api] listening on port ${config.PORT}`);
});
