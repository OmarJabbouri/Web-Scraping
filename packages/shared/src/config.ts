import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';

/**
 * Load the nearest `.env` by walking up from the current working directory.
 *
 * `dotenv/config` only checks `process.cwd()`, so launching a worker from its own app folder
 * (which has no `.env`) would silently miss the root `.env` and make OPENAI_API_KEY look unset —
 * the real cause of "index jobs fail even though the key is in .env". Searching upward makes the
 * key resolve no matter which directory the process starts in.
 *
 * In Docker there is no `.env` file at all (env comes from the container), so the search finds
 * nothing and is a harmless no-op — and dotenv never overrides an already-set process.env var.
 */
function loadNearestDotenv(): void {
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return; // reached the filesystem root with no .env — rely on real env vars
    dir = parent;
  }
}

loadNearestDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgres://rag:rag@localhost:5433/rag'),
  REDIS_URL: z.string().url().default('redis://localhost:6380'),
  // Required from Phase 5 (embeddings + RAG answers); optional until then.
  OPENAI_API_KEY: z.string().optional(),
  // Browser origins allowed to call the API (Phase 6/7). Comma-separated list, or `*` for any —
  // the default, since the API is read-mostly and runs locally for the demo.
  CORS_ORIGIN: z.string().default('*'),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
